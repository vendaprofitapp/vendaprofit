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

    const systemPrompt = `Você é um assistente inteligente de controle de estoque. Analise comandos de voz e extraia informações de forma flexível.

PRODUTOS DISPONÍVEIS:
${productList}

REGRAS DE INTERPRETAÇÃO:

1. AÇÃO (action):
   - "add": incluir, inserir, adicionar, entrada, entrar, receber, chegou, recebi, repor, repondo, colocar, guardando, guardar, acrescentar, somar, mais
   - "remove": retirar, saída, sair, baixa, baixar, saiu, remover, vender, vendido, tirando, tirar, excluir, removendo, menos, descontar, subtrair

2. QUANTIDADE (quantity):
   - Extraia números (1, 2, 10) ou por extenso (um=1, dois=2, três=3, quatro=4, cinco=5, seis=6, sete=7, oito=8, nove=9, dez=10)
   - Se não houver número, use 1

3. NOME DO PRODUTO (product_name):
   - Encontre o produto mais similar usando correspondência fuzzy
   - Ignore acentos, maiúsculas/minúsculas, espaços extras
   - "top carol" = "Top Carol", "blusa maria" = "Blusa Maria"
   - Foque no NOME BASE, ignore cor/tamanho mencionados separadamente
   - Se não encontrar correspondência clara, use o termo falado

4. COR DETECTADA (detected_color):
   - Extraia qualquer cor mencionada: preto, branco, azul, vermelho, rosa, verde, amarelo, laranja, roxo, marrom, bege, cinza, nude, vinho, bordô, coral, lilás, dourado, prata, creme, off-white, etc.
   - Considere variações: "pretinho" = "preto", "azulzinho" = "azul"

5. TAMANHO DETECTADO (detected_size):
   - Tamanhos de roupa: PP, P, M, G, GG, XG, XXG, XGG, EXGG
   - Tamanhos numéricos: 34, 36, 38, 40, 42, 44, 46, 48, 50
   - Considere contexto: "tamanho médio" = "M", "grande" = "G", "pequeno" = "P"

6. AMBIGUIDADE (is_ambiguous):
   - true: se o produto tem variantes e a cor/tamanho não ficaram claros
   - true: se há múltiplos produtos similares ao termo buscado
   - false: se conseguiu identificar produto, cor E tamanho com confiança

RESPONDA APENAS em JSON:
{
  "action": "add" ou "remove",
  "quantity": número,
  "product_name": "nome do produto encontrado ou termo buscado",
  "detected_color": "cor extraída ou null",
  "detected_size": "tamanho extraído ou null",
  "is_ambiguous": boolean,
  "confidence": número de 0 a 1,
  "raw_text": "texto original"
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

    // Map to new format
    const action = parsed.action === "add" ? "entry" : "exit";

    return new Response(
      JSON.stringify({
        success: true,
        command: {
          operation: action,
          quantity: parsed.quantity || 1,
          productSearch: parsed.product_name || voiceText,
          matchedProduct: parsed.product_name,
          color: parsed.detected_color || null,
          size: parsed.detected_size || null,
          confidence: parsed.confidence || 0,
          isAmbiguous: parsed.is_ambiguous || false,
          rawText: parsed.raw_text || voiceText,
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
