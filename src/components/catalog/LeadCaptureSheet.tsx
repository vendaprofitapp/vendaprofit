import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ShoppingBag } from "lucide-react";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  whatsapp: z.string().trim().min(14, "WhatsApp inválido").max(16),
});

interface LeadCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; whatsapp: string }) => void;
  primaryColor: string;
}

function formatWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Hook that listens to visualViewport resize events to detect
 * virtual keyboard open/close and returns the available height.
 */
function useVisualViewportHeight(enabled: boolean) {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;
    const onResize = () => {
      // When keyboard opens, visualViewport.height shrinks
      setViewportHeight(vv.height);
    };

    vv.addEventListener("resize", onResize);
    // Set initial value
    setViewportHeight(vv.height);

    return () => vv.removeEventListener("resize", onResize);
  }, [enabled]);

  return viewportHeight;
}

function LeadForm({ onSubmit, primaryColor }: { onSubmit: (data: { name: string; whatsapp: string }) => void; primaryColor: string }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scrollInputIntoView = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = leadSchema.safeParse({ name, whatsapp });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit({ name: result.data.name, whatsapp: result.data.whatsapp });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      <p className="text-sm text-muted-foreground">
        Ótima escolha! Nossos estoques giram rápido. Para reservarmos essa peça para você enquanto continua olhando a loja, informe:
      </p>
      <div className="space-y-2">
        <Label htmlFor="lead-name">Seu nome</Label>
        <Input
          id="lead-name"
          placeholder="Como podemos te chamar?"
          value={name}
          onChange={e => setName(e.target.value)}
          onFocus={scrollInputIntoView}
          inputMode="text"
          maxLength={100}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="lead-whatsapp">WhatsApp</Label>
        <Input
          id="lead-whatsapp"
          placeholder="(00) 00000-0000"
          value={whatsapp}
          onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
          onFocus={scrollInputIntoView}
          inputMode="tel"
          maxLength={16}
        />
        {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp}</p>}
      </div>
      <Button
        type="submit"
        className="w-full h-12 text-base font-semibold rounded-xl gap-2"
        style={{ backgroundColor: primaryColor }}
      >
        <ShoppingBag className="h-5 w-5" />
        Garantir Minhas Peças
      </Button>
    </form>
  );
}

export function LeadCaptureSheet({ open, onOpenChange, onSubmit, primaryColor }: LeadCaptureSheetProps) {
  const isMobile = useIsMobile();
  const viewportHeight = useVisualViewportHeight(isMobile && open);
  const contentRef = useRef<HTMLDivElement>(null);

  // Dynamically adjust drawer max-height when keyboard opens
  useEffect(() => {
    if (!isMobile || !open || !contentRef.current) return;
    
    if (viewportHeight !== null) {
      // Apply viewport height as max-height so drawer fits above keyboard
      contentRef.current.style.maxHeight = `${viewportHeight}px`;
    }
    
    return () => {
      if (contentRef.current) {
        contentRef.current.style.maxHeight = "";
      }
    };
  }, [viewportHeight, isMobile, open]);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent ref={contentRef} className="max-h-[85dvh]">
          <div className="overflow-y-auto flex-1 overscroll-contain">
            <DrawerHeader className="shrink-0">
              <DrawerTitle>Reservar suas peças 🛍️</DrawerTitle>
              <DrawerDescription className="sr-only">Preencha seus dados para reservar</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <LeadForm onSubmit={onSubmit} primaryColor={primaryColor} />
            </div>
            <div className="px-4 pb-6">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-sm text-muted-foreground">
                Continuar sem reservar
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reservar suas peças 🛍️</DialogTitle>
          <DialogDescription className="sr-only">Preencha seus dados para reservar</DialogDescription>
        </DialogHeader>
        <LeadForm onSubmit={onSubmit} primaryColor={primaryColor} />
        <button
          onClick={() => onOpenChange(false)}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
        >
          Continuar sem reservar
        </button>
      </DialogContent>
    </Dialog>
  );
}
