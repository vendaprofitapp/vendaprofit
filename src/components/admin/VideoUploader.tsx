import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoUploaderProps {
  label: string;
  description?: string;
  value?: string | null;
  onChange: (url: string) => void;
  maxSizeMB?: number;
}

export function VideoUploader({ 
  label, 
  description, 
  value, 
  onChange, 
  maxSizeMB = 50 
}: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [urlInput, setUrlInput] = useState(value || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast.error("Por favor, selecione um arquivo de vídeo");
      return;
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`O arquivo deve ter no máximo ${maxSizeMB}MB. Seu arquivo tem ${fileSizeMB.toFixed(1)}MB`);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para fazer upload");
        return;
      }

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Simulate progress (Supabase doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await supabase.storage
        .from("marketing-videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      clearInterval(progressInterval);

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("marketing-videos")
        .getPublicUrl(data.path);

      setProgress(100);
      onChange(publicUrl);
      setUrlInput(publicUrl);
      toast.success("Vídeo enviado com sucesso!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar vídeo: " + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      toast.success("URL salva!");
    }
  };

  const handleRemove = () => {
    onChange("");
    setUrlInput("");
    toast.success("Vídeo removido");
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-2">
            <Link className="w-4 h-4" />
            URL Externa
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="cursor-pointer"
            />
            {uploading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          </div>
          
          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">Enviando... {progress}%</p>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: MP4, WebM, MOV. Máximo: {maxSizeMB}MB
          </p>
        </TabsContent>
        
        <TabsContent value="url" className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/video.mp4"
            />
            <Button type="button" onClick={handleUrlSubmit} variant="secondary">
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole a URL direta do vídeo (MP4) hospedado externamente
          </p>
        </TabsContent>
      </Tabs>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Preview */}
      {value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Preview:</span>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remover
            </Button>
          </div>
          <video
            src={value}
            controls
            playsInline
            className="w-full max-w-xs rounded-lg border shadow-sm"
          />
        </div>
      )}
    </div>
  );
}
