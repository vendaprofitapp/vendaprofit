import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * OAuth Callback Handler for Ad Platforms
 * 
 * This edge function handles the OAuth 2.0 authorization code exchange for:
 * - Google Ads: POST https://oauth2.googleapis.com/token
 * - Meta Ads:   GET  https://graph.facebook.com/v19.0/oauth/access_token
 * - TikTok Ads: POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/
 * 
 * Flow:
 * 1. User clicks "Connect" in Settings
 * 2. Redirected to platform's OAuth consent screen
 * 3. Platform redirects back with `code` and `state`
 * 4. This function exchanges the code for access_token + refresh_token
 * 5. Tokens are stored in user_ad_integrations
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const platform = url.searchParams.get("platform");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Contains encrypted user_id

    if (!platform || !code || !state) {
      return new Response(JSON.stringify({ error: "Missing platform, code, or state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Decode state to get user_id (in production, use encrypted/signed state)
    const userId = state;

    let accessToken = "";
    let refreshToken = "";
    let expiresIn = 3600;
    let accountId = "";
    let accountName = "";

    // ============================================================
    // PLATFORM-SPECIFIC TOKEN EXCHANGE
    // ============================================================

    if (platform === "google_ads") {
      // Google Ads OAuth Token Exchange
      // POST https://oauth2.googleapis.com/token
      // Body: { code, client_id, client_secret, redirect_uri, grant_type: "authorization_code" }
      // Response: { access_token, refresh_token, expires_in, token_type }
      //
      // After getting tokens, fetch ad account info:
      // GET https://googleads.googleapis.com/v16/customers:listAccessibleCustomers
      // Headers: Authorization: Bearer {access_token}, developer-token: {GOOGLE_ADS_DEVELOPER_TOKEN}
      
      console.log("[Google Ads] Would exchange code for tokens here");
      // TODO: Implement when GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET are configured
      
    } else if (platform === "meta_ads") {
      // Meta (Facebook/Instagram) Ads OAuth Token Exchange
      // GET https://graph.facebook.com/v19.0/oauth/access_token
      //   ?client_id={META_APP_ID}
      //   &redirect_uri={REDIRECT_URI}
      //   &client_secret={META_APP_SECRET}
      //   &code={code}
      // Response: { access_token, token_type, expires_in }
      //
      // Exchange short-lived token for long-lived:
      // GET https://graph.facebook.com/v19.0/oauth/access_token
      //   ?grant_type=fb_exchange_token
      //   &client_id={META_APP_ID}
      //   &client_secret={META_APP_SECRET}
      //   &fb_exchange_token={SHORT_LIVED_TOKEN}
      //
      // Get ad accounts:
      // GET https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id
      
      console.log("[Meta Ads] Would exchange code for tokens here");
      // TODO: Implement when META_APP_ID and META_APP_SECRET are configured
      
    } else if (platform === "tiktok_ads") {
      // TikTok Ads OAuth Token Exchange
      // POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/
      // Body: { app_id, secret, auth_code: code }
      // Response: { data: { access_token, advertiser_ids: [...] } }
      //
      // Get advertiser info:
      // GET https://business-api.tiktok.com/open_api/v1.3/advertiser/info/
      //   ?advertiser_ids=[...]
      // Headers: Access-Token: {access_token}
      
      console.log("[TikTok Ads] Would exchange code for tokens here");
      // TODO: Implement when TIKTOK_APP_ID and TIKTOK_APP_SECRET are configured
      
    } else {
      return new Response(JSON.stringify({ error: "Unsupported platform" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For now, store the placeholder data
    // In production, accessToken/refreshToken would come from the API responses above
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("user_ad_integrations")
      .upsert({
        owner_id: userId,
        platform,
        access_token: accessToken,
        refresh_token: refreshToken,
        account_id: accountId,
        account_name: accountName,
        is_active: true,
        token_expires_at: tokenExpiresAt,
      }, { onConflict: "owner_id,platform" });

    if (upsertError) {
      throw new Error(`Failed to store tokens: ${upsertError.message}`);
    }

    return new Response(JSON.stringify({ success: true, platform }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
