import { useState, useEffect } from "react";
import { Bot, Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AISettingsSectionProps {
  userId: string;
  profile: {
    preferred_ai_provider?: string;
    gemini_api_key?: string;
    openai_api_key?: string;
  } | null;
  onUpdate: () => void;
}

export function AISettingsSection({ userId, profile, onUpdate }: AISettingsSectionProps) {
  const [provider, setProvider] = useState<string>(profile?.preferred_ai_provider || "gemini");
  const [geminiKey, setGeminiKey] = useState(profile?.gemini_api_key || "");
  const [openaiKey, setOpenaiKey] = useState(profile?.openai_api_key || "");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setProvider(profile.preferred_ai_provider || "gemini");
      setGeminiKey(profile.gemini_api_key || "");
      setOpenaiKey(profile.openai_api_key || "");
    }
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          preferred_ai_provider: provider,
          gemini_api_key: geminiKey || null,
          openai_api_key: openaiKey || null,
        })
        .eq("id", userId);

      if (error) throw error;

      toast({ title: "Configurações de IA salvas com sucesso!" });
      onUpdate();
    } catch (error: any) {
      toast({ 
        title: "Erro ao salvar configurações", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 4) + "•".repeat(key.length - 8) + key.substring(key.length - 4);
  };

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Inteligência Artificial</h3>
          <p className="text-sm text-muted-foreground">Configure seu provedor de IA preferido (BYOK)</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-3">
          <Label>Provedor de IA</Label>
          <RadioGroup value={provider} onValueChange={setProvider} className="space-y-3">
            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="gemini" id="gemini" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="gemini" className="font-medium cursor-pointer">
                  Google Gemini
                  <span className="ml-2 text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">
                    Recomendado
                  </span>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Gratuito até limites generosos. Ideal para a maioria dos usuários.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="openai" id="openai" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="openai" className="font-medium cursor-pointer">
                  OpenAI GPT
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Requer créditos pré-pagos. Melhor qualidade em alguns cenários.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Conditional API Key Input */}
        {provider === "gemini" && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <Label htmlFor="gemini-key">Chave API do Google Gemini</Label>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Obter chave gratuita <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                id="gemini-key"
                type={showGeminiKey ? "text" : "password"}
                value={showGeminiKey ? geminiKey : maskApiKey(geminiKey)}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
              >
                {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe em branco para usar o serviço padrão (com limites).
            </p>
          </div>
        )}

        {provider === "openai" && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <Label htmlFor="openai-key">Chave API da OpenAI</Label>
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Obter chave <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                id="openai-key"
                type={showOpenaiKey ? "text" : "password"}
                value={showOpenaiKey ? openaiKey : maskApiKey(openaiKey)}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
              >
                {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Requer conta com créditos na OpenAI.
            </p>
          </div>
        )}

        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configurações de IA
        </Button>
      </div>
    </div>
  );
}
