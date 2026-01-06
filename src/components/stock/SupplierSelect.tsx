import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
}

interface SupplierSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function SupplierSelect({ value, onChange }: SupplierSelectProps) {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", cnpj: "" });

  const fetchSuppliers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, cnpj")
      .eq("owner_id", user.id)
      .order("name");
    setSuppliers(data || []);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [user]);

  const handleCreateSupplier = async () => {
    if (!user || !newSupplier.name.trim()) {
      toast.error("Nome do fornecedor é obrigatório");
      return;
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: newSupplier.name.trim(),
        cnpj: newSupplier.cnpj.trim() || null,
        owner_id: user.id
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Erro ao criar fornecedor");
      return;
    }

    toast.success("Fornecedor criado!");
    setDialogOpen(false);
    setNewSupplier({ name: "", cnpj: "" });
    fetchSuppliers();
    
    if (data) {
      onChange(data.id);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Fornecedor</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione um fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
            <DialogDescription>Cadastre um novo fornecedor/marca</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="Nome do fornecedor"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={newSupplier.cnpj}
                onChange={(e) => setNewSupplier({ ...newSupplier, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSupplier}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
