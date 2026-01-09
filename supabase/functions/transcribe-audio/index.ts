import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ai-provider, x-ai-key",
};

// Transcribe with Lovable AI Gateway (Gemini)
async function transcribeWithLovable(audioBase64: string, mimeType: string, apiKey: string, model: string) {
  console.log(`Trying Lovable AI with model: ${model}`);
  
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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
            { type: "text", text: "Transcreva o áudio a seguir para texto em português:" },
            { type: "image_url", image_url: { url: `data:${mimeType || "audio/webm"};base64,${audioBase64}` } }
          ]
        }
      ],
    }),
  });
}

// Transcribe with OpenAI Whisper
async function transcribeWithOpenAI(audioBase64: string, mimeType: string, apiKey: string) {
  console.log("Using OpenAI Whisper for transcription");
  
  // Convert base64 to blob
  const byteCharacters = atob(audioBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const audioBlob = new Blob([byteArray], { type: mimeType || "audio/webm" });
  
  const formData = new FormData();
  formData.append("file", audioBlob, `audio.${(mimeType || "audio/webm").split("/")[1]}`);
  formData.append("model", "whisper-1");
  formData.append("language", "pt");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  return response;
}

// Transcribe with direct Gemini API
async function transcribeWithGeminiDirect(audioBase64: string, mimeType: string, apiKey: string) {
  console.log("Using direct Gemini API for transcription");
  
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: `Transcreva o áudio a seguir para texto em português brasileiro. Retorne APENAS o texto transcrito.` },
          { inline_data: { mime_type: mimeType || "audio/webm", data: audioBase64 } }
        ]
      }]
    }),
  });
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

    // Get user-provided AI config from headers (BYOK)
    const userProvider = req.headers.get("x-ai-provider") as "gemini" | "openai" | null;
    const userKey = req.headers.get("x-ai-key");

    // If user provided their own key, use it directly
    if (userKey && userProvider) {
      console.log(`Using user-provided ${userProvider} key`);
      
      try {
        if (userProvider === "openai") {
          const response = await transcribeWithOpenAI(audioBase64, mimeType, userKey);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenAI error:", response.status, errorText);
            return new Response(
              JSON.stringify({ error: "Erro ao transcrever com OpenAI. Verifique sua chave API." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const data = await response.json();
          return new Response(
            JSON.stringify({ transcription: data.text }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // Gemini with user key
          const response = await transcribeWithGeminiDirect(audioBase64, mimeType, userKey);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini error:", response.status, errorText);
            return new Response(
              JSON.stringify({ error: "Erro ao transcrever com Gemini. Verifique sua chave API." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const data = await response.json();
          const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

          if (!transcription || transcription === "AUDIO_UNCLEAR") {
            return new Response(
              JSON.stringify({ error: "Não foi possível entender o áudio. Tente falar mais claramente." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ transcription }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (userKeyError) {
        console.error("Error with user key:", userKeyError);
        return new Response(
          JSON.stringify({ error: "Erro ao usar sua chave API. Verifique as configurações." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback to system keys
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      console.error("No API key configured");
      return new Response(
        JSON.stringify({ error: "Configure sua chave de IA nas configurações para usar este recurso." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try Lovable AI models first
    const MODELS_TO_TRY = ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "openai/gpt-5-mini"];
    let lastError = null;

    if (LOVABLE_API_KEY) {
      for (const model of MODELS_TO_TRY) {
        try {
          const response = await transcribeWithLovable(audioBase64, mimeType, LOVABLE_API_KEY, model);
          
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

          console.log(`Transcription successful with ${model}`);
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
    }

    // Try direct Gemini as final fallback
    if (GEMINI_API_KEY) {
      console.log("Trying direct Gemini API as final fallback");
      try {
        const response = await transcribeWithGeminiDirect(audioBase64, mimeType, GEMINI_API_KEY);
        
        if (response.ok) {
          const data = await response.json();
          const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

          if (transcription && transcription !== "AUDIO_UNCLEAR") {
            return new Response(
              JSON.stringify({ transcription }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (geminiError) {
        console.error("Direct Gemini fallback error:", geminiError);
      }
    }

    // All methods failed
    console.error("All transcription methods failed. Last error:", lastError);
    
    const errorMessage = lastError === "rate_limit" 
      ? "Limite de requisições excedido. Aguarde alguns segundos e tente novamente."
      : lastError === "credits_exhausted"
      ? "Serviço temporariamente indisponível. Configure sua própria chave de IA nas configurações."
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
