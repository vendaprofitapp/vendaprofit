import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AIConfig {
  provider: "gemini" | "openai";
  apiKey: string | null;
}

export function useAIConfig() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["user-ai-config", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("preferred_ai_provider, gemini_api_key, openai_api_key")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const getAIConfig = (): AIConfig => {
    const provider = (profile?.preferred_ai_provider as "gemini" | "openai") || "gemini";
    const apiKey = provider === "openai" 
      ? profile?.openai_api_key 
      : profile?.gemini_api_key;

    return { provider, apiKey: apiKey || null };
  };

  // Get headers to send to edge functions
  const getAIHeaders = (): Record<string, string> => {
    const config = getAIConfig();
    
    if (!config.apiKey) {
      return {}; // No user key, will use system fallback
    }

    return {
      "x-ai-provider": config.provider,
      "x-ai-key": config.apiKey,
    };
  };

  return {
    config: getAIConfig(),
    headers: getAIHeaders(),
    isLoading: !profile && !!user?.id,
    hasCustomKey: !!getAIConfig().apiKey,
  };
}
