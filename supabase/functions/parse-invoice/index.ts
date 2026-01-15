import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ai-provider, x-ai-key',
};

const INVOICE_PROMPT = `Analise esta imagem de nota fiscal e extraia os produtos listados.
                
Para cada produto encontrado, extraia:
- nome: nome do produto
- sku: código SKU se disponível (pode ser código de barras, referência, etc)
- size: tamanho (PP, P, M, G, GG, XG, XXG ou outro)
- color: cor do produto
- cost_price: preço de custo/unitário (apenas números, sem símbolos de moeda)
- quantity: quantidade (apenas números)
- supplier: nome do fornecedor/empresa emissora da nota

Retorne APENAS um JSON válido no formato:
{
  "supplier": "nome do fornecedor da nota",
  "products": [
    {
      "name": "nome do produto",
      "sku": "código ou null",
      "size": "tamanho ou null",
      "color": "cor ou null",
      "cost_price": 0.00,
      "quantity": 1
    }
  ]
}

Se não conseguir identificar algum campo, use null. Para números, use 0 se não encontrar.
NÃO inclua markdown, apenas o JSON puro.`;

async function callLovableAI(imageBase64: string, mimeType: string, apiKey: string) {
  return fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: INVOICE_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
        ]
      }],
      max_tokens: 4096
    }),
  });
}

async function callOpenAI(imageBase64: string, mimeType: string, apiKey: string) {
  console.log("Using OpenAI API for image analysis");
  
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: INVOICE_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
        ]
      }],
      max_tokens: 4096
    }),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Imagem não fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user-provided AI config from headers (BYOK)
    const userProvider = req.headers.get("x-ai-provider") as "gemini" | "openai" | null;
    const userKey = req.headers.get("x-ai-key");

    // If user provided their own key, use it directly
    if (userKey && userProvider) {
      console.log(`Using user-provided ${userProvider} key`);
      
      try {
        let response;
        if (userProvider === "openai") {
          response = await callOpenAI(imageBase64, mimeType, userKey);
        } else {
          // For gemini, use Lovable AI gateway with user's model preference
          response = await callLovableAI(imageBase64, mimeType, userKey);
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`${userProvider} error:`, response.status, errorText);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao processar com ${userProvider}. Verifique sua chave API.` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        let content;
        
        if (userProvider === "openai") {
          content = data.choices?.[0]?.message?.content;
        } else {
          content = data.choices?.[0]?.message?.content;
        }

        if (!content) {
          return new Response(
            JSON.stringify({ success: false, error: 'Resposta vazia da IA' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsedData = JSON.parse(cleanContent);

        return new Response(
          JSON.stringify({ success: true, data: parsedData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (userKeyError) {
        console.error("Error with user key:", userKeyError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao usar sua chave API. Verifique as configurações.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Use Lovable AI (system key)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Serviço de IA não configurado. Entre em contato com o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing invoice image with Lovable AI...');

    const response = await callLovableAI(imageBase64, mimeType, LOVABLE_API_KEY);

    // Handle rate limiting errors
    if (response.status === 429) {
      console.error('Rate limit exceeded');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Limite de requisições excedido. Aguarde alguns segundos e tente novamente.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle payment required (credits exhausted)
    if (response.status === 402) {
      console.error('Lovable AI credits exhausted');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Créditos de IA esgotados. Configure sua própria chave de IA nas configurações ou entre em contato com o suporte.' 
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Lovable AI error:', response.status, errorData);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar imagem. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('Empty AI response');
      return new Response(
        JSON.stringify({ success: false, error: 'Resposta vazia da IA. Tente novamente com uma imagem mais clara.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received, parsing...');

    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const parsedData = JSON.parse(cleanContent);
      
      return new Response(
        JSON.stringify({ success: true, data: parsedData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse AI response:', cleanContent);
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível interpretar a nota fiscal. Tente uma imagem mais clara.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error processing invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
