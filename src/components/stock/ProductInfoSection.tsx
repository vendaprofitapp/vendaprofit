import React from "react";
import { Globe, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FixedCategorySelector } from "@/components/products/FixedCategorySelector";
import { UrlProductImporter } from "@/components/stock/UrlProductImporter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
}

interface ProductForm {
  name: string;
  description: string;
  mainCategory: string;
  subcategory: string;
  isNewRelease: boolean;
  price: string;
  cost_price: string;
  min_stock_level: string;
  supplier_id: string;
  b2b_product_url: string;
  video_url: string | null;
  model: string;
  color_label: string;
  custom_detail: string;
  weight_grams: string;
  width_cm: string;
  height_cm: string;
  length_cm: string;
}

interface ProductInfoSectionProps {
  form: ProductForm;
  onFormChange: (updates: Partial<ProductForm>) => void;
  suppliers: Supplier[];
  isEditing: boolean;
  totalImages: number;
  onImportedData: (data: {
    name?: string;
    description?: string;
    price?: number;
    costPrice?: number;
    model?: string;
    colorLabel?: string;
    customDetail?: string;
    images?: string[];
    category?: string;
  }) => void;
}

export const ProductInfoSection = React.memo(function ProductInfoSection({
  form,
  onFormChange,
  suppliers,
  isEditing,
  totalImages,
  onImportedData,
}: ProductInfoSectionProps) {
  const [testingB2b, setTestingB2b] = React.useState(false);
  const [b2bStatus, setB2bStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

  const handleTestB2b = async () => {
    if (!form.b2b_product_url?.trim()) {
      toast.error("Preencha a URL do produto B2B primeiro");
      return;
    }
    setTestingB2b(true);
    setB2bStatus('idle');
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { url: form.b2b_product_url.trim(), options: { formats: ['markdown'] } }
      });
      if (error) throw error;
      const markdown = data?.data?.markdown || data?.markdown;
      if (markdown && markdown.length > 50) {
        setB2bStatus('success');
        toast.success("URL do produto acessível! Página encontrada.");
      } else {
        setB2bStatus('error');
        toast.error("Página acessada mas sem conteúdo suficiente.");
      }
    } catch {
      setB2bStatus('error');
      toast.error("Não foi possível acessar a URL do produto.");
    } finally {
      setTestingB2b(false);
    }
  };

  return (
    <>
      {/* Importação via URL do Fornecedor */}
      {!isEditing && (
        <UrlProductImporter 
          onDataImported={onImportedData} 
          maxImages={3}
          currentImageCount={totalImages}
        />
      )}

      {/* Nome do Produto */}
      <div className="space-y-2">
        <Label>Nome do Produto *</Label>
        <Input
          value={form.name}
          onChange={(e) => onFormChange({ name: e.target.value })}
          placeholder="Ex: Top Carol Vermelho"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Inclua a cor no nome (ex: "Vestido Luna Preto")</p>
      </div>
      
      {/* Descrição */}
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={form.description}
          onChange={(e) => onFormChange({ description: e.target.value })}
          placeholder="Descrição do produto"
          className="min-h-[80px]"
        />
      </div>

      {/* Categorias */}
      <div className="space-y-2">
        <FixedCategorySelector
          mainCategory={form.mainCategory}
          subcategory={form.subcategory}
          isNewRelease={form.isNewRelease}
          onMainCategoryChange={(value) => onFormChange({ mainCategory: value })}
          onSubcategoryChange={(value) => onFormChange({ subcategory: value })}
          onIsNewReleaseChange={(value) => onFormChange({ isNewRelease: value })}
        />
      </div>
      
      {/* Campos de Filtro */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Campos de Filtro (opcionais)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            value={form.model}
            onChange={(e) => onFormChange({ model: e.target.value })}
            placeholder="Modelo (ex: Top Carol)"
          />
          <Input
            value={form.color_label}
            onChange={(e) => onFormChange({ color_label: e.target.value })}
            placeholder="Cor (ex: Vermelho)"
          />
          <Input
            value={form.custom_detail}
            onChange={(e) => onFormChange({ custom_detail: e.target.value })}
            placeholder="Detalhe (ex: Brilhante)"
          />
        </div>
      </div>
      
      {/* Preços e Configurações */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Preço Venda *</Label>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => onFormChange({ price: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Preço Custo</Label>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={form.cost_price}
            onChange={(e) => onFormChange({ cost_price: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estoque Mín.</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={form.min_stock_level}
            onChange={(e) => onFormChange({ min_stock_level: e.target.value })}
            placeholder="5"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fornecedor</Label>
          <Select value={form.supplier_id} onValueChange={(value) => onFormChange({ supplier_id: value })}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* URL do Produto B2B */}
      {form.supplier_id && form.supplier_id !== "none" && (
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <Globe className="h-3 w-3 text-primary" /> URL do Produto B2B (Dropshipping)
          </Label>
          <div className="flex gap-2">
            <Input
              type="url"
              value={form.b2b_product_url}
              onChange={(e) => { onFormChange({ b2b_product_url: e.target.value }); setB2bStatus('idle'); }}
              placeholder="https://portal.fornecedor.com/produto/123"
              className="flex-1"
            />
            <Button
              type="button"
              variant={b2bStatus === 'success' ? 'default' : b2bStatus === 'error' ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleTestB2b}
              disabled={testingB2b || !form.b2b_product_url?.trim()}
              className="shrink-0"
            >
              {testingB2b ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Testando...</>
              ) : b2bStatus === 'success' ? (
                <><CheckCircle2 className="h-4 w-4 mr-1" /> OK</>
              ) : b2bStatus === 'error' ? (
                <><XCircle className="h-4 w-4 mr-1" /> Falhou</>
              ) : (
                <>Testar URL</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Link direto do produto no portal B2B do fornecedor (para venda sob encomenda)
          </p>
          {b2bStatus === 'success' && (
            <p className="text-xs text-green-600">✅ Produto acessível no fornecedor!</p>
          )}
          {b2bStatus === 'error' && (
            <p className="text-xs text-destructive">❌ Verifique a URL e tente novamente.</p>
          )}
        </div>
      )}

      {/* Peso e Dimensões */}
      <details className="pt-2 border-t">
        <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          📦 Peso e Dimensões (para cálculo de frete)
        </summary>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="space-y-1">
            <Label className="text-xs">Peso (g)</Label>
            <Input type="number" inputMode="numeric" value={form.weight_grams} onChange={(e) => onFormChange({ weight_grams: e.target.value })} placeholder="100" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Largura (cm)</Label>
            <Input type="number" inputMode="numeric" value={form.width_cm} onChange={(e) => onFormChange({ width_cm: e.target.value })} placeholder="5" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Altura (cm)</Label>
            <Input type="number" inputMode="numeric" value={form.height_cm} onChange={(e) => onFormChange({ height_cm: e.target.value })} placeholder="5" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comprimento (cm)</Label>
            <Input type="number" inputMode="numeric" value={form.length_cm} onChange={(e) => onFormChange({ length_cm: e.target.value })} placeholder="20" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Necessário para cotação automática de frete via Melhor Envio / SuperFrete.
        </p>
      </details>
    </>
  );
});
