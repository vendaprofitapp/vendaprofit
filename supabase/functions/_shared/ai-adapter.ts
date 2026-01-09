// AI Provider Adapter - Shared utilities for multi-provider AI support

export interface AIConfig {
  provider: "gemini" | "openai";
  apiKey: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface TranscriptionResult {
  transcription?: string;
  error?: string;
}

export interface ChatResult {
  content?: string;
  error?: string;
}

// Get AI config from request headers and fallback to system keys
export function getAIConfig(req: Request): AIConfig {
  const userProvider = req.headers.get("x-ai-provider") as "gemini" | "openai" | null;
  const userKey = req.headers.get("x-ai-key");

  // User-provided key takes priority
  if (userKey && userProvider) {
    return { provider: userProvider, apiKey: userKey };
  }

  // Fallback to system keys
  const systemGeminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  const systemLovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (systemLovableKey) {
    return { provider: "gemini", apiKey: systemLovableKey };
  }

  if (systemGeminiKey) {
    return { provider: "gemini", apiKey: systemGeminiKey };
  }

  throw new Error("Nenhuma chave de API encontrada. Configure sua chave nas configurações.");
}

// Call Gemini API (via Lovable gateway or direct)
export async function callGeminiChat(
  apiKey: string, 
  messages: ChatMessage[],
  useLovableGateway: boolean = true
): Promise<Response> {
  if (useLovableGateway) {
    return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });
  }

  // Direct Gemini API call
  const systemMessage = messages.find(m => m.role === "system");
  const userMessage = messages.find(m => m.role === "user");
  const prompt = `${systemMessage?.content || ""}\n\n${typeof userMessage?.content === "string" ? userMessage.content : ""}`;

  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    }),
  });
}

// Call OpenAI API
export async function callOpenAIChat(apiKey: string, messages: ChatMessage[]): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 4096,
    }),
  });
}

// Parse response from either provider
export function parseGeminiResponse(data: any): string | null {
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

export function parseOpenAIResponse(data: any): string | null {
  return data.choices?.[0]?.message?.content || null;
}

export function parseLovableResponse(data: any): string | null {
  return data.choices?.[0]?.message?.content || null;
}

// Audio transcription via Gemini
export async function transcribeWithGemini(
  audioBase64: string,
  mimeType: string,
  apiKey: string,
  useLovableGateway: boolean = true
): Promise<TranscriptionResult> {
  const systemPrompt = `Você é um assistente de transcrição de áudio em português brasileiro. 
Sua tarefa é transcrever exatamente o que foi dito no áudio.
Retorne APENAS o texto transcrito, sem explicações adicionais.
Se não conseguir entender o áudio, retorne "AUDIO_UNCLEAR".`;

  if (useLovableGateway) {
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
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva o áudio a seguir para texto em português:" },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${audioBase64}` } }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      return { error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const transcription = parseLovableResponse(data)?.trim();

    if (!transcription || transcription === "AUDIO_UNCLEAR") {
      return { error: "Não foi possível entender o áudio" };
    }

    return { transcription };
  }

  // Direct Gemini call would go here if needed
  return { error: "Direct Gemini transcription not implemented" };
}

// Audio transcription via OpenAI Whisper
export async function transcribeWithOpenAI(
  audioBase64: string,
  mimeType: string,
  apiKey: string
): Promise<TranscriptionResult> {
  // Convert base64 to blob for OpenAI
  const audioBlob = base64ToBlob(audioBase64, mimeType);
  
  const formData = new FormData();
  formData.append("file", audioBlob, `audio.${mimeType.split("/")[1] || "webm"}`);
  formData.append("model", "whisper-1");
  formData.append("language", "pt");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI Whisper error:", errorText);
    return { error: "Erro ao transcrever áudio" };
  }

  const data = await response.json();
  return { transcription: data.text };
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
