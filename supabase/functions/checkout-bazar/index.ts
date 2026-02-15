import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      bazar_item_id,
      buyer_name,
      buyer_phone,
      buyer_zip,
      shipping_cost,
      shipping_carrier,
      shipping_service,
      shipping_source,
      shipping_service_id,
    } = await req.json();

    if (!bazar_item_id || !buyer_name || !buyer_phone || !buyer_zip) {
      return new Response(
        JSON.stringify({ error: "Dados do comprador são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify item is approved
    const { data: item, error: fetchError } = await supabase
      .from("bazar_items")
      .select("*")
      .eq("id", bazar_item_id)
      .single();

    if (fetchError || !item) {
      return new Response(
        JSON.stringify({ error: "Item não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (item.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Este item não está mais disponível para compra" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update item to sold
    const { data: updated, error: updateError } = await supabase
      .from("bazar_items")
      .update({
        status: "sold",
        buyer_name,
        buyer_phone,
        buyer_zip,
        shipping_cost: shipping_cost || 0,
        shipping_carrier: shipping_carrier || null,
        shipping_service: shipping_service || null,
        shipping_source: shipping_source || null,
        shipping_service_id: shipping_service_id || null,
        sold_at: new Date().toISOString(),
      })
      .eq("id", bazar_item_id)
      .eq("status", "approved") // Optimistic lock
      .select()
      .single();

    if (updateError || !updated) {
      return new Response(
        JSON.stringify({ error: "Não foi possível concluir a compra. O item pode já ter sido vendido." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, item: updated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("checkout-bazar error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao finalizar compra" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
