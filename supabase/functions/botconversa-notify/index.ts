import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOTCONVERSA_API_URL =
  "https://backend.botconversa.com.br/api/v1/webhook/subscriber/send-message/";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMessage(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "new_lead": {
      const name = payload.name || "Cliente";
      const phone = payload.phone || "—";
      const createdAt = payload.created_at
        ? formatDateTime(payload.created_at as string)
        : "";
      return (
        `🆕 *Novo lead na sua loja!*\n\n` +
        `👤 Nome: ${name}\n` +
        `📱 WhatsApp: ${phone}\n` +
        (createdAt ? `🕐 Horário: ${createdAt}\n` : "") +
        `\nAcesse o CRM para acompanhar:\nhttps://vendaprofit.lovable.app/marketing/whatsapp`
      );
    }

    case "cart_created": {
      const leadName = payload.lead_name || "Cliente";
      const productName = payload.product_name || "Produto";
      const qty = payload.quantity || 1;
      const unitPrice = Number(payload.unit_price || 0);
      const size = payload.selected_size ? ` | Tam: ${payload.selected_size}` : "";
      const color = payload.variant_color ? ` | Cor: ${payload.variant_color}` : "";
      const total = formatBRL(unitPrice * Number(qty));

      return (
        `🛒 *Carrinho criado na sua loja!*\n\n` +
        `👤 Cliente: ${leadName}\n` +
        `📦 Produto: ${productName}${size}${color}\n` +
        `   Qtd: ${qty} × ${formatBRL(unitPrice)}\n\n` +
        `💰 Total estimado: ${total}\n\n` +
        `Entre em contato para fechar a venda:\nhttps://vendaprofit.lovable.app/marketing/whatsapp`
      );
    }

    case "catalog_sale": {
      const customerName = payload.customer_name || "Cliente";
      const customerPhone = payload.customer_phone || "—";
      const total = formatBRL(Number(payload.total || 0));
      const payment = payload.payment_method || "—";

      let itemsText = "";
      if (Array.isArray(payload.items) && payload.items.length > 0) {
        itemsText =
          "\n\n📦 Itens:\n" +
          (payload.items as Array<{
            product_name?: string;
            quantity?: number;
            unit_price?: number;
          }>)
            .map(
              (item) =>
                `• ${item.quantity || 1}× ${item.product_name || "Produto"} — ${formatBRL(Number(item.unit_price || 0))}`
            )
            .join("\n");
      }

      return (
        `🎉 *Nova venda pelo catálogo!*\n\n` +
        `👤 Cliente: ${customerName}\n` +
        `📱 WhatsApp: ${customerPhone}\n` +
        `💳 Pagamento: ${payment}\n` +
        `💰 Total: ${total}` +
        itemsText +
        `\n\nAcesse para confirmar:\nhttps://vendaprofit.lovable.app/sales`
      );
    }

    case "consignment_finalized": {
      return (
        `👜 *Cliente finalizou escolhas na Bolsa!*\n\n` +
        `A bolsa foi finalizada pelo cliente.\n\n` +
        `Acesse para conciliar a bolsa:\nhttps://vendaprofit.lovable.app/consignments`
      );
    }

    default:
      return `📬 Novo evento no sistema: ${eventType}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("BOTCONVERSA_API_KEY");
    if (!apiKey) {
      console.log("BOTCONVERSA_API_KEY not configured — skipping notification");
      return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { event_type, owner_id, payload } = body;

    if (!event_type || !owner_id) {
      return new Response(JSON.stringify({ error: "Missing event_type or owner_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read profile phone
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch seller phone from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("id", owner_id)
      .single();

    if (profileError || !profile?.phone) {
      console.log(`No phone found for owner ${owner_id} — skipping`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_phone" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Enrich consignment_finalized with customer info
    let enrichedPayload = payload;
    if (event_type === "consignment_finalized" && payload?.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("id", payload.customer_id)
        .single();
      if (customer) {
        enrichedPayload = { ...payload, customer_name: customer.name, customer_phone: customer.phone };
      }
    }

    const message = buildMessage(event_type, enrichedPayload || {});

    // Format phone: remove non-digits, ensure it starts with country code
    let phone = profile.phone.replace(/\D/g, "");
    if (!phone.startsWith("55")) {
      phone = "55" + phone;
    }

    // Send via Botconversa API
    const botResp = await fetch(BOTCONVERSA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        phone,
        message,
      }),
    });

    const botBody = await botResp.text();
    console.log(`Botconversa response [${botResp.status}]:`, botBody);

    return new Response(
      JSON.stringify({ success: botResp.ok, status: botResp.status }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("botconversa-notify error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
