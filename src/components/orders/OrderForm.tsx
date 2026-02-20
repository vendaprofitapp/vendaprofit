import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { supabase } from "@/integrations/supabase/client";
import { useOrders, OrderFormData } from "@/hooks/useOrders";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  supplier_id: string | null;
  suppliers?: {
    name: string;
  } | null;
}

export function OrderForm() {
  const { createOrder } = useOrders();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue, clearSearchValue] = useFormPersistence("orders_searchValue", "");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCustomProduct, setIsCustomProduct] = useState(false);

  const [formData, setFormData, clearFormData] = useFormPersistence<OrderFormData>("orders_formData", {
    customer_name: "",
    product_id: null,
    product_name: "",
    supplier_name: "",
    quantity: 1,
    notes: "",
  });

  // Fetch products with suppliers
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          supplier_id,
          suppliers:supplier_id (name)
        `)
        .order("name");

      if (error) throw error;
      return data as Product[];
    },
  });

  // Filter products based on search
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setIsCustomProduct(false);
    setFormData({
      ...formData,
      product_id: product.id,
      product_name: product.name,
      supplier_name: product.suppliers?.name || "",
    });
    setOpen(false);
  };

  const handleCustomProduct = () => {
    setSelectedProduct(null);
    setIsCustomProduct(true);
    setFormData({
      ...formData,
      product_id: null,
      product_name: searchValue,
      supplier_name: "",
    });
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name.trim()) {
      toast.error("Preencha o nome do cliente");
      return;
    }
    if (!formData.product_name.trim()) {
      toast.error("Selecione ou digite o nome do produto");
      return;
    }
    if (!formData.supplier_name.trim()) {
      toast.error("Preencha o nome do fornecedor");
      return;
    }

    await createOrder.mutateAsync(formData);

    // Reset form and clear persistence
    clearFormData();
    clearSearchValue();
    setFormData({
      customer_name: "",
      product_id: null,
      product_name: "",
      supplier_name: "",
      quantity: 1,
      notes: "",
    });
    setSelectedProduct(null);
    setIsCustomProduct(false);
    setSearchValue("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Nova Encomenda
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Combobox */}
          <div className="space-y-2">
            <Label>Produto *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {formData.product_name || "Buscar ou criar produto..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Digite o nome do produto..."
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <CommandList>
                    <CommandEmpty className="py-2">
                      {searchValue && (
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-primary"
                          onClick={handleCustomProduct}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Criar encomenda: "{searchValue}"
                        </Button>
                      )}
                    </CommandEmpty>
                    <CommandGroup heading="Produtos cadastrados">
                      {filteredProducts.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.id}
                          onSelect={() => handleProductSelect(product)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProduct?.id === product.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{product.name}</span>
                            {product.suppliers?.name && (
                              <span className="text-xs text-muted-foreground">
                                {product.suppliers.name}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {searchValue && filteredProducts.length > 0 && (
                      <CommandGroup heading="Novo produto">
                        <CommandItem onSelect={handleCustomProduct}>
                          <Plus className="mr-2 h-4 w-4 text-primary" />
                          <span className="text-primary">
                            Criar encomenda: "{searchValue}"
                          </span>
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Supplier field */}
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            {selectedProduct && !isCustomProduct ? (
              <Input
                value={formData.supplier_name}
                disabled
                className="bg-muted"
              />
            ) : (
              <Input
                placeholder="Nome do fornecedor"
                value={formData.supplier_name}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_name: e.target.value })
                }
                required
              />
            )}
          </div>

          {/* Customer name */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Input
              placeholder="Nome da cliente"
              value={formData.customer_name}
              onChange={(e) =>
                setFormData({ ...formData, customer_name: e.target.value })
              }
              required
            />
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              type="number"
              min={1}
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
              }
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Tamanho, cor, especificações..."
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createOrder.isPending}
          >
            {createOrder.isPending ? "Salvando..." : "Salvar Encomenda"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
