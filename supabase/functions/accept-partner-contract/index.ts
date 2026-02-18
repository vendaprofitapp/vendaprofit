import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contract_token } = await req.json();

    if (!contract_token) {
      return new Response(JSON.stringify({ error: "contract_token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capture real client IP
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if contract exists and hasn't been accepted yet
    const { data: partner, error: fetchError } = await supabase
      .from("partner_points")
      .select("id, contract_accepted_at, contact_name")
      .eq("contract_token", contract_token)
      .maybeSingle();

    if (fetchError || !partner) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (partner.contract_accepted_at) {
      return new Response(
        JSON.stringify({ error: "Contrato já foi assinado anteriormente", accepted_at: partner.contract_accepted_at }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record acceptance
    const acceptedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("partner_points")
      .update({
        contract_accepted_at: acceptedAt,
        contract_accepted_ip: ip,
      })
      .eq("contract_token", contract_token)
      .is("contract_accepted_at", null);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Erro ao registrar aceite" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        accepted_at: acceptedAt,
        ip,
        contact_name: partner.contact_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
