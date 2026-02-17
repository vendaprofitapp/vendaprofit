import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Store, Globe, ShoppingBag, ArrowRight, ArrowLeft, Check } from "lucide-react";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

const BRANDS = ["BECHOSE", "INMOOV", "NEW HYPE", "POWERED BY COFFEE", "YOPP"];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [originZip, setOriginZip] = useState("");
  const [cpf, setCpf] = useState("");

  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [otherBrand, setOtherBrand] = useState("");

  const step1Valid = storeName.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10 && originZip.replace(/\D/g, "").length === 8;

  const handleNext = () => {
    if (step === 1) {
      if (!slugEdited) {
        setSlug(slugify(storeName));
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleFinish = async () => {
    if (!user?.id) return;
    setSaving(true);

    try {
      // Step 1: Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          store_name: storeName.trim(),
          phone: phone.replace(/\D/g, ""),
          origin_zip: originZip.replace(/\D/g, ""),
          cpf: cpf.replace(/\D/g, "") || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Step 2: Create store_settings
      const finalSlug = slug || slugify(storeName);
      const { error: storeError } = await supabase
        .from("store_settings")
        .insert({
          owner_id: user.id,
          store_slug: finalSlug,
          store_name: storeName.trim(),
          whatsapp_number: phone.replace(/\D/g, ""),
        });

      if (storeError && !storeError.message.includes("duplicate")) throw storeError;

      // Step 3: Brand requests for "other" brand
      if (otherBrand.trim()) {
        await supabase.from("brand_requests").insert({
          user_id: user.id,
          brand_name: otherBrand.trim(),
        });
      }

      toast.success("Configuração concluída! Bem-vindo ao Venda Profit 🎉");
      onComplete();
    } catch (err: any) {
      console.error("Onboarding error:", err);
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const stepIcons = [Store, Globe, ShoppingBag];
  const stepLabels = ["Identidade", "Loja Online", "Marcas"];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Configuração Inicial</DialogTitle>
          <DialogDescription>
            Vamos configurar sua revenda em poucos passos.
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between">
            {stepLabels.map((label, i) => {
              const Icon = stepIcons[i];
              const active = step === i + 1;
              const done = step > i + 1;
              return (
                <div key={label} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`rounded-full p-2 ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs ${active || done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
                </div>
              );
            })}
          </div>
          <Progress value={(step / 3) * 100} className="h-1.5" />
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="storeName">Nome da revenda *</Label>
              <Input id="storeName" placeholder="Ex: Moda Bella" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp *</Label>
              <Input id="phone" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="originZip">CEP de origem *</Label>
                <Input id="originZip" placeholder="00000-000" value={originZip} onChange={(e) => setOriginZip(maskCEP(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug da sua loja</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugEdited(true);
                }}
                placeholder="minha-loja"
              />
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Sua loja ficará disponível em:</p>
              <p className="text-sm font-medium text-primary mt-1">
                vendaprofit.lovable.app/loja/{slug || slugify(storeName) || "sua-loja"}
              </p>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Selecione as marcas que você deseja revender. Os produtos serão adicionados automaticamente ao seu catálogo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {BRANDS.map((brand) => (
                <label
                  key={brand}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedBrands.includes(brand) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedBrands.includes(brand)}
                    onCheckedChange={() => toggleBrand(brand)}
                  />
                  <span className="text-sm font-medium">{brand}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="otherBrand">Outra marca?</Label>
              <Input
                id="otherBrand"
                placeholder="Nome da marca que você gostaria"
                value={otherBrand}
                onChange={(e) => setOtherBrand(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <Button onClick={handleNext} disabled={step === 1 && !step1Valid}>
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={saving}>
              {saving ? "Salvando..." : "Finalizar"} <Check className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
