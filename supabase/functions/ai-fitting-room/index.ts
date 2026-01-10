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

// Helper function to convert URL to base64
async function urlToBase64(url: string): Promise<{ mimeType: string; data: string }> {
  console.log("Fetching image from URL:", url.substring(0, 50) + "...");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  return { mimeType: contentType.split(";")[0], data: base64 };
}

// Helper function to extract base64 from data URL
function extractBase64FromDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (matches) {
    return { mimeType: matches[1], data: matches[2] };
  }
  return null;
}

// Helper function to get image data (handles both URLs and base64)
async function getImageData(image: string): Promise<{ mimeType: string; data: string }> {
  // Check if it's a data URL
  if (image.startsWith("data:")) {
    const extracted = extractBase64FromDataUrl(image);
    if (extracted) {
      return extracted;
    }
    throw new Error("Invalid data URL format");
  }
  
  // Otherwise, it's a URL - fetch and convert
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return await urlToBase64(image);
  }
  
  throw new Error("Invalid image format - must be data URL or HTTP URL");
}

async function callGeminiDirect(userImage: string, productImage: string, productName: string, apiKey: string) {
  console.log("Using Gemini direct API as fallback...");
  
  // Get image data for both images
  const userImageData = await getImageData(userImage);
  const productImageData = await getImageData(productImage);

  console.log("Images prepared for Gemini API");

  // Use imagen model for image generation
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
        responseModalities: ["TEXT", "IMAGE"]
      }
    }),
  });

  return response;
}

// Simple in-memory rate limit for anonymous users (by IP)
const anonymousRateLimits = new Map<string, { count: number; resetTime: number }>();

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Try to get authenticated user if token is provided
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader && authHeader !== `Bearer ${supabaseAnonKey}`) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    // Use service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Rate limiting
    let currentUsage = 0;
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    if (userId) {
      // Authenticated user: check database for rate limit
      const { count, error: countError } = await supabaseAdmin
        .from("ai_fitting_room_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", oneHourAgo);

      if (countError) {
        console.error("Error checking rate limit:", countError);
      }
      currentUsage = count || 0;
      console.log(`User ${userId} has used ${currentUsage}/${RATE_LIMIT_MAX_REQUESTS} requests in the last hour`);
    } else {
      // Anonymous user: use IP-based in-memory rate limit
      const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                       req.headers.get("cf-connecting-ip") || 
                       "unknown";
      
      const now = Date.now();
      const windowMs = RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;
      
      const rateData = anonymousRateLimits.get(clientIP);
      if (rateData && rateData.resetTime > now) {
        currentUsage = rateData.count;
      } else {
        currentUsage = 0;
        anonymousRateLimits.set(clientIP, { count: 0, resetTime: now + windowMs });
      }
      
      console.log(`Anonymous user (IP: ${clientIP}) has used ${currentUsage}/${RATE_LIMIT_MAX_REQUESTS} requests in the last hour`);
    }

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

    // Record usage
    if (userId) {
      const { error: insertError } = await supabaseAdmin
        .from("ai_fitting_room_usage")
        .insert({ user_id: userId });

      if (insertError) {
        console.error("Error recording usage:", insertError);
      }
    } else {
      // Update in-memory counter for anonymous users
      const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                       req.headers.get("cf-connecting-ip") || 
                       "unknown";
      const rateData = anonymousRateLimits.get(clientIP);
      if (rateData) {
        rateData.count++;
      }
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
