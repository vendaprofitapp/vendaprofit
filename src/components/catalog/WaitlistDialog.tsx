import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWaitlist } from "@/hooks/useWaitlist";
import { Bell, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface WaitlistDialogProps {
  productId: string;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryColor?: string;
}

export function WaitlistDialog({ 
  productId, 
  productName, 
  open, 
  onOpenChange,
  primaryColor = "#000000"
}: WaitlistDialogProps) {
  const { addToWaitlist, loading } = useWaitlist();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() && !phone.trim()) {
      toast.error("Informe seu nome ou telefone");
      return;
    }

    const result = await addToWaitlist({
      product_id: productId,
      customer_name: name.trim() || undefined,
      customer_phone: phone.trim() || undefined,
    });

    if (result) {
      setSuccess(true);
    }
  };

  const handleClose = () => {
    setName("");
    setPhone("");
    setSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" style={{ color: primaryColor }} />
            {success ? "Você está na fila!" : "Entrar na Fila de Espera"}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Check className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <h3 className="font-medium mb-2">Cadastro realizado!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Você será avisado assim que o produto <strong>{productName}</strong> estiver disponível.
            </p>
            <Button onClick={handleClose} style={{ backgroundColor: primaryColor }}>
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deixe seus dados para ser avisado quando <strong>{productName}</strong> estiver disponível.
            </p>

            <div className="space-y-2">
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                placeholder="Maria Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full gap-2"
              style={{ backgroundColor: primaryColor }}
              disabled={loading || (!name.trim() && !phone.trim())}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              Me Avise Quando Chegar
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
