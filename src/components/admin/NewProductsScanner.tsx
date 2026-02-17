import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radar, Loader2, ExternalLink, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminProductEditDialog } from "./AdminProductEditDialog";

interface DetectedProduct {
  name: string;
  url: string;
  selected: boolean;
}

interface NewProductsScannerProps {
  open: boolean;
  onClose: () => void;
  supplierName: string;
  supplierId: string;
  siteUrl: string;
  adminId: string;
  existingProductNames: string[];
}

export function NewProductsScanner({
  open,
  onClose,
  supplierName,
  supplierId,
  siteUrl,
  adminId,
  existingProductNames,
}: NewProductsScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [productUrls, setProductUrls] = useState<string[]>([]);
  const [detected, setDetected] = useState<DetectedProduct[]>([]);
  const [step, setStep] = useState<"idle" | "mapped" | "scraped">("idle");
  const [progress, setProgress] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleMap = async () => {
    setScanning(true);
    setProgress("Mapeando URLs do site...");

    try {
      const { data, error } = await supabase.functions.invoke("map-supplier-site", {
        body: { url: siteUrl },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao mapear site");
        setScanning(false);
        return;
      }

      const urls = data.productUrls || [];
      setProductUrls(urls);
      setStep("mapped");
      setProgress(`${urls.length} URLs de produtos encontradas`);
      toast.success(`${urls.length} URLs de produtos encontradas`);
    } catch (err) {
      toast.error("Erro ao conectar com o serviço de mapeamento");
    }
    setScanning(false);
  };

  const handleScrape = async () => {
    setScraping(true);
    const batch = productUrls.slice(0, 20);
    setProgress(`Extraindo dados de ${batch.length} páginas...`);

    const newProducts: DetectedProduct[] = [];

    for (let i = 0; i < batch.length; i++) {
      setProgress(`Extraindo ${i + 1}/${batch.length}...`);
      try {
        const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
          body: {
            url: batch[i],
            options: { formats: ["markdown"], onlyMainContent: true },
          },
        });

        if (error || !data?.success) continue;

        const markdown = data?.data?.markdown || data?.markdown || "";
        const headingMatch = markdown.match(/^#\s+(.+)$/m);
        const name = headingMatch?.[1]?.trim();

        if (name && !existingProductNames.includes(name.toLowerCase())) {
          if (!newProducts.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
            newProducts.push({ name, url: batch[i], selected: true });
          }
        }
      } catch {
        // Skip failed scrapes
      }
    }

    setDetected(newProducts);
    setStep("scraped");
    setProgress(`${newProducts.length} novos produtos detectados`);
    if (newProducts.length === 0) {
      toast.info("Nenhum produto novo encontrado.");
    } else {
      toast.success(`${newProducts.length} novos produtos detectados!`);
    }
    setScraping(false);
  };

  const toggleProduct = (index: number) => {
    setDetected((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleEditAndAdd = () => {
    const selected = detected.filter((p) => p.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }
    setShowEditDialog(true);
  };

  const handleEditDialogClose = () => {
    setShowEditDialog(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open && !showEditDialog} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              Buscar Novidades — {supplierName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Site:{" "}
              <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {siteUrl} <ExternalLink className="inline h-3 w-3" />
              </a>
            </p>

            {progress && (
              <Badge variant="outline" className="text-xs">
                {progress}
              </Badge>
            )}

            {step === "idle" && (
              <Button onClick={handleMap} disabled={scanning} className="w-full">
                {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Radar className="h-4 w-4 mr-2" />}
                {scanning ? "Mapeando site..." : "1. Mapear URLs do Site"}
              </Button>
            )}

            {step === "mapped" && (
              <div className="space-y-3">
                <p className="text-sm">{productUrls.length} URLs de produtos encontradas</p>
                <Button onClick={handleScrape} disabled={scraping} className="w-full">
                  {scraping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Radar className="h-4 w-4 mr-2" />}
                  {scraping ? "Extraindo dados..." : `2. Extrair dados (até ${Math.min(productUrls.length, 20)} páginas)`}
                </Button>
              </div>
            )}

            {step === "scraped" && detected.length > 0 && (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {detected.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 border rounded-lg">
                      <Checkbox checked={p.selected} onCheckedChange={() => toggleProduct(i)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary truncate block"
                        >
                          {p.url}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {step === "scraped" && detected.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Todos os produtos do site já estão cadastrados! 🎉
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {step === "scraped" && detected.length > 0 && (
              <Button onClick={handleEditAndAdd}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar e Adicionar {detected.filter((p) => p.selected).length} Selecionado(s)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showEditDialog && (
        <AdminProductEditDialog
          open={showEditDialog}
          onClose={handleEditDialogClose}
          products={detected.filter((p) => p.selected).map(({ name, url }) => ({ name, url }))}
          supplierId={supplierId}
          adminId={adminId}
        />
      )}
    </>
  );
}
