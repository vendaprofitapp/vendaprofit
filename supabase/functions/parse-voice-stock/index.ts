import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voiceText, userId } = await req.json();

    if (!voiceText) {
      return new Response(
        JSON.stringify({ error: "Voice text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's products for context
    const { data: products } = await supabase
      .from("products")
      .select("id, name, category, color, size, sku")
      .eq("owner_id", userId)
      .eq("is_active", true)
      .limit(500);

    const productList = products?.map(p => {
      let label = p.name;
      if (p.color) label += ` ${p.color}`;
      if (p.size) label += ` ${p.size}`;
      if (p.sku) label += ` (SKU: ${p.sku})`;
      return label;
    }).join("\n") || "Nenhum produto cadastrado";

    const systemPrompt = `Você é um assistente de controle de estoque. Analise o comando de voz do usuário e extraia as informações.

PRODUTOS DISPONÍVEIS NO ESTOQUE:
${productList}

REGRAS IMPORTANTES:
1. OPERAÇÃO: Identifique se é ENTRADA ou SAÍDA de estoque:
   - ENTRADA (adicionar ao estoque): incluir, inserir, adicionar, entrada, entrar, receber, chegou, recebi, repor, repondo, colocar, guardando, guardar
   - SAÍDA (remover do estoque): retirar, saída, sair, baixa, baixar, saiu, remover, vender, vendido, tirando, tirar, excluir, removendo

2. QUANTIDADE: Extraia o número mencionado. Se não houver número, use 1.

3. PRODUTO: Encontre o produto mais similar na lista acima. Use correspondência fuzzy:
   - Ignore acentos, maiúsculas/minúsculas
   - "camiseta preta" pode corresponder a "Camiseta Preta M"
   - "calça jeans" pode corresponder a "Calça Jeans Azul 42"
   - Considere abreviações comuns

4. Se não encontrar um produto similar com pelo menos 50% de certeza, retorne productSearch com o termo original.

RESPONDA APENAS com JSON no formato:
{
  "operation": "entry" ou "exit",
  "quantity": número,
  "productSearch": "nome exato do produto da lista ou termo de busca",
  "matchedProduct": "nome do produto correspondente da lista ou null",
  "confidence": número de 0 a 1 indicando certeza da correspondência,
  "rawText": "texto original"
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: voiceText }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({
        success: true,
        command: {
          operation: parsed.operation,
          quantity: parsed.quantity || 1,
          productSearch: parsed.productSearch || parsed.matchedProduct || voiceText,
          matchedProduct: parsed.matchedProduct,
          confidence: parsed.confidence || 0,
          rawText: voiceText,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error parsing voice stock command:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to parse voice command";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
