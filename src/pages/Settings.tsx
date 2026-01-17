import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AISettingsSection } from "@/components/settings/AISettingsSection";
import { CustomPaymentMethodsSection } from "@/components/settings/CustomPaymentMethodsSection";
import { SecuritySection } from "@/components/settings/SecuritySection";

export default function Settings() {
  const { user } = useAuth();

  // Fetch user profile for AI settings
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user?.id],
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
  });

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Segurança, formas de pagamento e IA</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {user?.id && user?.email && (
          <SecuritySection userId={user.id} userEmail={user.email} />
        )}
        {user?.id && <CustomPaymentMethodsSection userId={user.id} />}
        {user?.id && (
          <AISettingsSection userId={user.id} profile={profile} onUpdate={refetchProfile} />
        )}
      </div>
    </MainLayout>
  );
}

