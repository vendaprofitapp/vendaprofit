 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 serve(async (req) => {
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
         JSON.stringify({ success: false, error: 'Serviço de scraping não configurado' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     let formattedUrl = url.trim();
     if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
       formattedUrl = `https://${formattedUrl}`;
     }
 
     console.log('Scraping product data from:', formattedUrl);
 
      // Scrape with extract format for structured data
     const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKey}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         url: formattedUrl,
          formats: ['markdown', 'extract'],
          extract: {
            prompt: `Extract product information from this e-commerce page. Return a JSON object with these fields:
              - name: product name/title
              - description: product description (full text)
              - price: numeric price value (just the number, no currency symbol)
              - brand: brand or manufacturer name
              - sku: product code/SKU/reference
              - category: product category
              - color: product color if mentioned
              - material: material/fabric if mentioned
              - sizes: array of available sizes if listed
              
              Only include fields that are clearly present on the page. Return null for missing fields.`
          },
         onlyMainContent: true,
         waitFor: 2000,
       }),
     });
 
     const data = await response.json();
 
     if (!response.ok) {
       console.error('Firecrawl API error:', data);
       return new Response(
         JSON.stringify({ success: false, error: data.error || `Erro ${response.status}` }),
         { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Extract product data from response
      const productData = data.data?.extract || data.extract || {};
     
     // Now get images separately with better extraction
     const imagesResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKey}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         url: formattedUrl,
         formats: ['html'],
         onlyMainContent: false,
         waitFor: 2000,
       }),
     });
 
     const imagesData = await imagesResponse.json();
     const html = imagesData.data?.html || imagesData.html || '';
     
     // Extract images from HTML
     const images: string[] = [];
     
     // Try JSON-LD first
     const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
     if (jsonLdMatch) {
       for (const match of jsonLdMatch) {
         try {
           const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
           const jsonData = JSON.parse(jsonContent);
           
           const extractImages = (obj: any): string[] => {
             const imgs: string[] = [];
             if (obj.image) {
               if (typeof obj.image === 'string') imgs.push(obj.image);
               else if (Array.isArray(obj.image)) {
                 obj.image.forEach((img: any) => {
                   if (typeof img === 'string') imgs.push(img);
                   else if (img.url) imgs.push(img.url);
                 });
               }
               else if (obj.image.url) imgs.push(obj.image.url);
             }
             return imgs;
           };
           
           if (Array.isArray(jsonData)) {
             jsonData.forEach(item => images.push(...extractImages(item)));
           } else {
             images.push(...extractImages(jsonData));
           }
         } catch (e) {
           // Continue
         }
       }
     }
     
     // Fallback to img tags if no JSON-LD images
     if (images.length === 0) {
       const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
       let imgMatch;
       while ((imgMatch = imgRegex.exec(html)) !== null) {
         const src = imgMatch[1];
         if (src && !src.includes('icon') && !src.includes('logo') && 
             !src.includes('banner') && !src.includes('avatar') &&
             (src.includes('product') || src.includes('cdn') || src.includes('vtex') ||
              src.match(/\.(jpg|jpeg|png|webp)/i))) {
           // Normalize URL
           let fullUrl = src;
           if (src.startsWith('//')) fullUrl = 'https:' + src;
           else if (src.startsWith('/')) {
             const urlObj = new URL(formattedUrl);
             fullUrl = urlObj.origin + src;
           }
           if (!images.includes(fullUrl)) images.push(fullUrl);
         }
       }
     }
     
     // Filter and deduplicate images, prefer high-res
     const cleanImages = images
       .filter(img => img && img.startsWith('http'))
       .map(img => {
         // Try to get higher resolution
         return img
           .replace(/-\d+x\d+\./, '.')
           .replace(/\?.*$/, '')
           .replace(/\/\d+x\d+\//, '/');
       })
       .filter((img, idx, arr) => arr.indexOf(img) === idx)
       .slice(0, 10);
 
     const result = {
       success: true,
       product: {
         ...productData,
         images: cleanImages.length > 0 ? cleanImages : undefined,
       },
     };
 
     console.log('Product data extracted:', Object.keys(result.product));
     
     return new Response(
       JSON.stringify(result),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('Error scraping product:', error);
     const errorMessage = error instanceof Error ? error.message : 'Erro ao processar';
     return new Response(
       JSON.stringify({ success: false, error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });