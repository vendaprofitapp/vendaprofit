import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Camera, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SupplierSelect } from "./SupplierSelect";

interface ImportedProduct {
  name: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  cost_price: number;
  quantity: number;
  selected: boolean;
}

interface StockImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function StockImportDialog({ open, onOpenChange, onImportComplete }: StockImportDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ImportedProduct[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [step, setStep] = useState<"upload" | "review">("upload");

  const resetState = () => {
    setProducts([]);
    setSupplierName("");
    setSupplierId("");
    setStep("upload");
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("Planilha vazia ou sem dados");
        setLoading(false);
        return;
      }

      // Parse CSV/TSV
      const delimiter = text.includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
      
      const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name') || h.includes('produto'));
      const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('codigo') || h.includes('código') || h.includes('ref'));
      const sizeIdx = headers.findIndex(h => h.includes('tamanho') || h.includes('size') || h.includes('tam'));
      const colorIdx = headers.findIndex(h => h.includes('cor') || h.includes('color'));
      const priceIdx = headers.findIndex(h => h.includes('custo') || h.includes('cost') || h.includes('preco') || h.includes('preço') || h.includes('price'));
      const qtyIdx = headers.findIndex(h => h.includes('qtd') || h.includes('quantidade') || h.includes('qty') || h.includes('quantity'));

      if (nameIdx === -1) {
        toast.error("Coluna 'Nome' não encontrada na planilha");
        setLoading(false);
        return;
      }

      const parsedProducts: ImportedProduct[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        const name = values[nameIdx];
        
        if (!name) continue;

        parsedProducts.push({
          name,
          sku: skuIdx >= 0 ? values[skuIdx] || null : null,
          size: sizeIdx >= 0 ? values[sizeIdx] || null : null,
          color: colorIdx >= 0 ? values[colorIdx] || null : null,
          cost_price: priceIdx >= 0 ? parseFloat(values[priceIdx]?.replace(',', '.')) || 0 : 0,
          quantity: qtyIdx >= 0 ? parseInt(values[qtyIdx]) || 1 : 1,
          selected: true
        });
      }

      if (parsedProducts.length === 0) {
        toast.error("Nenhum produto encontrado na planilha");
        setLoading(false);
        return;
      }

      setProducts(parsedProducts);
      setStep("review");
      toast.success(`${parsedProducts.length} produtos encontrados`);
    } catch (error) {
      console.error("Error parsing spreadsheet:", error);
      toast.error("Erro ao processar planilha");
    }
    
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        const { data, error } = await supabase.functions.invoke('parse-invoice', {
          body: { imageBase64: base64, mimeType: file.type }
        });

        if (error || !data?.success) {
          toast.error(data?.error || "Erro ao processar nota fiscal");
          setLoading(false);
          return;
        }

        const invoiceData = data.data;
        
        if (invoiceData.supplier) {
          setSupplierName(invoiceData.supplier);
        }

        const parsedProducts: ImportedProduct[] = (invoiceData.products || []).map((p: any) => ({
          name: p.name || "Produto sem nome",
          sku: p.sku || null,
          size: p.size || null,
          color: p.color || null,
          cost_price: parseFloat(p.cost_price) || 0,
          quantity: parseInt(p.quantity) || 1,
          selected: true
        }));

        if (parsedProducts.length === 0) {
          toast.error("Nenhum produto identificado na nota fiscal");
          setLoading(false);
          return;
        }

        setProducts(parsedProducts);
        setStep("review");
        toast.success(`${parsedProducts.length} produtos identificados por IA`);
        setLoading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing invoice:", error);
      toast.error("Erro ao processar nota fiscal");
      setLoading(false);
    }
    
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const toggleProduct = (index: number) => {
    setProducts(prev => prev.map((p, i) => 
      i === index ? { ...p, selected: !p.selected } : p
    ));
  };

  const handleImport = async () => {
    if (!user) return;

    const selectedProducts = products.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    setLoading(true);

    // Create supplier if needed
    let finalSupplierId = supplierId === "none" ? null : supplierId;
    
    if (!finalSupplierId && supplierName.trim()) {
      const { data: newSupplier, error: supplierError } = await supabase
        .from("suppliers")
        .insert({
          name: supplierName.trim(),
          owner_id: user.id
        })
        .select("id")
        .single();

      if (!supplierError && newSupplier) {
        finalSupplierId = newSupplier.id;
      }
    }

    // Insert products
    const productsToInsert = selectedProducts.map(p => ({
      name: p.name,
      sku: p.sku,
      size: p.size,
      color: p.color,
      cost_price: p.cost_price,
      stock_quantity: p.quantity,
      price: 0,
      category: "Outros",
      min_stock_level: 5,
      owner_id: user.id,
      supplier_id: finalSupplierId
    }));

    const { error } = await supabase
      .from("products")
      .insert(productsToInsert);

    if (error) {
      console.error("Insert error:", error);
      toast.error("Erro ao importar produtos");
    } else {
      toast.success(`${selectedProducts.length} produtos importados!`);
      handleClose();
      onImportComplete();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Estoque</DialogTitle>
          <DialogDescription>
            Importe produtos via planilha ou foto de nota fiscal
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <Tabs defaultValue="spreadsheet" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="spreadsheet">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Planilha
              </TabsTrigger>
              <TabsTrigger value="invoice">
                <Camera className="h-4 w-4 mr-2" />
                Nota Fiscal (IA)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="spreadsheet" className="space-y-4 py-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Carregar Planilha</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Suporta arquivos CSV ou TXT com colunas: Nome, SKU, Tamanho, Cor, Preço de Custo, Quantidade
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleSpreadsheetUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Selecionar Arquivo
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="invoice" className="space-y-4 py-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Foto da Nota Fiscal</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  A IA irá extrair automaticamente: Produto, Tamanho, Cor, Preço de Custo, Fornecedor e SKU
                </p>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleInvoiceUpload}
                  className="hidden"
                />
                <Button onClick={() => imageInputRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                  {loading ? "Processando..." : "Tirar Foto / Carregar"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4 py-4">
            {supplierName && (
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Fornecedor identificado:</span>
                <span className="ml-2 font-medium">{supplierName}</span>
              </div>
            )}
            
            <SupplierSelect value={supplierId} onChange={setSupplierId} />

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, idx) => (
                    <TableRow key={idx} className={!product.selected ? "opacity-50" : ""}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleProduct(idx)}
                        >
                          {product.selected ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku || "-"}</TableCell>
                      <TableCell>{product.size || "-"}</TableCell>
                      <TableCell>{product.color || "-"}</TableCell>
                      <TableCell>R$ {product.cost_price.toFixed(2)}</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground">
              {products.filter(p => p.selected).length} de {products.length} produtos selecionados
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "review" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === "review" && (
            <Button onClick={handleImport} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Importar {products.filter(p => p.selected).length} Produtos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
