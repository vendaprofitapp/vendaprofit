import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Maps event_type to the system_settings key that holds the webhook URL
const WEBHOOK_KEY_MAP: Record<string, string> = {
  new_lead: "botconversa_webhook_new_lead",
  cart_created: "botconversa_webhook_cart_created",
  catalog_sale: "botconversa_webhook_catalog_sale",
  consignment_finalized: "botconversa_webhook_consignment_finalized",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  async function saveLog(logData: {
    event_type: string;
    owner_id: string;
    phone?: string | null;
    message?: string | null;
    status: string;
    error_message?: string | null;
    botconversa_status?: number | null;
  }) {
    try {
      await supabase.from("botconversa_logs").insert(logData);
    } catch (e) {
      console.error("Failed to save log:", e);
    }
  }

  try {
    const body = await req.json();
    const { event_type, owner_id, payload, test_phone } = body;

    if (!event_type || !owner_id) {
      return new Response(JSON.stringify({ error: "Missing event_type or owner_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Determine the webhook URL key for this event
    const settingKey = WEBHOOK_KEY_MAP[event_type];
    if (!settingKey) {
      await saveLog({ event_type, owner_id, status: "skipped", error_message: `Tipo de evento desconhecido: ${event_type}` });
      return new Response(JSON.stringify({ skipped: true, reason: "unknown_event_type" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check if botconversa is enabled and fetch webhook URL
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["botconversa_enabled", settingKey]);

    const enabledRow = settings?.find((s: { key: string; value: string | null }) => s.key === "botconversa_enabled");
    if (enabledRow?.value !== "true") {
      console.log("Botconversa disabled — skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookRow = settings?.find((s: { key: string; value: string | null }) => s.key === settingKey);
    const webhookUrl = webhookRow?.value?.trim();

    if (!webhookUrl) {
      console.log(`Webhook URL not configured for ${event_type} (key: ${settingKey}) — skipping`);
      await saveLog({ event_type, owner_id, status: "skipped", error_message: `Webhook não configurado para ${event_type}` });
      return new Response(JSON.stringify({ skipped: true, reason: "no_webhook_url" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Resolve the phone number
    let phone: string;

    if (test_phone) {
      phone = test_phone.replace(/\D/g, "");
      if (!phone.startsWith("55")) phone = "55" + phone;
    } else {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", owner_id)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`No phone found for owner ${owner_id} — skipping`);
        await saveLog({ event_type, owner_id, phone: null, status: "skipped", error_message: "Vendedora sem telefone cadastrado no perfil" });
        return new Response(JSON.stringify({ skipped: true, reason: "no_phone" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      phone = profile.phone.replace(/\D/g, "");
      if (!phone.startsWith("55")) phone = "55" + phone;
    }

    // 4. Enrich consignment_finalized with customer info
    let enrichedPayload = payload || {};
    if (event_type === "consignment_finalized" && enrichedPayload?.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("id", enrichedPayload.customer_id)
        .single();
      if (customer) {
        enrichedPayload = { ...enrichedPayload, customer_name: customer.name, customer_phone: customer.phone };
      }
    }

    // 5. Build webhook payload — phone + all event data (flat)
    const webhookPayload = { phone, ...enrichedPayload };

    // 6. POST to the webhook URL
    const botResp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    const botBody = await botResp.text();
    console.log(`Botconversa webhook [${event_type}] → ${phone} | HTTP ${botResp.status}:`, botBody);

    const payloadSummary = JSON.stringify(webhookPayload).slice(0, 500);

    if (botResp.ok) {
      await saveLog({ event_type, owner_id, phone, message: payloadSummary, status: "success", botconversa_status: botResp.status });
    } else {
      await saveLog({ event_type, owner_id, phone, message: payloadSummary, status: "failed", error_message: botBody, botconversa_status: botResp.status });
    }

    return new Response(
      JSON.stringify({ success: botResp.ok, status: botResp.status, body: botBody }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("botconversa-notify error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
