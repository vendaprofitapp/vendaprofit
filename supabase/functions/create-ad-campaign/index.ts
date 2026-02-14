import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Create Ad Campaign
 * 
 * Creates a campaign on the specified platform and stores the record.
 * 
 * Meta Ads API:
 *   POST https://graph.facebook.com/v19.0/act_{ad_account_id}/campaigns
 *   Body: { name, objective: "OUTCOME_TRAFFIC" | "OUTCOME_SALES", status: "ACTIVE",
 *           special_ad_categories: [], daily_budget: budget_in_cents }
 *   Then create AdSet + Ad with creative pointing to target_url
 * 
 * Google Ads API (Performance Max):
 *   POST https://googleads.googleapis.com/v16/customers/{customer_id}/campaigns:mutate
 *   campaignBudget, campaign with advertisingChannelType: PERFORMANCE_MAX
 *   asset group with final URLs pointing to target_url
 * 
 * TikTok Ads API:
 *   POST https://business-api.tiktok.com/open_api/v1.3/campaign/create/
 *   Body: { advertiser_id, campaign_name, objective_type: "TRAFFIC",
 *           budget_mode: "BUDGET_MODE_DAY", budget: daily_budget }
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

    const { product_id, platform, daily_budget, campaign_type } = await req.json();

    if (!platform || !daily_budget) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
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

    // Check if integration is active
    const { data: integration, error: intError } = await supabase
      .from("user_ad_integrations")
      .select("*")
      .eq("owner_id", user.id)
      .eq("platform", platform)
      .eq("is_active", true)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: `Plataforma ${platform} não conectada. Conecte em Configurações.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch product info + store slug for target URL
    let productName = "Campanha Geral";
    if (product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("name")
        .eq("id", product_id)
        .single();
      if (product) productName = product.name;
    }

    const { data: store } = await supabase
      .from("store_settings")
      .select("store_slug")
      .eq("owner_id", user.id)
      .maybeSingle();

    const storeSlug = store?.store_slug || "";
    const origin = "https://vendaprofit.lovable.app";
    const targetUrl = product_id
      ? `${origin}/loja/${storeSlug}?utm_source=${platform}&utm_campaign=vp_boost&product=${product_id}`
      : `${origin}/loja/${storeSlug}?utm_source=${platform}&utm_campaign=vp_boost`;

    const campaignName = `VP Boost - ${productName} - ${new Date().toLocaleDateString("pt-BR")}`;

    // ============================================================
    // PLATFORM-SPECIFIC CAMPAIGN CREATION (documented, not yet live)
    // ============================================================

    let platformCampaignId = `sim_${platform}_${Date.now()}`;

    if (platform === "meta_ads") {
      // 1. Create Campaign: POST /act_{account_id}/campaigns
      // 2. Create AdSet with targeting (location, age, interests)
      // 3. Create Ad with creative (product image + link to target_url)
      console.log(`[Meta] Would create campaign: budget=${daily_budget}, url=${targetUrl}`);
    } else if (platform === "google_ads") {
      // 1. Create CampaignBudget
      // 2. Create Campaign (PERFORMANCE_MAX)
      // 3. Create AssetGroup with final_urls: [target_url]
      console.log(`[Google] Would create PMax campaign: budget=${daily_budget}, url=${targetUrl}`);
    } else if (platform === "tiktok_ads") {
      // 1. Create Campaign: POST /campaign/create/
      // 2. Create AdGroup with targeting
      // 3. Create Ad with creative
      console.log(`[TikTok] Would create campaign: budget=${daily_budget}, url=${targetUrl}`);
    }

    // Store campaign record
    const { data: campaign, error: insertError } = await supabase
      .from("ad_campaigns")
      .insert({
        owner_id: user.id,
        integration_id: integration.id,
        product_id: product_id || null,
        platform,
        platform_campaign_id: platformCampaignId,
        campaign_name: campaignName,
        daily_budget,
        status: "active",
        campaign_type: campaign_type || "boost",
        target_url: targetUrl,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    return new Response(JSON.stringify({ success: true, campaign_id: campaign.id, campaign_name: campaignName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
