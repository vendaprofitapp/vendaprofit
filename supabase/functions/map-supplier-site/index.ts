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

    // Dooca Commerce category slugs to exclude (newhype.com.br and similar stores)
    const doocaCategorySlugs = [
      'combo', 'combos', 'conjunto-com-calca', 'conjunto-com-calca-1',
      'macaquinho', 'macaquinho-1', 'acessorio', 'acessorios',
      'colete', 'jaqueta', 'macacao', 'camisas', 'camisa',
      'calcas', 'calca', 'shorts', 'vestido', 'vestidos',
      'saia', 'saias', 'top', 'tops', 'body', 'bodies',
      'kit', 'kits', 'novidades', 'lancamentos', 'sale', 'outlet',
    ];

    // Detect if any link follows Dooca pattern: domain/product/color (5 parts when split by /)
    const hasDoocaPattern = allLinks.some((link: string) => link.split('/').length === 5);

    // Filter for product URLs - look for common product URL patterns
    const productUrls = allLinks.filter((link: string) => {
      const lowerLink = link.toLowerCase();

      // First, if there's a search term, the URL MUST contain it
      if (searchTerm && !lowerLink.includes(searchTerm)) {
        return false;
      }

      // Skip URLs with query strings or anchors
      if (lowerLink.includes('?') || lowerLink.includes('#')) return false;

      // Skip generic non-product pages
      const genericExclusions = [
        '/categoria', '/category', '/busca', '/search', '/carrinho', '/cart',
        '/login', '/conta', '/account', '/politica', '/policy', '/faq',
        '/contato', '/contact', '/sobre', '/about', '/blog', '/checkout',
        '/wishlist', '/favoritos',
      ];
      if (genericExclusions.some(ex => lowerLink.includes(ex))) return false;

      const parts = link.split('/');
      // parts: ['https:', '', 'domain.com', 'slug1', 'slug2?']
      // length 4 = domain/slug1, length 5 = domain/slug1/slug2

      // --- Dooca Commerce detection (5-part URLs = product + color variant) ---
      if (hasDoocaPattern && parts.length === 5) {
        const productSlug = parts[3].toLowerCase();
        const colorSlug = parts[4].toLowerCase();

        // Exclude known category slugs in product position
        if (doocaCategorySlugs.includes(productSlug)) return false;

        // Color slug must look like a real word (letters/hyphens only, no digits at end like -1, -2)
        if (!/^[a-z][a-z-]*[a-z]$/.test(colorSlug) && !/^[a-z]+$/.test(colorSlug)) return false;

        // Product slug should have at least one hyphen (real product names have hyphens)
        if (!productSlug.includes('-')) return false;

        // Exclude slugs that end with -1, -2 etc. (Dooca category pagination variants)
        if (/-(1|2|3|4|5|6|7|8|9|10)$/.test(productSlug)) return false;

        return true;
      }

      // --- Standard product URL patterns (non-Dooca or 4-part URLs) ---
      if (lowerLink.includes('/produto/') || lowerLink.includes('/products/') || lowerLink.includes('/p/')) {
        return true;
      }

      // Generic pattern for 4-part URLs: domain/product-slug
      if (parts.length === 4) {
        const slug = parts[3].toLowerCase();

        // Exclude Dooca category slugs
        if (doocaCategorySlugs.includes(slug)) return false;

        // Exclude slugs ending with digit suffix (pagination)
        if (/-(1|2|3|4|5|6|7|8|9|10)$/.test(slug)) return false;

        // Must have hyphen (real product names)
        if (!slug.includes('-')) return false;

        return /^[a-z0-9]+-[a-z0-9]/.test(slug);
      }

      return false;
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
