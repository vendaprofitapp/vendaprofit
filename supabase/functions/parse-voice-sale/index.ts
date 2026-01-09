import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ai-provider, x-ai-key",
};

function buildSystemPrompt(productList: string) {
  return `Você é um assistente de vendas inteligente. Analise o comando de voz do usuário e extraia as informações da venda.

PRODUTOS DISPONÍVEIS DO USUÁRIO:
${productList}

FORMAS DE PAGAMENTO ACEITAS:
- "dinheiro" (dinheiro, cash, espécie)
- "pix" (pix)
- "credito" (crédito, cartão de crédito, credito)
- "debito" (débito, cartão de débito, debito)
- "boleto" (boleto)

INSTRUÇÕES:
1. Identifique a QUANTIDADE (número mencionado, padrão: 1)
2. Identifique o PRODUTO (busque o mais similar na lista de produtos disponíveis)
3. Identifique a FORMA DE PAGAMENTO (se mencionada)
4. Identifique o NOME DO CLIENTE (se mencionado)

IMPORTANTE:
- Faça correspondência fuzzy do nome do produto (ex: "top carol" deve encontrar "Top Carol Fitness")
- Se não encontrar produto exato, sugira o mais similar
- Normalize a forma de pagamento para os valores aceitos

Responda APENAS com um JSON válido no formato:
{
  "success": true/false,
  "quantity": número,
  "productId": "id do produto encontrado ou null",
  "productName": "nome do produto encontrado",
  "paymentMethod": "dinheiro|pix|credito|debito|boleto ou null",
  "customerName": "nome do cliente ou null",
  "confidence": 0.0-1.0,
  "message": "mensagem explicativa"
}`;
}

// Call Lovable AI Gateway
async function callLovableAI(systemPrompt: string, voiceText: string, apiKey: string) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Comando de voz: "${voiceText}"` }
      ],
    }),
  });
}

// Call OpenAI API
async function callOpenAI(systemPrompt: string, voiceText: string, apiKey: string) {
  console.log("Using OpenAI API");
  
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Comando de voz: "${voiceText}"` }
      ],
      max_tokens: 1024,
    }),
  });
}

// Call direct Gemini API
async function callGeminiDirect(systemPrompt: string, voiceText: string, apiKey: string) {
  console.log("Using Gemini direct API");
  
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nComando de voz: "${voiceText}"` }]
      }],
      generationConfig: { temperature: 0.1 }
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voiceText, userId } = await req.json();

    if (!voiceText) {
      return new Response(
        JSON.stringify({ error: "Texto de voz não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client to fetch user's products
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's products for context
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, stock_quantity, category, color, size")
      .eq("owner_id", userId)
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .order("name");

    if (productsError) {
      console.error("Error fetching products:", productsError);
    }

    const productList = products?.map(p => 
      `- "${p.name}" (ID: ${p.id}, Preço: R$${p.price}, Estoque: ${p.stock_quantity}${p.color ? `, Cor: ${p.color}` : ''}${p.size ? `, Tam: ${p.size}` : ''})`
    ).join("\n") || "Nenhum produto cadastrado";

    const systemPrompt = buildSystemPrompt(productList);

    // Get user-provided AI config from headers (BYOK)
    const userProvider = req.headers.get("x-ai-provider") as "gemini" | "openai" | null;
    const userKey = req.headers.get("x-ai-key");

    // If user provided their own key, use it directly
    if (userKey && userProvider) {
      console.log(`Using user-provided ${userProvider} key`);
      
      try {
        let response;
        if (userProvider === "openai") {
          response = await callOpenAI(systemPrompt, voiceText, userKey);
        } else {
          response = await callGeminiDirect(systemPrompt, voiceText, userKey);
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`${userProvider} error:`, response.status, errorText);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Erro ao processar com ${userProvider}. Verifique sua chave API.` 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await response.json();
        let content;
        
        if (userProvider === "openai") {
          content = data.choices?.[0]?.message?.content;
        } else {
          content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        }

        if (!content) {
          throw new Error("Resposta vazia da IA");
        }

        // Parse JSON response
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        const jsonStr = jsonMatch[1]?.trim() || content.trim();
        const parsed = JSON.parse(jsonStr);

        console.log("Voice command parsed with user key:", { voiceText, parsed });
        return new Response(
          JSON.stringify(parsed),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (userKeyError) {
        console.error("Error with user key:", userKeyError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Erro ao usar sua chave API. Verifique as configurações." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback to system keys
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Configure sua chave de IA nas configurações para usar este recurso." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let response;
    let useGeminiFallback = false;

    // Try Lovable AI first
    if (LOVABLE_API_KEY) {
      response = await callLovableAI(systemPrompt, voiceText, LOVABLE_API_KEY);
      
      if (response.status === 402 && GEMINI_API_KEY) {
        console.log("Lovable credits exhausted, using Gemini fallback...");
        useGeminiFallback = true;
      } else if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Limite de requisições excedido. Tente novamente em alguns segundos." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      useGeminiFallback = true;
    }

    // Use Gemini direct API as fallback
    if (useGeminiFallback && GEMINI_API_KEY) {
      response = await callGeminiDirect(systemPrompt, voiceText, GEMINI_API_KEY);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);
        throw new Error("Erro ao processar comando de voz");
      }

      const geminiResponse = await response.json();
      const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error("Resposta vazia da IA");
      }

      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      const parsed = JSON.parse(jsonStr);

      console.log("Voice command parsed (Gemini):", { voiceText, parsed });
      return new Response(
        JSON.stringify(parsed),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle Lovable AI response
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "No response";
      console.error("AI API error:", response?.status, errorText);
      throw new Error("Erro ao processar comando de voz");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1]?.trim() || content.trim();
    const parsed = JSON.parse(jsonStr);

    console.log("Voice command parsed:", { voiceText, parsed });
    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-voice-sale:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
