import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: INVOICE_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 4096
    }),
  });

  return response;
}

async function callGeminiDirect(imageBase64: string, mimeType: string, apiKey: string) {
  console.log("Using Gemini direct API as fallback...");
  
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: INVOICE_PROMPT },
            {
              inline_data: {
                mime_type: mimeType || "image/jpeg",
                data: imageBase64
              }
            }
          ]
        }
      ]
    }),
  });

  return response;
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      console.error('No API key configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing invoice image...');

    let response;
    let useGeminiFallback = false;

    // Try Lovable AI first
    if (LOVABLE_API_KEY) {
      response = await callLovableAI(imageBase64, mimeType, LOVABLE_API_KEY);
      
      // Check if we need to fallback to Gemini (credits exhausted)
      if (response.status === 402 && GEMINI_API_KEY) {
        console.log("Lovable credits exhausted, using Gemini fallback...");
        useGeminiFallback = true;
      }
    } else {
      useGeminiFallback = true;
    }

    // Use Gemini direct API as fallback
    if (useGeminiFallback && GEMINI_API_KEY) {
      response = await callGeminiDirect(imageBase64, mimeType, GEMINI_API_KEY);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao processar imagem com IA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        return new Response(
          JSON.stringify({ success: false, error: 'Resposta vazia da IA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Gemini response:', content);

      let parsedData;
      try {
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedData = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao interpretar resposta da IA', raw: content }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: parsedData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle Lovable AI response
    if (!response || !response.ok) {
      const errorData = response ? await response.text() : "No response";
      console.error('AI API error:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar imagem com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response:', content);

    // Parse the JSON response
    let parsedData;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao interpretar resposta da IA', raw: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
