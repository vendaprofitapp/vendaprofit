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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const { invite_code } = await req.json();
  if (!invite_code) {
    return new Response(JSON.stringify({ error: "invite_code is required" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Find the invite
  const { data: connection, error: findErr } = await supabase
    .from("hub_connections")
    .select("*")
    .eq("invite_code", invite_code)
    .eq("status", "pending")
    .maybeSingle();

  if (findErr || !connection) {
    return new Response(JSON.stringify({ error: "Convite inválido ou já utilizado." }), {
      status: 404,
      headers: corsHeaders,
    });
  }

  if (connection.owner_id === user.id) {
    return new Response(JSON.stringify({ error: "Você não pode aceitar seu próprio convite." }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Accept invite
  const { error: updateErr } = await supabase
    .from("hub_connections")
    .update({ seller_id: user.id, status: "active" })
    .eq("id", connection.id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({ success: true, connection_id: connection.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
