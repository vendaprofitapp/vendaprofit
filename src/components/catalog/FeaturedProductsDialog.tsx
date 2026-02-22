import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Star, GripVertical, X, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FeaturedProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  catalogItems: { productId: string; name: string; color: string | null; image_url: string | null }[];
}

interface FeaturedSlot {
  position: number;
  productId: string | null;
  name?: string;
  color?: string | null;
  image_url?: string | null;
}

export function FeaturedProductsDialog({ open, onOpenChange, ownerId, catalogItems }: FeaturedProductsDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [slots, setSlots] = useState<FeaturedSlot[]>(
    Array.from({ length: 10 }, (_, i) => ({ position: i + 1, productId: null }))
  );
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch existing featured products
  const { data: existingFeatured = [] } = useQuery({
    queryKey: ["featured-products", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_products")
        .select("*")
        .eq("owner_id", ownerId)
        .order("position");
      if (error) throw error;
      return data || [];
    },
    enabled: !!ownerId && open,
  });

  // Load existing into slots when data arrives
  useEffect(() => {
    if (!open) return;
    const newSlots: FeaturedSlot[] = Array.from({ length: 10 }, (_, i) => ({
      position: i + 1,
      productId: null,
    }));

    existingFeatured.forEach((fp: any) => {
      const idx = fp.position - 1;
      if (idx >= 0 && idx < 10) {
        const item = catalogItems.find(ci => ci.productId === fp.product_id);
        newSlots[idx] = {
          position: fp.position,
          productId: fp.product_id,
          name: item?.name || "Produto removido",
          color: item?.color,
          image_url: item?.image_url,
        };
      }
    });
    setSlots(newSlots);
  }, [existingFeatured, catalogItems, open]);

  const assignedProductIds = new Set(slots.filter(s => s.productId).map(s => s.productId!));

  const filteredProducts = catalogItems.filter(p => {
    if (assignedProductIds.has(p.productId)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.color || "").toLowerCase().includes(q);
  });

  const handleAssign = (slotIndex: number, product: typeof catalogItems[0]) => {
    setSlots(prev => {
      const updated = [...prev];
      updated[slotIndex] = {
        ...updated[slotIndex],
        productId: product.productId,
        name: product.name,
        color: product.color,
        image_url: product.image_url,
      };
      return updated;
    });
  };

  const handleRemove = (slotIndex: number) => {
    setSlots(prev => {
      const updated = [...prev];
      updated[slotIndex] = { position: slotIndex + 1, productId: null };
      return updated;
    });
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setSlots(prev => {
      const updated = [...prev];
      const temp = { ...updated[draggedIndex!] };
      updated[draggedIndex!] = { ...updated[index], position: draggedIndex! + 1 };
      updated[index] = { ...temp, position: index + 1 };
      return updated;
    });
    setDraggedIndex(index);
  };
  const handleDragEnd = () => setDraggedIndex(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing
      await supabase.from("featured_products").delete().eq("owner_id", ownerId);

      // Insert non-empty slots
      const toInsert = slots
        .filter(s => s.productId)
        .map(s => ({
          owner_id: ownerId,
          product_id: s.productId!,
          position: s.position,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("featured_products").insert(toInsert);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
      toast.success(`${toInsert.length} produto(s) em destaque salvos!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Produtos em Destaque
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Escolha até 10 produtos para aparecer primeiro no catálogo. Arraste para reordenar.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Slots */}
          <div className="space-y-2 mb-4">
            {slots.map((slot, idx) => (
              <div
                key={idx}
                draggable={!!slot.productId}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                  slot.productId
                    ? "bg-card border-border"
                    : activeSlotIndex === idx
                    ? "border-primary border-dashed bg-primary/5"
                    : "border-dashed border-muted-foreground/30 hover:border-primary/50 cursor-pointer"
                } ${draggedIndex === idx ? "opacity-50" : ""}`}
                onClick={() => {
                  if (!slot.productId) {
                    setActiveSlotIndex(activeSlotIndex === idx ? null : idx);
                  }
                }}
              >
                {slot.productId ? (
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
                ) : (
                  <span className="w-4 text-center text-xs font-bold text-muted-foreground flex-shrink-0">
                    {slot.position}
                  </span>
                )}

                {slot.productId ? (
                  <>
                    {slot.image_url ? (
                      <img src={slot.image_url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{slot.name}</p>
                      {slot.color && <p className="text-xs text-muted-foreground">{slot.color}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {activeSlotIndex === idx ? "Selecione um produto abaixo" : "Clique para adicionar"}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Product search - shown when a slot is active */}
          {activeSlotIndex !== null && (
            <div className="border-t pt-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {filteredProducts.slice(0, 50).map(p => (
                    <button
                      key={p.productId}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent text-left transition-colors"
                      onClick={() => {
                        handleAssign(activeSlotIndex, p);
                        setActiveSlotIndex(null);
                        setSearch("");
                      }}
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{p.name}</p>
                        {p.color && <p className="text-xs text-muted-foreground">{p.color}</p>}
                      </div>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Destaques
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
