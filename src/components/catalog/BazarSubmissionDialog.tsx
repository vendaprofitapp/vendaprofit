import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Package, MapPin, Loader2, X } from "lucide-react";

interface BazarSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  sellerPhone: string;
  sellerName?: string;
  storeSlug: string;
}

interface AddressData {
  zip: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
}

export function BazarSubmissionDialog({
  open,
  onOpenChange,
  ownerId,
  sellerPhone,
  sellerName,
  storeSlug,
}: BazarSubmissionDialogProps) {
  const localKey = `bazar_address_${storeSlug}_${sellerPhone}`;
  const savedAddress = (() => {
    try {
      const s = localStorage.getItem(localKey);
      return s ? (JSON.parse(s) as AddressData) : null;
    } catch {
      return null;
    }
  })();

  const [step, setStep] = useState<1 | 2>(savedAddress ? 2 : 1);
  const [address, setAddress] = useState<AddressData>(
    savedAddress || { zip: "", street: "", number: "", neighborhood: "", city: "", state: "" }
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sellerPrice, setSellerPrice] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCepLookup = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddress((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {
      // ignore
    } finally {
      setFetchingCep(false);
    }
  };

  const handleAddressSubmit = () => {
    if (!address.zip || !address.street || !address.number || !address.neighborhood || !address.city || !address.state) {
      toast.error("Preencha todos os campos de endereço");
      return;
    }
    localStorage.setItem(localKey, JSON.stringify(address));
    setStep(2);
  };

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - images.length;
    const toAdd = files.slice(0, remaining);
    setImages((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("bazar-images").upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from("bazar-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Informe o título do item"); return; }
    const price = parseFloat(sellerPrice.replace(",", "."));
    if (isNaN(price) || price <= 0) { toast.error("Informe um valor válido"); return; }
    const wg = Math.round(parseFloat(weightKg.replace(",", ".")) * 1000);
    const h = parseInt(heightCm);
    const w = parseInt(widthCm);
    const l = parseInt(lengthCm);
    if (isNaN(wg) || wg <= 0 || isNaN(h) || h <= 0 || isNaN(w) || w <= 0 || isNaN(l) || l <= 0) {
      toast.error("Preencha todos os dados de embalagem corretamente");
      return;
    }

    setSubmitting(true);
    try {
      // Upload images
      const urls: (string | null)[] = [];
      for (const img of images) {
        urls.push(await uploadImage(img));
      }

      const { error } = await supabase.from("bazar_items").insert({
        owner_id: ownerId,
        seller_phone: sellerPhone,
        seller_name: sellerName || null,
        title: title.trim(),
        description: description.trim() || null,
        seller_price: price,
        weight_grams: wg,
        height_cm: h,
        width_cm: w,
        length_cm: l,
        image_url: urls[0] || null,
        image_url_2: urls[1] || null,
        image_url_3: urls[2] || null,
        seller_zip: address.zip,
        seller_street: address.street,
        seller_number: address.number,
        seller_neighborhood: address.neighborhood,
        seller_city: address.city,
        seller_state: address.state,
      });

      if (error) throw error;
      toast.success("Item enviado para análise da loja!");
      // Reset
      setTitle("");
      setDescription("");
      setSellerPrice("");
      setWeightKg("");
      setHeightCm("");
      setWidthCm("");
      setLengthCm("");
      setImages([]);
      setPreviews([]);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao enviar item: " + (err.message || "Tente novamente"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? <><MapPin className="h-5 w-5" /> Seu Endereço</> : <><Package className="h-5 w-5" /> Vender Minha Peça</>}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Precisamos do seu endereço para calcular o frete"
              : "Preencha os dados do item que deseja vender"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            <div>
              <Label>CEP *</Label>
              <Input
                placeholder="00000-000"
                value={address.zip}
                onChange={(e) => {
                  const v = e.target.value;
                  setAddress((p) => ({ ...p, zip: v }));
                  if (v.replace(/\D/g, "").length === 8) handleCepLookup(v);
                }}
                maxLength={9}
              />
              {fetchingCep && <p className="text-xs text-muted-foreground mt-1">Buscando endereço...</p>}
            </div>
            <div>
              <Label>Rua *</Label>
              <Input value={address.street} onChange={(e) => setAddress((p) => ({ ...p, street: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Número *</Label>
                <Input value={address.number} onChange={(e) => setAddress((p) => ({ ...p, number: e.target.value }))} />
              </div>
              <div>
                <Label>Bairro *</Label>
                <Input value={address.neighborhood} onChange={(e) => setAddress((p) => ({ ...p, neighborhood: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cidade *</Label>
                <Input value={address.city} onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <Label>Estado *</Label>
                <Input value={address.state} onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))} maxLength={2} placeholder="UF" />
              </div>
            </div>
            <Button className="w-full" onClick={handleAddressSubmit}>Continuar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Photos */}
            <div>
              <Label>Fotos (até 3)</Label>
              <div className="flex gap-2 mt-1">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary transition"
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
            </div>

            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Vestido floral tamanho M" maxLength={120} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do item..." rows={2} maxLength={500} />
            </div>
            <div>
              <Label>Valor que deseja receber (R$) *</Label>
              <Input value={sellerPrice} onChange={(e) => setSellerPrice(e.target.value)} placeholder="50,00" inputMode="decimal" />
            </div>

            {/* Package dimensions */}
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <p className="text-sm font-semibold flex items-center gap-1"><Package className="h-4 w-4" /> Dados da Embalagem *</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="0,5" inputMode="decimal" />
                </div>
                <div>
                  <Label className="text-xs">Altura (cm)</Label>
                  <Input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="10" inputMode="numeric" />
                </div>
                <div>
                  <Label className="text-xs">Largura (cm)</Label>
                  <Input value={widthCm} onChange={(e) => setWidthCm(e.target.value)} placeholder="20" inputMode="numeric" />
                </div>
                <div>
                  <Label className="text-xs">Comprimento (cm)</Label>
                  <Input value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} placeholder="30" inputMode="numeric" />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Enviar para Análise
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
