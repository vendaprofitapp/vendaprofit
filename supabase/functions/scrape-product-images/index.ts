import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// Helper function to make request with retry - optimized for edge function limits
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Create abort controller for timeout - increased to 45s for slow sites
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If we get a 502/503/504, retry after a short delay
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        console.log(`Attempt ${attempt + 1}/${maxRetries} failed with ${response.status}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (lastError.name === 'AbortError') {
        console.log(`Attempt ${attempt + 1}/${maxRetries} timed out, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw lastError || new Error('Max retries reached');
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

    let response;
    let lastError: string | null = null;
    
    // Try with different configurations
    const configs = [
      { waitFor: 3000, timeout: 60000 }, // First attempt: standard
      { waitFor: 5000, timeout: 90000 }, // Second attempt: longer wait
    ];
    
    for (let configIndex = 0; configIndex < configs.length; configIndex++) {
      const config = configs[configIndex];
      console.log(`Attempt ${configIndex + 1}/${configs.length} with waitFor=${config.waitFor}ms, timeout=${config.timeout}ms`);
      
      try {
        response = await fetchWithRetry('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ['html', 'rawHtml'],
            onlyMainContent: false,
            waitFor: config.waitFor,
            timeout: config.timeout,
          }),
        });
        
        // Check if response is OK or a retryable error
        if (response.ok) {
          break; // Success, exit the loop
        }
        
        // Check for retryable errors (408, 500, 502, 503, 504)
        if ([408, 500, 502, 503, 504].includes(response.status) && configIndex < configs.length - 1) {
          const errorText = await response.text();
          lastError = errorText;
          console.log(`Retryable error ${response.status}, trying next config...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // Non-retryable error or last attempt
        break;
      } catch (fetchError: unknown) {
        const error = fetchError as Error;
        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
          console.log(`Attempt ${configIndex + 1} timed out`);
          lastError = 'timeout';
          if (configIndex < configs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        } else {
          console.error('Fetch error:', error.message);
          lastError = error.message;
          break;
        }
      }
    }
    
    // Handle case where all attempts failed
    if (!response) {
      console.error('All scraping attempts failed for:', formattedUrl);
      const errorMsg = lastError === 'timeout' 
        ? 'Site demorou muito para responder. Verifique se a URL está correta.'
        : 'Erro de conexão. Tente novamente em alguns segundos.';
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for non-OK responses before trying to parse JSON
    if (!response.ok) {
      const responseText = await response.text();
      console.error('Firecrawl API error:', response.status, responseText);
      
      // Parse error details if available
      let errorDetail = '';
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.code === 'SCRAPE_TIMEOUT') {
          errorDetail = 'Site demorou muito para carregar. Verifique se a URL está correta e acessível.';
        } else if (errorJson.code === 'SCRAPE_SITE_ERROR') {
          errorDetail = 'Não foi possível acessar o site. Verifique se a URL está correta.';
        }
      } catch {
        // Ignore JSON parse error
      }
      
      // Handle common error statuses
      if (response.status === 408) {
        return new Response(
          JSON.stringify({ success: false, error: errorDetail || 'Site demorou muito para responder. Tente novamente.' }),
          { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 500) {
        return new Response(
          JSON.stringify({ success: false, error: errorDetail || 'Erro ao processar a página. Verifique se a URL está correta.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        return new Response(
          JSON.stringify({ success: false, error: 'Serviço temporariamente indisponível. Tente novamente em alguns segundos.' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições atingido. Aguarde um momento.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorDetail || `Erro ao acessar a página (${response.status})` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Now safely parse JSON for successful responses
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      return new Response(
        JSON.stringify({ success: false, error: 'Resposta inválida do serviço de scraping' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = data.data?.html || data.html || '';
    const rawHtml = data.data?.rawHtml || data.rawHtml || html;
    const fullHtml = html + '\n' + rawHtml; // Combine both for maximum coverage
    const markdown = data.data?.markdown || data.markdown || html;
    const images: string[] = [];
    
    // === PRIORITY 1: Open Graph and Twitter meta images (most reliable for product pages) ===
    const metaImagePatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/gi,
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/gi,
      /<meta[^>]+property=["']product:image["'][^>]+content=["']([^"']+)["']/gi,
    ];
    
    for (const pattern of metaImagePatterns) {
      let match;
      while ((match = pattern.exec(fullHtml)) !== null) {
        let imgUrl = match[1];
        if (imgUrl && !imgUrl.includes('logo') && imgUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
          if (imgUrl.startsWith('//')) {
            imgUrl = 'https:' + imgUrl;
          }
          if (!images.includes(imgUrl)) {
            console.log('Found meta image:', imgUrl);
            images.push(imgUrl);
          }
        }
      }
    }
    
    // === PRIORITY 2: JSON-LD structured data (very reliable for e-commerce) ===
    const jsonLdMatch = fullHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const jsonLd of jsonLdMatch) {
        try {
          const jsonContent = jsonLd.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const parsed = JSON.parse(jsonContent);
          
          // Handle direct Product type
          if (parsed['@type'] === 'Product' && parsed.image) {
            const productImages = Array.isArray(parsed.image) ? parsed.image : [parsed.image];
            for (const img of productImages) {
              const imgUrl = typeof img === 'string' ? img : img.url || img.contentUrl;
              if (imgUrl && !images.includes(imgUrl)) {
                console.log('Found JSON-LD product image:', imgUrl);
                images.push(imgUrl);
              }
            }
          }
          
          // Handle @graph array
          if (parsed['@graph']) {
            for (const item of parsed['@graph']) {
              if (item['@type'] === 'Product' && item.image) {
                const productImages = Array.isArray(item.image) ? item.image : [item.image];
                for (const img of productImages) {
                  const imgUrl = typeof img === 'string' ? img : img.url || img.contentUrl;
                  if (imgUrl && !images.includes(imgUrl)) {
                    console.log('Found JSON-LD graph product image:', imgUrl);
                    images.push(imgUrl);
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }
    
    // === PRIORITY 3: E-commerce specific classes and attributes ===
    const ecommercePatterns = [
      // Common e-commerce class patterns
      /<img[^>]+class=["'][^"']*(?:product-image|main-image|gallery-image|product-photo|produto-img|foto-produto|primary-image|featured-image|product-main|swiper-slide|carousel-item|gallery-item|thumb|miniatura)[^"']*["'][^>]+src=["']([^"']+)["']/gi,
      /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*(?:product-image|main-image|gallery-image|product-photo|produto-img|foto-produto|primary-image|featured-image|product-main|swiper-slide|carousel-item|gallery-item|thumb|miniatura)[^"']*["']/gi,
      // Data attributes common in galleries and lazy loading
      /<[^>]+data-zoom-image=["']([^"']+)["']/gi,
      /<[^>]+data-large-image=["']([^"']+)["']/gi,
      /<[^>]+data-image=["']([^"']+)["']/gi,
      /<[^>]+data-original=["']([^"']+)["']/gi,
      /<[^>]+data-lazy=["']([^"']+)["']/gi,
      /<[^>]+data-lazy-src=["']([^"']+)["']/gi,
      /<[^>]+data-srcset=["']([^"'\s,]+)/gi,
      /<[^>]+data-full-image=["']([^"']+)["']/gi,
      /<[^>]+data-bg=["']([^"']+)["']/gi,
      // Picture/source srcset patterns (high quality images)
      /<source[^>]+srcset=["']([^"'\s,]+)/gi,
      // Images inside product containers
      /<div[^>]+class=["'][^"']*(?:product-gallery|product-images|gallery|carousel|slider|zoom|swiper|splide|glide|flickity)[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi,
      // Brazilian e-commerce platforms patterns (VTEX, Tray, Nuvemshop, etc.)
      /<img[^>]+data-zoom=["']([^"']+)["']/gi,
      /<[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)[^"']*["'][^>]*class=["'][^"']*(?:gallery|zoom|lightbox|fancybox)[^"']*["']/gi,
      /<a[^>]+class=["'][^"']*(?:gallery|zoom|lightbox|fancybox)[^"']*["'][^>]+href=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)[^"']*["']/gi,
    ];
    
    for (const pattern of ecommercePatterns) {
      let match;
      while ((match = pattern.exec(fullHtml)) !== null) {
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
        
        if (!images.includes(imgUrl) && imgUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)) {
          console.log('Found e-commerce pattern image:', imgUrl);
          images.push(imgUrl);
        }
      }
    }
    
    // === PRIORITY 4: Generic img tags (fallback) - only if we don't have enough images ===
    if (images.length < 8) {
      const imgRegex = /<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["'][^>]*>/gi;
      let match;
      
      while ((match = imgRegex.exec(fullHtml)) !== null) {
        let imgUrl = match[1];
        
        if (imgUrl.includes('data:image') && imgUrl.length < 200) continue;
        if (imgUrl.includes('pixel') || imgUrl.includes('tracking')) continue;
        if (imgUrl.includes('icon') && imgUrl.length < 50) continue;
        if (imgUrl.includes('logo') && !imgUrl.includes('product')) continue;
        if (imgUrl.includes('banner') && !imgUrl.includes('product')) continue;
        if (imgUrl.includes('placeholder')) continue;
        
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
          imgUrl.includes('arquivos') ||
          imgUrl.match(/\.(jpg|jpeg|png|webp)/i);
        
        if (isLikelyProductImage && !images.includes(imgUrl)) {
          images.push(imgUrl);
        }
      }
    }

    // Also look for data-src attributes (lazy loaded images)
    const dataSrcRegex = /(?:data-src|data-lazy|data-original|data-zoom)=["']([^"']+)["']/gi;
    let match;
    while ((match = dataSrcRegex.exec(fullHtml)) !== null) {
      let imgUrl = match[1];
      if (imgUrl.includes('data:image')) continue;
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        const urlObj = new URL(formattedUrl);
        imgUrl = urlObj.origin + imgUrl;
      }
      if (imgUrl.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i) && !images.includes(imgUrl)) {
        console.log('Found lazy-loaded image:', imgUrl);
        images.push(imgUrl);
      }
    }

    // Look for background-image in style
    const bgRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
    while ((match = bgRegex.exec(fullHtml)) !== null) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        const urlObj = new URL(formattedUrl);
        imgUrl = urlObj.origin + imgUrl;
      }
      if (imgUrl.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i) && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // Extract product name from metadata or title
    let productName = '';
    const titleMatch = fullHtml.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      productName = titleMatch[1].split('|')[0].split('-')[0].trim();
    }
    
    // Try og:title as well
    const ogTitleMatch = fullHtml.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogTitleMatch && ogTitleMatch[1].length > productName.length) {
      productName = ogTitleMatch[1].split('|')[0].split('-')[0].trim();
    }

    // Try h1 tag for product name
    const h1Match = fullHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match && h1Match[1].trim().length > 3) {
      productName = h1Match[1].trim();
    }

    // Try product name from JSON-LD - ONLY accept @type Product (use fullHtml to include rawHtml with scripts)
    const jsonLdForName = fullHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdForName) {
      for (const jsonLd of jsonLdForName) {
        try {
          const jsonContent = jsonLd.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const parsed = JSON.parse(jsonContent);
          if (parsed['@type'] === 'Product' && parsed.name) {
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
        // Para URLs Dooca (produto/cor), usar penúltimo segmento como nome
        const slug = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : pathParts[pathParts.length - 1];
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
