import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_HOURS = 1;

const FITTING_ROOM_PROMPT = (productName: string) => `You are a virtual fitting room AI. Your task is to create a realistic image of the person in the first photo wearing the clothing item shown in the second photo.

Instructions:
- The person's face, body type, skin tone, and pose should be preserved from their original photo
- The clothing item "${productName}" from the second image should be realistically placed on the person
- Maintain proper proportions, shadows, and lighting to make the result look natural
- The clothing should fit naturally on the person's body
- Keep the background similar to the original person's photo
- Make the final image look like a real photo, not a collage

Create a high-quality, realistic image of this person wearing this exact clothing item.`;

async function callLovableAI(userImage: string, productImage: string, productName: string, apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: FITTING_ROOM_PROMPT(productName) },
            { type: "image_url", image_url: { url: userImage } },
            { type: "image_url", image_url: { url: productImage } }
          ]
        }
      ],
      modalities: ["image", "text"]
    }),
  });

  return response;
}

async function callGeminiDirect(userImage: string, productImage: string, productName: string, apiKey: string) {
  console.log("Using Gemini direct API as fallback...");
  
  // Extract base64 data from data URLs
  const extractBase64 = (dataUrl: string) => {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      return { mimeType: matches[1], data: matches[2] };
    }
    return null;
  };

  const userImageData = extractBase64(userImage);
  const productImageData = extractBase64(productImage);

  if (!userImageData || !productImageData) {
    throw new Error("Invalid image format");
  }

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: FITTING_ROOM_PROMPT(productName) },
            {
              inline_data: {
                mime_type: userImageData.mimeType,
                data: userImageData.data
              }
            },
            {
              inline_data: {
                mime_type: productImageData.mimeType,
                data: productImageData.data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["image", "text"]
      }
    }),
  });

  return response;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userImage, productImage, productName } = await req.json();

    if (!userImage || !productImage) {
      return new Response(
        JSON.stringify({ error: "Imagens do usuário e do produto são obrigatórias" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit: count requests in the last hour
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("ai_fitting_room_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Error checking rate limit:", countError);
    }

    const currentUsage = count || 0;
    console.log(`User ${user.id} has used ${currentUsage}/${RATE_LIMIT_MAX_REQUESTS} requests in the last hour`);

    if (currentUsage >= RATE_LIMIT_MAX_REQUESTS) {
      return new Response(
        JSON.stringify({ 
          error: `Você atingiu o limite de ${RATE_LIMIT_MAX_REQUESTS} tentativas por hora. Tente novamente mais tarde.`,
          remainingRequests: 0,
          resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record this usage attempt
    const { error: insertError } = await supabase
      .from("ai_fitting_room_usage")
      .insert({ user_id: user.id });

    if (insertError) {
      console.error("Error recording usage:", insertError);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      console.error("No API key configured");
      return new Response(
        JSON.stringify({ error: "Serviço não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing AI fitting room request for product:", productName);

    let response;
    let useGeminiFallback = false;

    // Try Lovable AI first
    if (LOVABLE_API_KEY) {
      response = await callLovableAI(userImage, productImage, productName, LOVABLE_API_KEY);
      
      // Check if we need to fallback to Gemini (credits exhausted)
      if (response.status === 402 && GEMINI_API_KEY) {
        console.log("Lovable credits exhausted, using Gemini fallback...");
        useGeminiFallback = true;
      } else if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      useGeminiFallback = true;
    }

    // Use Gemini direct API as fallback
    if (useGeminiFallback && GEMINI_API_KEY) {
      try {
        response = await callGeminiDirect(userImage, productImage, productName, GEMINI_API_KEY);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Gemini API error:", response.status, errorText);
          return new Response(
            JSON.stringify({ error: "Erro ao processar imagem com IA" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await response.json();
        
        // Try to extract image from Gemini response
        const parts = data.candidates?.[0]?.content?.parts || [];
        let generatedImage = null;
        
        for (const part of parts) {
          if (part.inline_data) {
            generatedImage = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
            break;
          }
        }

        if (!generatedImage) {
          console.error("No image in Gemini response:", JSON.stringify(data, null, 2));
          return new Response(
            JSON.stringify({ error: "Não foi possível gerar a imagem. Tente novamente." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Successfully generated fitting room image (Gemini)");

        return new Response(
          JSON.stringify({ 
            generatedImage,
            message: "Imagem gerada com sucesso!"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (geminiError) {
        console.error("Gemini fallback error:", geminiError);
        return new Response(
          JSON.stringify({ error: "Erro ao processar imagem com IA" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle Lovable AI response
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "No response";
      console.error("AI Gateway error:", response?.status, errorText);
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar imagem com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract the generated image from the response
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error("No image in response:", JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar a imagem. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully generated fitting room image");

    return new Response(
      JSON.stringify({ 
        generatedImage,
        message: "Imagem gerada com sucesso!"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-fitting-room function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
