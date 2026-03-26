import { useState } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function HubInviteDialog({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [email, setEmail, clearEmail] = useFormPersistence(`hub_invite_email_${user?.id || "anon"}`, "");
  const [commission, setCommission, clearCommission] = useFormPersistence(`hub_invite_comm_${user?.id || "anon"}`, "30");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("hub_connections").insert({
        owner_id: user.id,
        invited_email: email.toLowerCase().trim(),
        commission_pct: Number(commission),
        status: "pending",
      });

      if (error) throw error;

      toast.success("Convite criado! Compartilhe o código com o vendedor.");
      clearEmail(); clearCommission();
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar convite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Convidar Vendedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>E-mail do vendedor</Label>
            <Input
              type="email"
              placeholder="vendedor@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sua comissão sobre o lucro bruto (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Você receberá: Custo do produto + {commission}% do lucro bruto
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar Convite"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
