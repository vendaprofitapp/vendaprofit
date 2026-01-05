import { useState } from "react";
import { Plus, Search, Filter, Package, Edit, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const products = [
  { id: 1, name: "Legging Suplex Premium", category: "Calças", price: 79.90, stock: 45, status: "available" },
  { id: 2, name: "Top Esportivo Dry Fit", category: "Tops", price: 89.90, stock: 32, status: "available" },
  { id: 3, name: "Shorts Compressão", category: "Shorts", price: 59.90, stock: 3, status: "low" },
  { id: 4, name: "Conjunto Fitness Pro", category: "Conjuntos", price: 249.90, stock: 18, status: "available" },
  { id: 5, name: "Regata Performance", category: "Tops", price: 49.90, stock: 0, status: "out" },
  { id: 6, name: "Calça Jogger Fitness", category: "Calças", price: 129.90, stock: 25, status: "available" },
  { id: 7, name: "Body Academia", category: "Bodies", price: 99.90, stock: 5, status: "low" },
  { id: 8, name: "Bermuda Tactel", category: "Shorts", price: 69.90, stock: 42, status: "available" },
];

const statusConfig = {
  available: { label: "Disponível", variant: "default" as const },
  low: { label: "Baixo Estoque", variant: "secondary" as const },
  out: { label: "Esgotado", variant: "destructive" as const },
};

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seu catálogo de roupas fitness</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
        </Button>
      </div>

      {/* Products Table */}
      <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => {
              const status = statusConfig[product.status as keyof typeof statusConfig];
              return (
                <TableRow key={product.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.category}</TableCell>
                  <TableCell className="font-medium">
                    R$ {product.price.toFixed(2).replace(".", ",")}
                  </TableCell>
                  <TableCell>{product.stock} un.</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
}
