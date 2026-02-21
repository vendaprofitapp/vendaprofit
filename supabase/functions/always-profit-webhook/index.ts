import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL =
  Deno.env.get("ALWAYS_PROFIT_WEBHOOK_URL") ||
  "https://api.alwaysprofit.com/webhook/sales";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 9000]; // backoff exponencial

async function sendWithRetry(
  payload: Record<string, unknown>,
): Promise<{ success: boolean; status?: number; attempt: number; error?: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await res.text(); // consume body
        return { success: true, status: res.status, attempt: attempt + 1 };
      }

      // Non-retryable status codes (client errors)
      if (res.status >= 400 && res.status < 500) {
        const body = await res.text();
        return {
          success: false,
          status: res.status,
          attempt: attempt + 1,
          error: `Client error: ${res.status} - ${body.slice(0, 200)}`,
        };
      }

      // Server error — retry
      await res.text(); // consume body
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    } catch (err) {
      // Network error — retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      } else {
        return {
          success: false,
          attempt: attempt + 1,
          error: `Network error after ${MAX_RETRIES + 1} attempts: ${err.message}`,
        };
      }
    }
  }

  return { success: false, attempt: MAX_RETRIES + 1, error: "Max retries exceeded" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const saleId = body.sale_id;

    if (!saleId) {
      return new Response(
        JSON.stringify({ error: "sale_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build admin client to read sale data (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch sale + items in parallel
    const [saleRes, itemsRes] = await Promise.all([
      supabase
        .from("sales")
        .select("id, owner_id, customer_name, total, subtotal, discount_amount, shipping_cost, payment_method, status, sale_source, created_at")
        .eq("id", saleId)
        .single(),
      supabase
        .from("sale_items")
        .select("product_id, product_name, quantity, unit_price, total")
        .eq("sale_id", saleId),
    ]);

    if (saleRes.error || !saleRes.data) {
      return new Response(
        JSON.stringify({ error: "Sale not found", details: saleRes.error?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch seller name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, store_name")
      .eq("id", saleRes.data.owner_id)
      .single();

    // Compile webhook payload
    const webhookPayload = {
      event: "sale.completed",
      timestamp: new Date().toISOString(),
      sale: {
        id: saleRes.data.id,
        total: saleRes.data.total,
        subtotal: saleRes.data.subtotal,
        discount: saleRes.data.discount_amount,
        shipping_cost: saleRes.data.shipping_cost,
        payment_method: saleRes.data.payment_method,
        status: saleRes.data.status,
        source: saleRes.data.sale_source,
        customer_name: saleRes.data.customer_name,
        created_at: saleRes.data.created_at,
      },
      items: (itemsRes.data || []).map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.total,
      })),
      seller: {
        id: saleRes.data.owner_id,
        name: profile?.full_name || "Desconhecido",
        email: profile?.email || null,
        store_name: profile?.store_name || null,
      },
    };

    // Send with retry
    const result = await sendWithRetry(webhookPayload);

    console.log(
      `[always-profit-webhook] sale=${saleId} success=${result.success} attempt=${result.attempt} status=${result.status || "N/A"}`,
    );

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[always-profit-webhook] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
