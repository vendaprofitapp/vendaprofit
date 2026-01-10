import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
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

const emptyFormData = {
  name: "",
  cnpj: "",
  phone: "",
  attendant_name: "",
  attendant_phone: "",
  purchase_rules: "",
};

export function SupplierSelect({ value, onChange }: SupplierSelectProps) {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(emptyFormData);

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
    if (!user || !formData.name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: formData.name.trim(),
        cnpj: formData.cnpj.trim() || null,
        phone: formData.phone.trim() || null,
        attendant_name: formData.attendant_name.trim() || null,
        attendant_phone: formData.attendant_phone.trim() || null,
        purchase_rules: formData.purchase_rules.trim() || null,
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Erro ao criar fornecedor");
      return;
    }

    toast.success("Fornecedor criado!");
    setDialogOpen(false);
    setFormData(emptyFormData);
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
            <DialogDescription>Cadastre um novo fornecedor/marca</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="sm:col-span-2 space-y-2">
              <Label>Empresa *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da empresa/marca"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone Geral</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 0000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Atendente</Label>
              <Input
                value={formData.attendant_name}
                onChange={(e) => setFormData({ ...formData, attendant_name: e.target.value })}
                placeholder="Nome do atendente"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone Atendente</Label>
              <Input
                value={formData.attendant_phone}
                onChange={(e) => setFormData({ ...formData, attendant_phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Regras de Compras</Label>
              <Textarea
                value={formData.purchase_rules}
                onChange={(e) => setFormData({ ...formData, purchase_rules: e.target.value })}
                placeholder="Condições de pagamento, prazos, pedido mínimo..."
                rows={3}
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
