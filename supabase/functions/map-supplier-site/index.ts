import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, search } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl não está configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Mapping site:', formattedUrl);

    // Use Firecrawl Map to discover all URLs
    const response = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        search: search || '',
        limit: 500,
        includeSubdomains: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Erro ao mapear o site` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allLinks = data.links || [];
    const searchTerm = (search || '').toLowerCase().trim();
    
    // Filter for product URLs - look for common product URL patterns
    const productUrls = allLinks.filter((link: string) => {
      const lowerLink = link.toLowerCase();
      
      // First, if there's a search term, the URL MUST contain it
      if (searchTerm && !lowerLink.includes(searchTerm)) {
        return false;
      }
      
      // Common product URL patterns
      const isProduct = 
        lowerLink.includes('/produto/') ||
        lowerLink.includes('/products/') ||
        lowerLink.includes('/p/') ||
        // Pattern: domain.com/product-name (no category prefix, ends with product name)
        (!lowerLink.includes('/categoria') && 
         !lowerLink.includes('/category') &&
         !lowerLink.includes('/busca') &&
         !lowerLink.includes('/search') &&
         !lowerLink.includes('/carrinho') &&
         !lowerLink.includes('/cart') &&
         !lowerLink.includes('/login') &&
         !lowerLink.includes('/conta') &&
         !lowerLink.includes('/account') &&
         !lowerLink.includes('/politica') &&
         !lowerLink.includes('/policy') &&
         !lowerLink.includes('/faq') &&
         !lowerLink.includes('/contato') &&
         !lowerLink.includes('/contact') &&
         !lowerLink.includes('/sobre') &&
         !lowerLink.includes('/about') &&
         !lowerLink.includes('/blog') &&
         !lowerLink.includes('?') &&
         link.split('/').length >= 4 &&
         // Has a slug-like ending (words separated by hyphens)
         /\/[a-z0-9]+-[a-z0-9]+/.test(lowerLink));
      
      return isProduct;
    });

    console.log(`Found ${allLinks.length} total links, ${productUrls.length} product URLs matching "${searchTerm}"`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalLinks: allLinks.length,
        productUrls: productUrls,
        allLinks: allLinks.slice(0, 50), // Return first 50 for debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error mapping site:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao mapear o site';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
