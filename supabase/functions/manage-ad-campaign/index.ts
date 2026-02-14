import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Manage Ad Campaign (pause, resume, delete)
 * 
 * Platform pause/resume endpoints:
 * 
 * Meta: POST /act_{account_id}/campaigns { status: "PAUSED" | "ACTIVE" }
 * Google: POST /customers/{id}/campaigns:mutate { status: PAUSED | ENABLED }
 * TikTok: POST /campaign/status/update/ { campaign_ids, opt_status: "DISABLE" | "ENABLE" }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaign_id, action } = await req.json();

    if (!campaign_id || !["pause", "resume", "delete"].includes(action)) {
      return new Response(JSON.stringify({ error: "Missing campaign_id or invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch campaign
    const { data: campaign, error: fetchError } = await supabase
      .from("ad_campaigns")
      .select("*, user_ad_integrations!inner(access_token, platform)")
      .eq("id", campaign_id)
      .eq("owner_id", user.id)
      .single();

    if (fetchError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute action on platform (documented, not yet live)
    const platform = campaign.platform;

    if (action === "pause") {
      // Meta: POST status=PAUSED | Google: status=PAUSED | TikTok: opt_status=DISABLE
      console.log(`[${platform}] Would pause campaign ${campaign.platform_campaign_id}`);
      await supabase.from("ad_campaigns").update({ status: "paused" }).eq("id", campaign_id);
    } else if (action === "resume") {
      // Meta: POST status=ACTIVE | Google: status=ENABLED | TikTok: opt_status=ENABLE
      console.log(`[${platform}] Would resume campaign ${campaign.platform_campaign_id}`);
      await supabase.from("ad_campaigns").update({ status: "active" }).eq("id", campaign_id);
    } else if (action === "delete") {
      // Meta: DELETE campaign | Google: REMOVE | TikTok: opt_status=DELETE
      console.log(`[${platform}] Would delete campaign ${campaign.platform_campaign_id}`);
      await supabase.from("ad_campaigns").delete().eq("id", campaign_id);
    }

    return new Response(JSON.stringify({ success: true, action, campaign_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
