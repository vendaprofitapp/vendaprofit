import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, Sparkles, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
}

interface AIFittingRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function AIFittingRoomDialog({ open, onOpenChange, product }: AIFittingRoomDialogProps) {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUserImage(e.target?.result as string);
      setGeneratedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async () => {
    if (!userImage || !product?.image_url) {
      toast.error("Imagem do cliente ou do produto não disponível");
      return;
    }

    setIsProcessing(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-fitting-room`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            userImage,
            productImage: product.image_url,
            productName: product.name,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error("Muitas requisições. Aguarde um momento e tente novamente.");
        }
        if (response.status === 402) {
          throw new Error("Serviço temporariamente indisponível. Tente novamente mais tarde.");
        }
        
        throw new Error(errorData.error || "Erro ao processar imagem");
      }

      const data = await response.json();
      
      if (data.generatedImage) {
        setGeneratedImage(data.generatedImage);
        toast.success("Imagem gerada com sucesso!");
      } else {
        throw new Error("Nenhuma imagem foi gerada");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar imagem");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setUserImage(null);
    setGeneratedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Provador I.A.
          </DialogTitle>
          <DialogDescription>
            Envie sua foto e veja como você fica com "{product?.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Image Preview */}
          {product?.image_url && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <img
                src={product.image_url}
                alt={product.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">Peça selecionada</p>
              </div>
            </div>
          )}

          {/* User Image Upload */}
          {!generatedImage && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!userImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Camera className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Envie sua foto</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Clique para selecionar uma imagem
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Escolher foto
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={userImage}
                    alt="Sua foto"
                    className="w-full max-h-64 object-contain rounded-lg bg-muted"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={handleReset}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {userImage && !isProcessing && (
                <Button
                  onClick={handleGenerateImage}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Sparkles className="h-5 w-5" />
                  Experimentar peça
                </Button>
              )}

              {isProcessing && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Gerando sua imagem... Isso pode levar alguns segundos.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Generated Result */}
          {generatedImage && (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={generatedImage}
                  alt="Resultado do Provador I.A."
                  className="w-full rounded-lg shadow-lg"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1 gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                * Imagem gerada por I.A. O resultado final pode variar.
              </p>
            </div>
          )}

          {/* Tips */}
          {!generatedImage && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">💡 Dicas para melhores resultados:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Use uma foto de corpo inteiro com boa iluminação</li>
                <li>• Prefira fundos simples e neutros</li>
                <li>• Fique de frente para a câmera</li>
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
