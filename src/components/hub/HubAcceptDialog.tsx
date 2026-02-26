import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onAccepted: () => void;
  initialCode?: string;
}

export function HubAcceptDialog({ open, onClose, onAccepted, initialCode }: Props) {
  const [code, setCode] = useState(initialCode || "");

  useEffect(() => {
    if (open) setCode(initialCode || "");
  }, [open, initialCode]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("hub-accept-invite", {
        body: { invite_code: code.trim() },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      toast.success("Convite aceito! Você agora faz parte deste HUB.");
      onAccepted();
      onClose();
      setCode("");
    } catch (err: any) {
      toast.error(err.message || "Código inválido ou já utilizado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Entrar em um HUB</DialogTitle>
          <DialogDescription>
            Insira o código de convite que você recebeu do dono do estoque.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Código do convite</Label>
            <Input
              placeholder="ex: a1b2c3d4e5f6"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verificando..." : "Aceitar Convite"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
