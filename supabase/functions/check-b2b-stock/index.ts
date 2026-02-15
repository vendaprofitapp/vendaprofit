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
    const { product_id } = await req.json();

    if (!product_id) {
      return new Response(
        JSON.stringify({ success: false, error: "product_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch product with its supplier
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, b2b_product_url, supplier_id")
      .eq("id", product_id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ success: false, available: false, error: "Product not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!product.b2b_product_url) {
      return new Response(
        JSON.stringify({ success: true, available: false, reason: "No B2B URL configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!product.supplier_id) {
      return new Response(
        JSON.stringify({ success: true, available: false, reason: "No supplier linked" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if supplier has b2b_enabled
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id, b2b_enabled, b2b_url, b2b_login")
      .eq("id", product.supplier_id)
      .single();

    if (!supplier || !supplier.b2b_enabled) {
      return new Response(
        JSON.stringify({ success: true, available: false, reason: "Supplier B2B not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to scrape the B2B product page using Firecrawl
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlApiKey) {
      // No Firecrawl configured - trust the toggle (return available = true)
      console.log("No FIRECRAWL_API_KEY - trusting supplier toggle as available");
      return new Response(
        JSON.stringify({ success: true, available: true, method: "toggle_trust" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Scrape the product URL
    try {
      const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: product.b2b_product_url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 3000,
        }),
      });

      const scrapeData = await scrapeResponse.json();

      if (!scrapeResponse.ok || !scrapeData.success) {
        // Scraping failed - trust the toggle
        console.log("Firecrawl scrape failed, trusting toggle:", scrapeData.error);
        return new Response(
          JSON.stringify({ success: true, available: true, method: "toggle_fallback" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const markdown = (scrapeData.data?.markdown || scrapeData.markdown || "").toLowerCase();

      // Check for out-of-stock indicators (Portuguese)
      const outOfStockPatterns = [
        "esgotado",
        "indisponível",
        "indisponivel",
        "fora de estoque",
        "sem estoque",
        "produto indisponível",
        "sold out",
        "out of stock",
        "unavailable",
        "não disponível",
        "nao disponivel",
      ];

      const isOutOfStock = outOfStockPatterns.some((pattern) => markdown.includes(pattern));

      // Check for in-stock indicators
      const inStockPatterns = [
        "comprar",
        "adicionar ao carrinho",
        "add to cart",
        "buy now",
        "disponível",
        "em estoque",
        "pronta entrega",
      ];

      const hasInStockIndicator = inStockPatterns.some((pattern) => markdown.includes(pattern));

      // If out of stock found, it's not available
      // If no clear signal, trust the toggle (assume available)
      const available = !isOutOfStock;

      return new Response(
        JSON.stringify({
          success: true,
          available,
          method: "scrape",
          has_out_of_stock_signal: isOutOfStock,
          has_in_stock_signal: hasInStockIndicator,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (scrapeError) {
      console.error("Scrape error:", scrapeError);
      // On scrape error, trust the toggle
      return new Response(
        JSON.stringify({ success: true, available: true, method: "error_fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
