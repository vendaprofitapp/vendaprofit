import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No authorization header." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated", detail: userError }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data: connections, error: connError } = await supabase
    .from("hub_connections")
    .select("id, owner_id, commission_pct, status")
    .eq("seller_id", user.id)
    .eq("status", "active");

  if (connError) return new Response(JSON.stringify({ step: 1, error: connError.message, user_id: user.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!connections || connections.length === 0) {
    return new Response(JSON.stringify({
      step: 1,
      result: "NO HUB CONNECTIONS FOUND FOR THIS USER",
      user_id: user.id,
      email: user.email,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const connectionIds = connections.map((c: any) => c.id);

  const { data: sharedRows, error: sharedError } = await supabase
    .from("hub_shared_products")
    .select("connection_id, product_id")
    .in("connection_id", connectionIds)
    .eq("is_active", true)
    .limit(20);

  if (sharedError) return new Response(JSON.stringify({ step: 2, error: sharedError.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!sharedRows || sharedRows.length === 0) {
    return new Response(JSON.stringify({ step: 2, result: "NO SHARED PRODUCTS FOUND", connections }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const productIds = [...new Set(sharedRows.map((r: any) => r.product_id))];

  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id, name, stock_quantity, is_active, owner_id")
    .in("id", productIds)
    .eq("is_active", true);

  if (prodError) return new Response(JSON.stringify({ step: 3, error: prodError.message, product_ids_tried: productIds.slice(0, 5) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  return new Response(JSON.stringify({
    success: true,
    user_id: user.id,
    email: user.email,
    connections_count: connections.length,
    shared_products_count: sharedRows.length,
    products_visible_via_rls: products?.length ?? 0,
    products_sample: products?.slice(0, 5),
    verdict: products && products.length > 0
      ? "✅ RLS OK - products are visible"
      : "❌ RLS BLOCKING - products not visible despite shared rows",
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
