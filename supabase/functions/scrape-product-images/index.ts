import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractPrice(html: string, markdown: string): number | null {
  // Try common price patterns in HTML
  const pricePatterns = [
    /R\$\s*([\d.,]+)/gi,
    /class="[^"]*price[^"]*"[^>]*>.*?R\$\s*([\d.,]+)/gi,
    /data-price="([\d.,]+)"/gi,
    /"price":\s*"?(\d+[\d.,]*)"?/gi,
    /itemprop="price"[^>]*content="([\d.,]+)"/gi,
  ];

  for (const pattern of pricePatterns) {
    const matches = [...html.matchAll(pattern), ...markdown.matchAll(pattern)];
    for (const match of matches) {
      const priceStr = match[1].replace(/\./g, '').replace(',', '.');
      const price = parseFloat(priceStr);
      if (price > 0 && price < 100000) {
        return price;
      }
    }
  }
  return null;
}

function extractDescription(html: string, markdown: string): string | null {
  // Try to find product description
  const descPatterns = [
    /<meta[^>]+name="description"[^>]+content="([^"]+)"/i,
    /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i,
    /class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\//gi,
    /itemprop="description"[^>]*>([\s\S]*?)<\//gi,
  ];

  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const desc = match[1].replace(/<[^>]+>/g, '').trim();
      if (desc.length > 10 && desc.length < 2000) {
        return desc;
      }
    }
  }

  // Try to extract from markdown - look for description sections
  const mdDescMatch = markdown.match(/(?:descrição|description|sobre|about)[:\s]*([\s\S]{20,500}?)(?:\n\n|\n#|$)/i);
  if (mdDescMatch) {
    return mdDescMatch[1].trim();
  }

  return null;
}

function extractColors(html: string, markdown: string): string[] {
  const colors: string[] = [];
  const colorPatterns = [
    /(?:cor|color)[:\s]*([a-záàâãéèêíïóôõöúçñ\s]+)/gi,
    /data-color="([^"]+)"/gi,
    /class="[^"]*color[^"]*"[^>]*>([^<]+)</gi,
  ];

  const commonColors = [
    'preto', 'branco', 'azul', 'vermelho', 'verde', 'amarelo', 'rosa', 
    'roxo', 'laranja', 'marrom', 'cinza', 'bege', 'nude', 'vinho',
    'black', 'white', 'blue', 'red', 'green', 'yellow', 'pink',
    'purple', 'orange', 'brown', 'gray', 'grey', 'beige'
  ];

  const content = (html + ' ' + markdown).toLowerCase();
  
  for (const color of commonColors) {
    if (content.includes(color) && !colors.includes(color)) {
      colors.push(color);
    }
  }

  return colors.slice(0, 5);
}

function extractSizes(html: string, markdown: string): string[] {
  const sizes: string[] = [];
  const content = (html + ' ' + markdown).toUpperCase();
  
  // Common size patterns
  const sizePatterns = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XS', 'S', 'L', 'XL', 'XXL'];
  
  for (const size of sizePatterns) {
    // Look for size in context (e.g., "Tamanho: M" or class="size-M")
    const sizeRegex = new RegExp(`(?:tamanho|size|tam)[:\\s]*${size}(?:\\s|,|<|$)`, 'i');
    if (sizeRegex.test(content) && !sizes.includes(size)) {
      sizes.push(size);
    }
  }

  // Also look for numeric sizes
  const numericSizes = content.match(/(?:tamanho|size)[:\s]*(\d{1,2})/gi);
  if (numericSizes) {
    for (const match of numericSizes) {
      const num = match.match(/\d+/)?.[0];
      if (num && !sizes.includes(num)) {
        sizes.push(num);
      }
    }
  }

  return sizes;
}

function extractCategory(html: string, markdown: string, productName: string): string | null {
  const categories = [
    'top', 'blusa', 'camiseta', 'camisa', 'regata',
    'calça', 'legging', 'short', 'shorts', 'bermuda',
    'vestido', 'saia', 'macacão', 'body',
    'casaco', 'jaqueta', 'moletom', 'cardigan',
    'tênis', 'sapato', 'sandália', 'bota',
    'bolsa', 'mochila', 'carteira',
    'acessório', 'cinto', 'chapéu', 'boné'
  ];

  const content = (productName + ' ' + html + ' ' + markdown).toLowerCase();
  
  for (const cat of categories) {
    if (content.includes(cat)) {
      return cat.charAt(0).toUpperCase() + cat.slice(1);
    }
  }

  return null;
}

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
        waitFor: 2000,
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

    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    const images: string[] = [];
    
    // Extract images from HTML
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      
      if (imgUrl.includes('data:image') && imgUrl.length < 200) continue;
      if (imgUrl.includes('pixel') || imgUrl.includes('tracking')) continue;
      if (imgUrl.includes('icon') && imgUrl.length < 50) continue;
      if (imgUrl.includes('logo') && !imgUrl.includes('product')) continue;
      
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        const urlObj = new URL(formattedUrl);
        imgUrl = urlObj.origin + imgUrl;
      } else if (!imgUrl.startsWith('http')) {
        const urlObj = new URL(formattedUrl);
        imgUrl = urlObj.origin + '/' + imgUrl;
      }
      
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

    // Also look for data-src attributes
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
    
    // Try og:title as well
    const ogTitleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogTitleMatch && ogTitleMatch[1].length > productName.length) {
      productName = ogTitleMatch[1].split('|')[0].split('-')[0].trim();
    }

    // Try h1 tag for product name
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match && h1Match[1].trim().length > 3) {
      productName = h1Match[1].trim();
    }

    // Try product name from JSON-LD
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const jsonLd of jsonLdMatch) {
        try {
          const jsonContent = jsonLd.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const parsed = JSON.parse(jsonContent);
          if (parsed.name) {
            productName = parsed.name;
            break;
          }
          if (parsed['@graph']) {
            for (const item of parsed['@graph']) {
              if (item['@type'] === 'Product' && item.name) {
                productName = item.name;
                break;
              }
            }
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }

    // Fallback: extract from URL slug
    if (!productName || productName.length < 3) {
      const urlObj = new URL(formattedUrl);
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
      if (pathParts.length > 0) {
        const slug = pathParts[pathParts.length - 1];
        // Convert slug to title case (e.g., "top-alana-aloe-botanical" -> "Top Alana Aloe Botanical")
        productName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        // Remove size indicators at the end (e.g., "G", "GG", "P", "M")
        productName = productName.replace(/\s+(G|Gg|P|M|Pp|Xg|Xxg|U|Unico|\d+)\s*$/i, '').trim();
      }
    }

    // Extract additional product data
    const price = extractPrice(html, markdown);
    const description = extractDescription(html, markdown);
    const colors = extractColors(html, markdown);
    const sizes = extractSizes(html, markdown);
    const category = extractCategory(html, markdown, productName);

    console.log(`Found ${images.length} images, price: ${price}, colors: ${colors.join(', ')}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        images: images.slice(0, 20),
        productData: {
          name: productName,
          price,
          description,
          colors,
          sizes,
          category,
        },
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
