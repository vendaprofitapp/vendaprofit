import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function callLovableAI(systemPrompt: string, voiceText: string, apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      temperature: 0.1,
    }),
  });

  return response;
}

async function callGeminiDirect(systemPrompt: string, voiceText: string, apiKey: string) {
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
            { text: `${systemPrompt}\n\nComando de voz: "${voiceText}"` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1
      }
    }),
  });

  return response;
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      throw new Error("Nenhuma API key configurada");
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

    let response;
    let useGeminiFallback = false;

    // Try Lovable AI first
    if (LOVABLE_API_KEY) {
      response = await callLovableAI(systemPrompt, voiceText, LOVABLE_API_KEY);
      
      // Check if we need to fallback to Gemini (credits exhausted)
      if (response.status === 402 && GEMINI_API_KEY) {
        console.log("Lovable credits exhausted, using Gemini fallback...");
        useGeminiFallback = true;
      } else if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
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

      // Parse JSON response (handle markdown code blocks)
      let parsed;
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        const jsonStr = jsonMatch[1]?.trim() || content.trim();
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Error parsing Gemini response:", content);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Não foi possível interpretar o comando",
            rawResponse: content 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

    // Parse JSON response (handle markdown code blocks)
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Error parsing AI response:", content);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Não foi possível interpretar o comando",
          rawResponse: content 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
