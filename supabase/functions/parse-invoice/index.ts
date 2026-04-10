import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ai-provider, x-ai-key',
};

const INVOICE_PROMPT = `Analise esta imagem de nota fiscal e extraia os produtos listados.

IMPORTANTE: O sistema usa o modelo "Cor por Produto", onde cada combinação de modelo+cor é um produto separado.
O nome do produto DEVE INCLUIR A COR. A única variante permitida é TAMANHO.

Exemplos de como montar o nome:
- "CROPPED AMANDA PRETO G" → name: "CROPPED AMANDA PRETO", size: "G"
- "VESTIDO MARIA OFF WHITE P" → name: "VESTIDO MARIA OFF WHITE", size: "P"
- "BLUSA FLORAL AZUL MARINHO GG" → name: "BLUSA FLORAL AZUL MARINHO", size: "GG"
- "CALÇA JEANS CLARA 38" → name: "CALÇA JEANS CLARA", size: "38"

Cores comuns: PRETO, BRANCO, OFF WHITE, AZUL, VERMELHO, VERDE, ROSA, BEGE, MARROM, CINZA, AMARELO, LARANJA, ROXO, NUDE, CARAMELO, MARSALA, BORDÔ, CREME, CORAL, LILÁS, VINHO, GRAFITE, MOSTARDA, TERRACOTA, MILITAR, MARINHO, etc.

Tamanhos comuns: PP, P, M, G, GG, XG, XXG, EXG, EXGG, ÚNICO, UN, 34, 36, 38, 40, 42, 44, 46, 48, 50, etc.

Para cada produto encontrado, extraia:
- name: nome do produto COM a cor incluída, SEM o tamanho (ex: "TOP CAROL VERMELHO")
- color: cor extraída (ex: "VERMELHO") - será usada como color_label do produto
- size: tamanho extraído (ex: "G", "38", etc.)
- cost_price: preço de custo/unitário (Obrigatório usar ponto '.' como decimal, ex: 35.90. NÃO USE VÍRGULA '35,90')
- quantity: quantidade (apenas números)
- supplier: nome do fornecedor/empresa emissora da nota
- original_name: nome original completo como está na nota (para referência)

Retorne APENAS um JSON válido no formato:
{
  "supplier": "nome do fornecedor da nota",
  "products": [
    {
      "name": "nome do produto COM cor, SEM tamanho",
      "original_name": "nome original completo",
      "color": "cor extraída",
      "size": "tamanho ou null",
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

async function callGeminiDirect(imageBase64: string, mimeType: string, apiKey: string, model: string = "gemini-2.5-flash") {
  console.log(`Using Gemini direct API with ${model}`);
  
    const requestBody: Record<string, unknown> = {
      contents: [{
        parts: [
          { text: INVOICE_PROMPT },
          { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } }
        ]
      }],
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.1,
        // Disable thinking on 2.5 models to prevent token budget exhaustion
        ...(model.startsWith("gemini-2.5") ? { thinking_config: { thinking_budget: 0 } } : {})
      }
    };
    
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
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

function fixBrazilianDecimals(jsonStr: string): string {
  // Fix Brazilian decimal commas in numeric values (e.g. 79,90 → 79.90)
  return jsonStr.replace(/:\s*(\d+),(\d{1,2})(\s*[,}\]\r\n])/g, ': $1.$2$3');
}

function fixTruncatedJson(jsonStr: string): string {
  // If JSON was truncated mid-generation, try to close it properly
  let fixed = jsonStr.trim();
  
  // Remove trailing incomplete key-value (e.g. '"name": "BLUSA RO' )
  fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '');
  fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  fixed = fixed.replace(/,\s*"[^"]*$/, '');
  // Remove trailing comma
  fixed = fixed.replace(/,\s*$/, '');
  
  // Count open/close braces and brackets
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  
  // Close any open brackets and braces
  for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
  for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
  
  return fixed;
}

function parseAIResponse(content: string) {
  let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Fix missing array commas: }{ → },{  
  cleanContent = cleanContent.replace(/\}\s*\{/g, '},{');
  
  // Fix Brazilian decimal commas BEFORE parsing
  cleanContent = fixBrazilianDecimals(cleanContent);
  
  try {
    return JSON.parse(cleanContent);
  } catch (e) {
    console.error("First parse failed. Error:", e, "Content preview:", cleanContent.substring(0, 500));
    
    // Try fixing truncated JSON
    try {
      const truncFixed = fixTruncatedJson(cleanContent);
      console.log("Trying truncation fix...");
      return JSON.parse(truncFixed);
    } catch (e2) {
      // ignore
    }
    
    // Try to extract the outermost JSON object
    const match = cleanContent.match(/\{[\s\S]*\}/);
    if (match) {
      let extracted = match[0];
      extracted = extracted.replace(/\}\s*\{/g, '},{');
      extracted = fixBrazilianDecimals(extracted);
      try {
        return JSON.parse(extracted);
      } catch (e3) {
        // Try truncation fix on extracted
        try {
          return JSON.parse(fixTruncatedJson(extracted));
        } catch (e4) {
          console.error("All parse attempts failed");
        }
      }
    }
    throw e;
  }
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
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user-provided AI config from headers (BYOK)
    const userProvider = req.headers.get("x-ai-provider") as "gemini" | "openai" | null;
    const userKey = req.headers.get("x-ai-key");

    // If user provided their own key, try it first but fall back to system keys
    if (userKey && userProvider) {
      console.log(`Using user-provided ${userProvider} key`);
      
      try {
        let response;
        if (userProvider === "openai") {
          response = await callOpenAI(imageBase64, mimeType, userKey);
        } else {
          response = await callGeminiDirect(imageBase64, mimeType, userKey, "gemini-2.5-flash");
          // Internal fallback for user key
          if (!response.ok && (response.status === 503 || response.status === 429)) {
            console.log("User key hit 503/429 on 2.5, falling back to 1.5-pro");
            response = await callGeminiDirect(imageBase64, mimeType, userKey, "gemini-1.5-pro");
          }
        }

        if (response.ok) {
          const data = await response.json();
          let content;
          
          if (userProvider === "openai") {
            content = data.choices?.[0]?.message?.content;
          } else {
            content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          }

          if (content) {
            const parsedData = parseAIResponse(content);
            return new Response(
              JSON.stringify({ success: true, data: parsedData }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          const errorText = await response.text();
          console.error(`${userProvider} error:`, response.status, errorText);
          console.log("User key failed, falling back to system keys...");
        }
      } catch (userKeyError) {
        console.error("Error with user key:", userKeyError);
        console.log("User key failed, falling back to system keys...");
      }
    }

    // System keys - try Gemini first (user's paid key), then OpenAI, then Lovable AI as fallback
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY && !OPENAI_API_KEY) {
      console.error('No API key configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Serviço de IA não configurado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing invoice image...');

    // Try Gemini direct first (user's paid key - no rate limits)
    if (GEMINI_API_KEY) {
      console.log('Using paid Gemini API key...');
      
      try {
        let response = await callGeminiDirect(imageBase64, mimeType, GEMINI_API_KEY, "gemini-2.5-flash");
        
        // internal fallback to 1.5-pro if 503/429
        if (!response.ok && (response.status === 503 || response.status === 429)) {
          console.log('Gemini 2.5 congested. Falling back to Gemini 1.5 Pro...');
          response = await callGeminiDirect(imageBase64, mimeType, GEMINI_API_KEY, "gemini-1.5-pro");
          
          if (!response.ok && (response.status === 503 || response.status === 429)) {
             console.log('Gemini 1.5 Pro also congested. Falling back to Gemini 1.5 Flash...');
             response = await callGeminiDirect(imageBase64, mimeType, GEMINI_API_KEY, "gemini-1.5-flash");
          }
        }
        
        if (response.ok) {
          const data = await response.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (content) {
            console.log('Gemini response received, parsing...');
            const parsedData = parseAIResponse(content);
            
            return new Response(
              JSON.stringify({ success: true, data: parsedData }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          const errorText = await response.text();
          console.error('Gemini API error:', response.status, errorText);
          
          // If it fails with ANY error (like 503 or 429) and we have fallback keys, just continue to fallbacks
          if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
            return new Response(
              JSON.stringify({ success: false, error: `Gemini Error ${response.status}: ${errorText}` }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            console.log('Gemini failed, trying fallback options...');
          }
        }
      } catch (geminiError) {
        console.error('Gemini error:', geminiError);
        if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
          const errorMessage = geminiError instanceof Error ? geminiError.message : 'Erro na API do Gemini';
          return new Response(
            JSON.stringify({ success: false, error: `Falha na leitura: A IA retornou um formato inválido (${errorMessage}). Tente tirar a foto mais de perto.` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fallback to OpenAI API
    if (OPENAI_API_KEY) {
      console.log('Using OpenAI API as fallback...');
      
      try {
        const response = await callOpenAI(imageBase64, mimeType, OPENAI_API_KEY);
        
        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (content) {
            console.log('OpenAI response received, parsing...');
            const parsedData = parseAIResponse(content);
            
            return new Response(
              JSON.stringify({ success: true, data: parsedData }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          const errorText = await response.text();
          console.error('OpenAI API error:', response.status, errorText);
          if (!LOVABLE_API_KEY) {
            return new Response(
              JSON.stringify({ success: false, error: `OpenAI Error ${response.status}: ${errorText}` }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (openaiError) {
        console.error('OpenAI error:', openaiError);
        if (!LOVABLE_API_KEY) {
          return new Response(
            JSON.stringify({ success: false, error: `Erro na leitura (OpenAI): ${openaiError}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fallback to Lovable AI
    if (LOVABLE_API_KEY) {
      console.log('Using Lovable AI as fallback...');
      
      const response = await callLovableAI(imageBase64, mimeType, LOVABLE_API_KEY);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições excedido. Aguarde alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos de IA esgotados. Tente novamente mais tarde.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Lovable AI error:', response.status, errorData);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao processar imagem. Tente novamente.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return new Response(
          JSON.stringify({ success: false, error: 'Resposta vazia da IA. Tente uma imagem mais clara.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Lovable AI response received, parsing...');
      const parsedData = parseAIResponse(content);

      return new Response(
        JSON.stringify({ success: true, data: parsedData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Nenhum serviço de IA disponível.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
