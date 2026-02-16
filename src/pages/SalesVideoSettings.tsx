import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { VideoUploader } from "@/components/admin/VideoUploader";

export default function SalesVideoSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [bioVideoPreview, setBioVideoPreview] = useState<string | null>(null);
  const [bioVideoFull, setBioVideoFull] = useState<string | null>(null);

  const { data: storeSettings, isLoading } = useQuery({
    queryKey: ["store-video-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("id, bio_video_enabled, bio_video_preview, bio_video_full")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (storeSettings) {
      setEnabled((storeSettings as any).bio_video_enabled ?? false);
      setBioVideoPreview(storeSettings.bio_video_preview);
      setBioVideoFull(storeSettings.bio_video_full);
    }
  }, [storeSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!storeSettings?.id) throw new Error("Loja não encontrada");
      const { error } = await supabase
        .from("store_settings")
        .update({
          bio_video_enabled: enabled,
          bio_video_preview: bioVideoPreview,
          bio_video_full: bioVideoFull,
        } as any)
        .eq("id", storeSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vídeo Vendedor salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["store-video-settings"] });
    },
    onError: (error: any) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!storeSettings) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">
          Configure sua loja primeiro em "Minha Loja" antes de usar o Vídeo Vendedor.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6 text-pink-500" />
            Vídeo Vendedor (Bolinha Flutuante)
          </h1>
          <p className="text-muted-foreground">Configure os vídeos da bolinha flutuante da sua loja</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-pink-50 dark:bg-pink-950/20 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <Video className="h-4 w-4 text-pink-500" />
                  Ativar Vídeo Vendedor
                </Label>
                <p className="text-sm text-muted-foreground">
                  A bolinha flutuante aparecerá na sua loja quando os vídeos estiverem configurados
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
              <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <VideoUploader
                    label="Vídeo da Bolinha (Preview - Mudo/Loop)"
                    description="Vídeo curto que aparece na bolinha flutuante. Recomendado: até 10 segundos, formato quadrado."
                    value={bioVideoPreview}
                    onChange={setBioVideoPreview}
                    maxSizeMB={10}
                  />
                  <VideoUploader
                    label="Vídeo de Apresentação (Stories)"
                    description="Vídeo completo exibido ao clicar na bolinha. Formato vertical (9:16) recomendado, estilo Stories."
                    value={bioVideoFull}
                    onChange={setBioVideoFull}
                    maxSizeMB={50}
                  />
                </div>

                <div className="bg-pink-50 dark:bg-pink-950/20 p-4 rounded-lg">
                  <p className="text-sm font-medium text-pink-800 dark:text-pink-200 mb-2">💡 Dicas para seus vídeos:</p>
                  <ul className="text-sm text-pink-700 dark:text-pink-300 space-y-1">
                    <li>• Faça upload diretamente ou cole uma URL externa (MP4)</li>
                    <li>• O vídeo da bolinha deve ser curto e chamar atenção (máx. 10MB)</li>
                    <li>• O vídeo de apresentação pode ter até 60 segundos (máx. 50MB)</li>
                    <li>• Fale diretamente com seu cliente, seja autêntico!</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar Vídeo Vendedor"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
