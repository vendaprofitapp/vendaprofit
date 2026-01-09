import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELS_TO_TRY = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-mini",
];

async function callLovableAI(audioBase64: string, mimeType: string, apiKey: string, model: string) {
  console.log(`Trying Lovable AI with model: ${model}`);
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: `Você é um assistente de transcrição de áudio em português brasileiro. 
Sua tarefa é transcrever exatamente o que foi dito no áudio.
Retorne APENAS o texto transcrito, sem explicações adicionais.
Se não conseguir entender o áudio, retorne "AUDIO_UNCLEAR".`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcreva o áudio a seguir para texto em português:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType || "audio/webm"};base64,${audioBase64}`
              }
            }
          ]
        }
      ],
    }),
  });

  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, mimeType } = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: "Audio data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let lastError = null;

    // Try each model until one works
    for (const model of MODELS_TO_TRY) {
      try {
        const response = await callLovableAI(audioBase64, mimeType, LOVABLE_API_KEY, model);
        
        if (response.status === 429) {
          console.log(`Model ${model} rate limited, trying next...`);
          lastError = "rate_limit";
          continue;
        }
        
        if (response.status === 402) {
          console.log(`Credits exhausted for model ${model}, trying next...`);
          lastError = "credits_exhausted";
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Model ${model} error:`, response.status, errorText);
          lastError = errorText;
          continue;
        }

        const data = await response.json();
        const transcription = data.choices?.[0]?.message?.content?.trim() || "";

        if (transcription === "AUDIO_UNCLEAR" || !transcription) {
          return new Response(
            JSON.stringify({ error: "Não foi possível entender o áudio. Tente falar mais claramente." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Transcription successful with ${model}:`, transcription);

        return new Response(
          JSON.stringify({ transcription }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (modelError) {
        console.error(`Error with model ${model}:`, modelError);
        lastError = modelError;
        continue;
      }
    }

    // All models failed
    console.error("All models failed. Last error:", lastError);
    
    const errorMessage = lastError === "rate_limit" 
      ? "Limite de requisições excedido. Aguarde alguns segundos e tente novamente."
      : lastError === "credits_exhausted"
      ? "Serviço temporariamente indisponível. Tente novamente mais tarde."
      : "Erro ao transcrever áudio. Tente novamente.";
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});