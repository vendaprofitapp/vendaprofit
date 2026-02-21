import React, { useRef } from "react";
import { Label } from "@/components/ui/label";
import { ReorderableImageList } from "@/components/stock/ReorderableImageList";
import { SupplierImageScraper } from "@/components/stock/SupplierImageScraper";
import { ProductVideoUpload } from "@/components/stock/ProductVideoUpload";
import { toast } from "sonner";

interface ProductMediaSectionProps {
  existingImageUrls: string[];
  newImagePreviews: string[];
  totalImages: number;
  videoUrl: string | null;
  onImageUpload: (files: FileList | null) => void;
  onImageReorder: (newExisting: string[], newPreviews: string[]) => void;
  onRemoveImage: (index: number, isExisting: boolean) => void;
  onImagesFromSupplier: (urls: string[]) => void;
  onVideoChange: (url: string | null) => void;
}

export const ProductMediaSection = React.memo(function ProductMediaSection({
  existingImageUrls,
  newImagePreviews,
  totalImages,
  videoUrl,
  onImageUpload,
  onImageReorder,
  onRemoveImage,
  onImagesFromSupplier,
  onVideoChange,
}: ProductMediaSectionProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-4 pt-2 border-t">
      <h3 className="text-sm font-medium text-muted-foreground">Mídia do Produto</h3>
      
      {/* Fotos */}
      <div className="space-y-2">
        <Label>Fotos (até 3)</Label>
        
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onImageUpload(e.target.files)}
          className="hidden"
        />
        
        <ReorderableImageList
          existingUrls={existingImageUrls}
          newPreviewUrls={newImagePreviews}
          maxImages={3}
          onReorder={onImageReorder}
          onRemove={onRemoveImage}
          onAddClick={() => imageInputRef.current?.click()}
        />
        
        <p className="text-xs text-muted-foreground">{totalImages}/3 fotos</p>
        
        {totalImages < 3 && (
          <SupplierImageScraper
            maxImages={3}
            currentImageCount={totalImages}
            onImagesSelected={onImagesFromSupplier}
          />
        )}
      </div>
      
      {/* Vídeo */}
      <ProductVideoUpload
        value={videoUrl}
        onChange={onVideoChange}
      />
    </div>
  );
});
