import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Parse sizes from a raw string extracted from supplier markdown.
 * Handles formats like:
 *   "2 4 6 8 10 12 14"         → ["2","4","6","8","10","12","14"]
 *   "2468101214"               → ["2","4","6","8","10","12","14"]  (concatenated nums)
 *   "P M G GG XG"              → ["P","M","G","GG","XG"]
 *   "PP P M G GG"              → ["PP","P","M","G","GG"]
 */
function parseSizesFromString(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Helper: parse a concatenated digit string like "2468101214" -> ["2","4","6","8","10","12","14"]
  const parseConcatenatedDigits = (s: string, preferSingleDigit = false): string[] => {
    const sizes: string[] = [];
    let i = 0;
    while (i < s.length) {
      if (!preferSingleDigit) {
        // Try 2-digit first (10, 12, 14, etc.)
        if (i + 1 < s.length) {
          const twoDigit = s.substring(i, i + 2);
          const num = parseInt(twoDigit);
          if (num >= 10 && num <= 60) {
            sizes.push(twoDigit);
            i += 2;
            continue;
          }
        }
      }
      // Single digit
      sizes.push(s[i]);
      i += 1;
    }
    return sizes;
  };

  // If it contains spaces or commas, split by those
  if (/[\s,\/|]+/.test(trimmed)) {
    const tokens = trimmed.split(/[\s,\/|]+/).filter(s => s.length > 0 && s.length < 10);
    // For each token that is pure digits and > 2 chars, try to parse as concatenated sizes
    const result: string[] = [];
    // Check if any tokens are single-digit (1-9) - indicates children/small sizes context
    const hasSingleDigitSizes = tokens.some(t => /^\d$/.test(t));
    
    for (const token of tokens) {
      if (/^\d+$/.test(token) && token.length >= 2) {
        if (token.length > 2) {
          result.push(...parseConcatenatedDigits(token, false));
        } else if (hasSingleDigitSizes && token.length === 2) {
          const num = parseInt(token);
          // Common standalone 2-digit sizes (clothing/shoe) - should NOT be split
          const validTwoDigitSizes = new Set([10,12,14,16,18,20,22,26,28,30,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48]);
          // Check if individual digits appear as standalone tokens (strong concat signal)
          const digit1 = token[0];
          const digit2 = token[1]; 
          const digitsAppearElsewhere = tokens.includes(digit1) || tokens.includes(digit2);
          
          if (!validTwoDigitSizes.has(num) || digitsAppearElsewhere) {
            result.push(digit1, digit2);
          } else {
            result.push(token);
          }
        } else {
          result.push(token);
        }
      } else {
        result.push(token);
      }
    }
    return result;
  }

  // Check if it's all digits (concatenated numeric sizes like "2468101214")
  if (/^\d+$/.test(trimmed)) {
    return parseConcatenatedDigits(trimmed);
  }

  // Check if it's all letters (concatenated letter sizes like "PMGGGXG")
  if (/^[A-Za-z]+$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    const knownSizes = ["XXXG", "XXG", "EGGG", "EGG", "EG", "XG", "GG", "PP", "P", "M", "G", "U"];
    const sizes: string[] = [];
    let remaining = upper;
    while (remaining.length > 0) {
      let found = false;
      for (const known of knownSizes) {
        if (remaining.startsWith(known)) {
          sizes.push(known);
          remaining = remaining.substring(known.length);
          found = true;
          break;
        }
      }
      if (!found) {
        // Skip unknown char
        remaining = remaining.substring(1);
      }
    }
    return sizes;
  }

  // Fallback: return the whole thing as one size
  return trimmed.length < 10 ? [trimmed] : [];
}

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
        JSON.stringify({ success: true, available: true, sizes: [], method: "toggle_trust" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Scrape the product URL - request both markdown and metadata
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
        console.log("Firecrawl scrape failed, trusting toggle:", scrapeData.error);
        return new Response(
          JSON.stringify({ success: true, available: true, sizes: [], method: "toggle_fallback" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rawMarkdown = scrapeData.data?.markdown || scrapeData.markdown || "";
      const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

      // 1. Check metadata for stock info (e.g. nuvemshop:stock)
      let metadataStock: number | null = null;
      for (const [key, val] of Object.entries(metadata)) {
        if (key.toLowerCase().includes("stock") && val) {
          const parsed = parseInt(String(val));
          if (!isNaN(parsed)) {
            metadataStock = parsed;
            break;
          }
        }
      }

      // 2. Split content: main product area vs "Produtos similares" section
      const mainContent = rawMarkdown.split(/#{1,3}\s*produtos?\s*similares/i)[0].toLowerCase();

      // 3. Check for out-of-stock indicators ONLY in main content
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

      const isOutOfStock = outOfStockPatterns.some((pattern) => mainContent.includes(pattern));

      // Determine availability: metadata stock overrides page text signals
      let available: boolean;
      if (metadataStock !== null) {
        available = metadataStock > 0;
        console.log(`Metadata stock: ${metadataStock}, available: ${available}`);
      } else {
        available = !isOutOfStock;
        console.log(`No metadata stock, isOutOfStock (main content only): ${isOutOfStock}`);
      }

      // 4. Extract sizes from main content
      let extractedSizes: string[] = [];

      // Try pattern: "Tamanho" followed by content on the next line(s)
      const sizePatterns = [
        // "Tamanho\n\n2468101214" or "Tamanho: P M G GG"
        /tamanho[s]?[\s:]*\n+\s*([^\n]+)/i,
        // "Tamanho\n2 4 6 8"
        /tamanho[s]?[\s:]+([^\n]+)/i,
        // "Tamanhos disponíveis: ..."
        /tamanhos?\s*dispon[ií]ve(?:l|is)[\s:]+([^\n]+)/i,
        // "Tamanhos: 2, 4, 6, 8"
        /tamanhos?[\s:]+(\d[\d\s,\/]+\d)/i,
      ];

      for (const pattern of sizePatterns) {
        const match = rawMarkdown.split(/#{1,3}\s*produtos?\s*similares/i)[0].match(pattern);
        if (match && match[1]) {
          console.log(`Raw size match: "${match[1]}"`);
          extractedSizes = parseSizesFromString(match[1]);
          if (extractedSizes.length > 0) {
            console.log(`Extracted sizes using pattern ${pattern}: ${JSON.stringify(extractedSizes)}`);
            break;
          }
        }
      }

      // If no sizes found from patterns, try to find a size selector block
      if (extractedSizes.length === 0) {
        // Look for button-like size listings: "2\n\n4\n\n6\n\n8\n\n10\n\n12\n\n14"
        const mainSection = rawMarkdown.split(/#{1,3}\s*produtos?\s*similares/i)[0];
        const sizeBlockMatch = mainSection.match(/tamanho[s]?[^]*?(?:\n\n?)(\d[\d\n\s]*\d)/i);
        if (sizeBlockMatch && sizeBlockMatch[1]) {
          const candidates = sizeBlockMatch[1].split(/[\n\s]+/).filter(s => s.trim().length > 0 && s.trim().length < 5);
          if (candidates.length >= 2) {
            extractedSizes = candidates.map(s => s.trim());
            console.log(`Extracted sizes from block: ${JSON.stringify(extractedSizes)}`);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          available,
          sizes: extractedSizes,
          method: "scrape",
          metadata_stock: metadataStock,
          has_out_of_stock_signal: isOutOfStock,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (scrapeError) {
      console.error("Scrape error:", scrapeError);
      return new Response(
        JSON.stringify({ success: true, available: true, sizes: [], method: "error_fallback" }),
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
