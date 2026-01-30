import { useState } from "react";
import { Image as ImageIcon, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageItem {
  url: string;
  isExisting: boolean;
  index: number;
}

interface ReorderableImageListProps {
  existingUrls: string[];
  newPreviewUrls: string[];
  maxImages?: number;
  onReorder: (existingUrls: string[], newPreviewUrls: string[]) => void;
  onRemove: (index: number, isExisting: boolean) => void;
  onAddClick: () => void;
}

export function ReorderableImageList({
  existingUrls,
  newPreviewUrls,
  maxImages = 3,
  onReorder,
  onRemove,
  onAddClick,
}: ReorderableImageListProps) {
  const [draggedItem, setDraggedItem] = useState<ImageItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Combine all images into a single list for display
  const allImages: ImageItem[] = [
    ...existingUrls.map((url, idx) => ({ url, isExisting: true, index: idx })),
    ...newPreviewUrls.map((url, idx) => ({ url, isExisting: false, index: idx })),
  ];

  const totalImages = allImages.length;

  const handleDragStart = (e: React.DragEvent, item: ImageItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    // Set drag image
    const target = e.target as HTMLElement;
    if (target) {
      e.dataTransfer.setDragImage(target, 28, 28);
    }
  };

  const handleDragOver = (e: React.DragEvent, overIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(overIndex);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (!draggedItem) return;

    const dragIndex = allImages.findIndex(
      (img) => img.url === draggedItem.url && img.isExisting === draggedItem.isExisting
    );

    if (dragIndex === dropIndex) {
      setDraggedItem(null);
      return;
    }

    // Create new order
    const newOrder = [...allImages];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    // Separate back into existing and new
    const newExisting: string[] = [];
    const newNew: string[] = [];

    newOrder.forEach((img) => {
      if (img.isExisting) {
        newExisting.push(img.url);
      } else {
        newNew.push(img.url);
      }
    });

    onReorder(newExisting, newNew);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  // Touch-based reordering
  const moveImage = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= allImages.length) return;

    const newOrder = [...allImages];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);

    const newExisting: string[] = [];
    const newNew: string[] = [];

    newOrder.forEach((img) => {
      if (img.isExisting) {
        newExisting.push(img.url);
      } else {
        newNew.push(img.url);
      }
    });

    onReorder(newExisting, newNew);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start flex-wrap">
        {allImages.map((item, displayIndex) => (
          <div
            key={`${item.isExisting ? "existing" : "new"}-${item.index}-${item.url}`}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            onDragOver={(e) => handleDragOver(e, displayIndex)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, displayIndex)}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative w-16 h-16 group cursor-move transition-all",
              dragOverIndex === displayIndex && "scale-110",
              draggedItem?.url === item.url && "opacity-50"
            )}
          >
            {/* Position indicator */}
            <span className="absolute -top-2 -left-2 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-bold z-10 shadow">
              {displayIndex + 1}
            </span>

            <img
              src={item.url}
              alt={`Foto ${displayIndex + 1}`}
              className={cn(
                "w-full h-full object-cover rounded-lg border-2 transition-colors",
                dragOverIndex === displayIndex ? "border-primary" : "border-border"
              )}
              draggable={false}
            />

            {/* Drag handle indicator */}
            <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <GripVertical className="h-5 w-5 text-white" />
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(item.index, item.isExisting)}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:scale-110 transition-transform z-20"
            >
              ×
            </button>

            {/* Mobile reorder buttons */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {displayIndex > 0 && (
                <button
                  type="button"
                  onClick={() => moveImage(displayIndex, "up")}
                  className="w-5 h-5 bg-white border rounded text-[10px] shadow-sm hover:bg-gray-100"
                >
                  ←
                </button>
              )}
              {displayIndex < allImages.length - 1 && (
                <button
                  type="button"
                  onClick={() => moveImage(displayIndex, "down")}
                  className="w-5 h-5 bg-white border rounded text-[10px] shadow-sm hover:bg-gray-100"
                >
                  →
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add button */}
        {totalImages < maxImages && (
          <button
            type="button"
            onClick={onAddClick}
            className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground mt-0.5">Foto</span>
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <GripVertical className="h-3 w-3" />
        {totalImages}/3 fotos • Arraste para reordenar
      </p>
    </div>
  );
}
