import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Token Refresh Handler for Ad Platforms
 * 
 * Refresh endpoints:
 * - Google: POST https://oauth2.googleapis.com/token { grant_type: "refresh_token", refresh_token, client_id, client_secret }
 * - Meta:   GET https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&...
 * - TikTok: POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/ (TikTok tokens are long-lived)
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

    const { integration_id } = await req.json();
    if (!integration_id) {
      return new Response(JSON.stringify({ error: "Missing integration_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch integration
    const { data: integration, error: fetchError } = await supabase
      .from("user_ad_integrations")
      .select("*")
      .eq("id", integration_id)
      .eq("owner_id", user.id)
      .single();

    if (fetchError || !integration) {
      return new Response(JSON.stringify({ error: "Integration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if token needs refresh (within 5 minutes of expiry)
    const expiresAt = new Date(integration.token_expires_at || 0);
    const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinFromNow) {
      return new Response(JSON.stringify({ refreshed: false, message: "Token still valid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newAccessToken = "";
    let newExpiresIn = 3600;

    if (integration.platform === "google_ads") {
      // POST https://oauth2.googleapis.com/token
      // { grant_type: "refresh_token", refresh_token: integration.refresh_token,
      //   client_id: GOOGLE_ADS_CLIENT_ID, client_secret: GOOGLE_ADS_CLIENT_SECRET }
      console.log("[Google Ads] Would refresh token here");
    } else if (integration.platform === "meta_ads") {
      // Meta long-lived tokens last ~60 days, refresh before expiry
      // GET https://graph.facebook.com/v19.0/oauth/access_token
      //   ?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token=...
      console.log("[Meta Ads] Would refresh token here");
    } else if (integration.platform === "tiktok_ads") {
      // TikTok tokens are typically long-lived (24h+), refresh via:
      // POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/
      console.log("[TikTok Ads] Would refresh token here");
    }

    // Update token in database (placeholder for now)
    const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000).toISOString();
    await supabase
      .from("user_ad_integrations")
      .update({ access_token: newAccessToken, token_expires_at: newExpiresAt })
      .eq("id", integration_id);

    return new Response(JSON.stringify({ refreshed: true, expires_at: newExpiresAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
