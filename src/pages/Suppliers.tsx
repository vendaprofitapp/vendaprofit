import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Building2, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  attendant_name: string | null;
  attendant_phone: string | null;
  purchase_rules: string | null;
  website: string | null;
  created_at: string;
}

const emptySupplier = {
  name: "",
  cnpj: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  attendant_name: "",
  attendant_phone: "",
  purchase_rules: "",
  website: "",
};

export default function Suppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState(emptySupplier);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSuppliers = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("owner_id", user.id)
      .order("name");

    if (error) {
      toast.error("Erro ao carregar fornecedores");
    } else {
      setSuppliers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [user]);

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        cnpj: supplier.cnpj || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        notes: supplier.notes || "",
        attendant_name: supplier.attendant_name || "",
        attendant_phone: supplier.attendant_phone || "",
        purchase_rules: supplier.purchase_rules || "",
        website: supplier.website || "",
      });
    } else {
      setEditingSupplier(null);
      setFormData(emptySupplier);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      cnpj: formData.cnpj.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      notes: formData.notes.trim() || null,
      attendant_name: formData.attendant_name.trim() || null,
      attendant_phone: formData.attendant_phone.trim() || null,
      purchase_rules: formData.purchase_rules.trim() || null,
      website: formData.website.trim() || null,
      owner_id: user.id,
    };

    if (editingSupplier) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editingSupplier.id);

      if (error) {
        toast.error("Erro ao atualizar fornecedor");
        return;
      }
      toast.success("Fornecedor atualizado!");
    } else {
      const { error } = await supabase.from("suppliers").insert(payload);

      if (error) {
        toast.error("Erro ao criar fornecedor");
        return;
      }
      toast.success("Fornecedor criado!");
    }

    setDialogOpen(false);
    fetchSuppliers();
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;

    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplierToDelete.id);

    if (error) {
      toast.error("Erro ao excluir fornecedor. Verifique se não há produtos vinculados.");
      return;
    }

    toast.success("Fornecedor excluído!");
    setDeleteDialogOpen(false);
    setSupplierToDelete(null);
    fetchSuppliers();
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.attendant_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
            <p className="text-muted-foreground">
              Gerencie seus fornecedores e marcas
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Fornecedor
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Lista de Fornecedores ({filteredSuppliers.length})
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm
                  ? "Nenhum fornecedor encontrado"
                  : "Nenhum fornecedor cadastrado"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Telefone Geral</TableHead>
                      <TableHead>Atendente</TableHead>
                      <TableHead>Tel. Atendente</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">
                          {supplier.name}
                        </TableCell>
                        <TableCell>{supplier.cnpj || "-"}</TableCell>
                        <TableCell>{supplier.phone || "-"}</TableCell>
                        <TableCell>{supplier.attendant_name || "-"}</TableCell>
                        <TableCell>{supplier.attendant_phone || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(supplier)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSupplierToDelete(supplier);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do fornecedor
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="sm:col-span-2 space-y-2">
                <Label>Empresa *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Nome da empresa/marca"
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) =>
                    setFormData({ ...formData, cnpj: e.target.value })
                  }
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone Geral</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Atendente</Label>
                <Input
                  value={formData.attendant_name}
                  onChange={(e) =>
                    setFormData({ ...formData, attendant_name: e.target.value })
                  }
                  placeholder="Nome do atendente"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone Atendente</Label>
                <Input
                  value={formData.attendant_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, attendant_phone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Endereço completo"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Site do Fornecedor</Label>
                <Input
                  type="url"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://www.fornecedor.com.br"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Regras de Compras</Label>
                <Textarea
                  value={formData.purchase_rules}
                  onChange={(e) =>
                    setFormData({ ...formData, purchase_rules: e.target.value })
                  }
                  placeholder="Condições de pagamento, prazos de entrega, pedido mínimo, etc."
                  rows={3}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Observações gerais sobre o fornecedor"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingSupplier ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o fornecedor "
                {supplierToDelete?.name}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
