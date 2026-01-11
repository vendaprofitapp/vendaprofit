import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

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

    console.log('Scraping product page:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
        waitFor: 2000, // Wait for images to load
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Erro ao acessar a página` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract images from HTML
    const html = data.data?.html || data.html || '';
    const images: string[] = [];
    
    // Match img tags and extract src
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      
      // Skip tiny icons, tracking pixels, and base64 images
      if (imgUrl.includes('data:image') && imgUrl.length < 200) continue;
      if (imgUrl.includes('pixel') || imgUrl.includes('tracking')) continue;
      if (imgUrl.includes('icon') && imgUrl.length < 50) continue;
      if (imgUrl.includes('logo') && !imgUrl.includes('product')) continue;
      
      // Convert relative URLs to absolute
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        const urlObj = new URL(formattedUrl);
        imgUrl = urlObj.origin + imgUrl;
      } else if (!imgUrl.startsWith('http')) {
        const urlObj = new URL(formattedUrl);
        imgUrl = urlObj.origin + '/' + imgUrl;
      }
      
      // Check if it's likely a product image (larger images, common product image patterns)
      const isLikelyProductImage = 
        imgUrl.includes('product') ||
        imgUrl.includes('uploads') ||
        imgUrl.includes('media') ||
        imgUrl.includes('images') ||
        imgUrl.includes('cdn') ||
        imgUrl.includes('foto') ||
        imgUrl.includes('gallery') ||
        imgUrl.match(/\.(jpg|jpeg|png|webp)/i);
      
      if (isLikelyProductImage && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // Also look for srcset and data-src attributes
    const dataSrcRegex = /data-src=["']([^"']+)["']/gi;
    while ((match = dataSrcRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        const urlObj = new URL(formattedUrl);
        imgUrl = urlObj.origin + imgUrl;
      }
      if (imgUrl.match(/\.(jpg|jpeg|png|webp)/i) && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // Look for background-image in style
    const bgRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
    while ((match = bgRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        const urlObj = new URL(formattedUrl);
        imgUrl = urlObj.origin + imgUrl;
      }
      if (imgUrl.match(/\.(jpg|jpeg|png|webp)/i) && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // Extract product name from metadata or title
    let productName = '';
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      productName = titleMatch[1].split('|')[0].split('-')[0].trim();
    }

    console.log(`Found ${images.length} product images`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        images: images.slice(0, 20), // Limit to 20 images
        productName,
        sourceUrl: formattedUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar imagens';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
