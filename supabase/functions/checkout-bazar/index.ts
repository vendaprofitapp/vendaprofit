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

    // Create sale record FIRST (before marking as sold)
    const sellerPrice = Number(item.seller_price) || 0;
    const storeCommission = Number(item.store_commission) || 0;
    const finalPrice = Number(item.final_price) || (sellerPrice + storeCommission);

    const { error: saleError } = await supabase.rpc("create_sale_transaction", {
      payload: {
        owner_id: item.owner_id,
        sale: {
          customer_name: buyer_name,
          customer_phone: buyer_phone,
          payment_method: "Dinheiro",
          subtotal: finalPrice,
          discount_type: null,
          discount_value: 0,
          discount_amount: 0,
          total: finalPrice,
          notes: `Venda Bazar VIP (catálogo): ${item.title}`,
          status: "completed",
          sale_source: "bazar",
          shipping_cost: shipping_cost || 0,
          shipping_company: shipping_carrier || null,
          shipping_payer: "buyer",
        },
        items: [
          {
            product_id: null,
            product_name: item.title,
            quantity: 1,
            unit_price: finalPrice,
            total: finalPrice,
            source: "bazar",
          },
        ],
        stock_updates: [],
        financial_splits: [
          {
            user_id: item.owner_id,
            amount: -sellerPrice,
            type: "cost_recovery",
            description: `Custo Bazar VIP - repasse ao vendedor: ${item.seller_name || item.seller_phone}`,
          },
          {
            user_id: item.owner_id,
            amount: storeCommission,
            type: "profit_share",
            description: `Comissão Bazar VIP: ${item.title}`,
          },
        ],
      },
    });

    if (saleError) {
      console.error("Error creating sale for bazar:", saleError);
      return new Response(
        JSON.stringify({ error: "Erro ao registrar venda. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only update item to sold AFTER sale is confirmed
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
      .eq("status", "approved")
      .select()
      .single();

    if (updateError || !updated) {
      console.error("Sale created but failed to update bazar item:", updateError);
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
