import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth validation
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // Use service_role to bypass RLS for retroactive recalculation
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Validate user via anon client
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const userId = claimsData.claims.sub;

  const { groupId, costSplit, profitSeller, profitPartner, scope, fromDate } =
    await req.json();

  if (!groupId || costSplit == null || profitSeller == null || profitPartner == null || !scope) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Verify caller is a member of the group
  const { data: memberCheck } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!memberCheck) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    // 1. Get all product IDs in this group (paginated to avoid limits)
    let allProductIds: string[] = [];
    let from = 0;
    const pageSize = 500;
    while (true) {
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("product_id")
        .eq("group_id", groupId)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allProductIds = allProductIds.concat(data.map((p) => p.product_id));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (allProductIds.length === 0) {
      return new Response(JSON.stringify({ count: 0 }), { headers: corsHeaders });
    }

    // 2. Get group members
    const { data: members, error: memErr } = await supabase
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", groupId);
    if (memErr) throw memErr;

    const ownerMember = members?.find((m) => m.role === "owner");
    const partnerMember = members?.find((m) => m.role !== "owner");
    if (!ownerMember || !partnerMember) {
      return new Response(JSON.stringify({ count: 0 }), { headers: corsHeaders });
    }
    const ownerId = ownerMember.user_id;
    const partnerId = partnerMember.user_id;

    // 3. Get sale IDs for these products in pages
    const saleMap = new Map<string, { id: string; owner_id: string; subtotal: number; created_at: string }>();
    const CHUNK = 200;

    for (let i = 0; i < allProductIds.length; i += CHUNK) {
      const chunk = allProductIds.slice(i, i + CHUNK);
      let pageFrom = 0;
      while (true) {
        const { data, error } = await supabase
          .from("sale_items")
          .select("sale_id, sales!inner(id, owner_id, subtotal, created_at, status)")
          .in("product_id", chunk)
          .eq("sales.status", "completed")
          .range(pageFrom, pageFrom + 499);
        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const row of data) {
          const sale = (row as any).sales;
          if (!sale || saleMap.has(sale.id)) continue;
          if (scope === "from_date" && fromDate) {
            if (new Date(sale.created_at) < new Date(fromDate)) continue;
          }
          saleMap.set(sale.id, sale);
        }
        if (data.length < 500) break;
        pageFrom += 500;
      }
    }

    if (saleMap.size === 0) {
      return new Response(JSON.stringify({ count: 0 }), { headers: corsHeaders });
    }

    const saleIds = Array.from(saleMap.keys());

    // 4. Get costs per sale in pages
    const costBySale = new Map<string, number>();
    for (let i = 0; i < saleIds.length; i += CHUNK) {
      const chunk = saleIds.slice(i, i + CHUNK);
      const pChunk = allProductIds.slice(0, Math.min(200, allProductIds.length));
      const { data, error } = await supabase
        .from("sale_items")
        .select("sale_id, quantity, products(cost_price)")
        .in("sale_id", chunk)
        .in("product_id", pChunk);
      if (error) throw error;
      for (const item of data ?? []) {
        const cost = ((item as any).products?.cost_price ?? 0) * (item.quantity ?? 1);
        costBySale.set(item.sale_id, (costBySale.get(item.sale_id) ?? 0) + cost);
      }
    }

    // 5. Delete existing profit_share splits in pages
    for (let i = 0; i < saleIds.length; i += CHUNK) {
      const chunk = saleIds.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("financial_splits")
        .delete()
        .in("sale_id", chunk)
        .eq("type", "profit_share");
      if (error) throw error;
    }

    // 6. Rebuild splits
    const sellerPct = profitSeller / 100;
    const partnerPct = profitPartner / 100;
    const newSplits: {
      sale_id: string;
      user_id: string;
      amount: number;
      type: string;
      description: string;
    }[] = [];

    for (const sale of saleMap.values()) {
      const cost = costBySale.get(sale.id) ?? 0;
      const grossProfit = (sale.subtotal ?? 0) - cost;
      if (grossProfit <= 0) continue;

      const isOwnerSale = sale.owner_id === ownerId;
      const sellerShare = grossProfit * sellerPct;
      const partnerShare = grossProfit * partnerPct;
      const sellerId = isOwnerSale ? ownerId : partnerId;
      const nonSellerId = isOwnerSale ? partnerId : ownerId;

      newSplits.push({
        sale_id: sale.id,
        user_id: sellerId,
        amount: sellerShare,
        type: "profit_share",
        description: `Lucro sociedade (vendedora ${sellerPct * 100}%)`,
      });
      newSplits.push({
        sale_id: sale.id,
        user_id: nonSellerId,
        amount: partnerShare,
        type: "profit_share",
        description: `Lucro sociedade (sócia ${partnerPct * 100}%)`,
      });
    }

    // Insert in pages
    const INSERT_CHUNK = 500;
    for (let i = 0; i < newSplits.length; i += INSERT_CHUNK) {
      const chunk = newSplits.slice(i, i + INSERT_CHUNK);
      const { error } = await supabase.from("financial_splits").insert(chunk);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ count: saleMap.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
