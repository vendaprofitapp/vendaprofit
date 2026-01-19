import { useState, useRef } from "react";
import { Video, Upload, X, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ProductVideoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["video/mp4", "video/webm"];

export function ProductVideoUpload({ value, onChange }: ProductVideoUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use apenas MP4 ou WebM.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Simulate progress (since Supabase doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { error } = await supabase.storage
        .from('product-videos')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type
        });

      clearInterval(progressInterval);

      if (error) throw error;

      const { data } = supabase.storage
        .from('product-videos')
        .getPublicUrl(fileName);

      setUploadProgress(100);
      onChange(data.publicUrl);
      toast.success("Vídeo enviado com sucesso!");
    } catch (error: any) {
      console.error("Error uploading video:", error);
      toast.error("Erro ao enviar vídeo: " + (error.message || "Erro desconhecido"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!value || !user) return;

    try {
      // Extract file path from URL
      const url = new URL(value);
      const pathParts = url.pathname.split('/product-videos/');
      if (pathParts.length > 1) {
        const filePath = decodeURIComponent(pathParts[1]);
        await supabase.storage
          .from('product-videos')
          .remove([filePath]);
      }
    } catch (error) {
      console.error("Error removing video:", error);
    }

    onChange(null);
    toast.success("Vídeo removido");
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Video className="h-4 w-4" />
        Vídeo do Produto
      </Label>
      
      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
        <AlertCircle className="h-3 w-3" />
        Apenas MP4 ou WebM, máximo 10MB
      </div>

      {value ? (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden border bg-muted">
            <video 
              src={value} 
              className="w-full h-32 object-cover"
              muted
              playsInline
              onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
              onMouseOut={(e) => {
                const video = e.target as HTMLVideoElement;
                video.pause();
                video.currentTime = 0;
              }}
            />
            <div className="absolute top-2 right-2 flex gap-1">
              <div className="bg-green-500 text-white rounded-full p-1">
                <CheckCircle className="h-4 w-4" />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-6 w-6"
                onClick={handleRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {value.split('/').pop()}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          
          <Button
            type="button"
            variant="outline"
            className="w-full h-24 border-dashed flex flex-col gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm">Enviando... {uploadProgress}%</span>
                <div className="w-full max-w-32 h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para carregar vídeo
                </span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
