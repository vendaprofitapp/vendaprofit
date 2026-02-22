import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, Camera, Mic, MicOff, X, Minus, Save, Loader2, Power,
} from "lucide-react";

interface BagItem {
  buttonId: string;
  label: string;
  price: number;
  quantity: number;
}

const EVENT_NAME_KEY = "vp_active_event_name";

export default function EventMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Event name gate
  const [eventName, setEventName] = useState(() => localStorage.getItem(EVENT_NAME_KEY) || "");
  const [eventNameInput, setEventNameInput] = useState("");
  const [showEventNameDialog, setShowEventNameDialog] = useState(!localStorage.getItem(EVENT_NAME_KEY));

  // Bag state
  const [bagItems, setBagItems] = useState<BagItem[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // New button dialog
  const [showNewButton, setShowNewButton] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newColor, setNewColor] = useState("#8B5CF6");

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const stoppingRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch quick buttons
  const { data: buttons = [] } = useQuery({
    queryKey: ["event_quick_buttons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_quick_buttons")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Add quick button to bag
  const addToBag = useCallback((btn: typeof buttons[0]) => {
    setBagItems((prev) => {
      const existing = prev.find((i) => i.buttonId === btn.id);
      if (existing) {
        return prev.map((i) =>
          i.buttonId === btn.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { buttonId: btn.id, label: btn.label, price: Number(btn.default_price) || 0, quantity: 1 },
      ];
    });
  }, []);

  const updateQty = (buttonId: string, delta: number) => {
    setBagItems((prev) =>
      prev
        .map((i) => (i.buttonId === buttonId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const total = bagItems.reduce((s, i) => s + i.price * i.quantity, 0);

  // Photos
  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((p) => [...p, ...files]);
    files.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPhotoPreviewUrls((p) => [...p, url]);
    });
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviewUrls[idx]);
    setPhotos((p) => p.filter((_, i) => i !== idx));
    setPhotoPreviewUrls((p) => p.filter((_, i) => i !== idx));
  };

  // Voice recognition
  const toggleRecording = () => {
    if (isRecording) {
      stoppingRef.current = true;
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Navegador não suporta reconhecimento de voz", variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setNotes((prev) => (prev ? prev + " " : "") + transcript);
    };
    recognition.onerror = (event: any) => {
      const ignorable = ["no-speech", "aborted"];
      if (ignorable.includes(event.error)) return;
      stoppingRef.current = true;
      setIsRecording(false);
      toast({ title: "Erro no reconhecimento de voz", description: event.error, variant: "destructive" });
    };
    recognition.onend = () => {
      if (!stoppingRef.current) {
        try { recognition.start(); } catch (_) { setIsRecording(false); }
      } else {
        setIsRecording(false);
      }
    };
    stoppingRef.current = false;
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  // Create new quick button
  const createButton = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("event_quick_buttons").insert({
        label: newLabel,
        default_price: newPrice ? Number(newPrice) : null,
        color: newColor,
        sort_order: buttons.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_quick_buttons"] });
      setShowNewButton(false);
      setNewLabel("");
      setNewPrice("");
      setNewColor("#8B5CF6");
      toast({ title: "Botão criado!" });
    },
  });

  // Save draft
  const saveDraft = async () => {
    if (!user || (bagItems.length === 0 && photos.length === 0 && !notes.trim())) {
      toast({ title: "Adicione ao menos um item à sacola", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Upload photos in parallel
      const uploadedUrls: string[] = [];
      if (photos.length > 0) {
        const uploads = photos.map(async (file) => {
          const path = `${user.id}/${Date.now()}-${file.name}`;
          const { error } = await supabase.storage.from("event-photos").upload(path, file);
          if (error) throw error;
          const { data } = supabase.storage.from("event-photos").getPublicUrl(path);
          return data.publicUrl;
        });
        const urls = await Promise.all(uploads);
        uploadedUrls.push(...urls);
      }

      // Save draft
      const items = bagItems.map((i) => ({
        button_id: i.buttonId,
        label: i.label,
        quantity: i.quantity,
        price: i.price,
      }));

      const { error } = await supabase.from("event_sale_drafts").insert({
        items,
        photo_urls: uploadedUrls,
        notes: notes || null,
        estimated_total: total,
      });
      if (error) throw error;

      // Clear state
      setBagItems([]);
      photoPreviewUrls.forEach((u) => URL.revokeObjectURL(u));
      setPhotos([]);
      setPhotoPreviewUrls([]);
      setNotes("");
      toast({ title: "✅ Rascunho salvo!", description: "Pronto para o próximo cliente!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      photoPreviewUrls.forEach((u) => URL.revokeObjectURL(u));
      stoppingRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  const confirmEventName = () => {
    if (!eventNameInput.trim()) return;
    const name = eventNameInput.trim();
    setEventName(name);
    localStorage.setItem(EVENT_NAME_KEY, name);
    setShowEventNameDialog(false);
  };

  const changeEventName = () => {
    setEventNameInput(eventName);
    setShowEventNameDialog(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Event Name Gate Dialog */}
      <Dialog open={showEventNameDialog} onOpenChange={(open) => {
        if (!open && !eventName) {
          navigate("/");
          return;
        }
        setShowEventNameDialog(open);
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nome do Evento</DialogTitle>
            <DialogDescription>Informe o nome do evento para identificar as vendas no relatório.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome do Evento</Label>
              <Input
                placeholder="Ex: Feira da Vila, Bazar Solidário..."
                value={eventNameInput}
                onChange={(e) => setEventNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmEventName(); }}
                autoFocus
              />
            </div>
            <Button className="w-full" disabled={!eventNameInput.trim()} onClick={confirmEventName}>
              Iniciar Evento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Badge className="bg-green-600 text-white gap-1.5 text-sm py-1 px-3 cursor-pointer" onClick={changeEventName}>
          <span className="h-2 w-2 rounded-full bg-white animate-pulse inline-block" />
          {eventName || "Modo Evento Ativo"}
        </Badge>
        <Button
          variant="destructive"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => {
            // Preserve event name for reconciliation after session ends
            if (eventName) {
              localStorage.setItem("vp_last_event_name", eventName);
            }
            localStorage.removeItem(EVENT_NAME_KEY);
            setEventName("");
            toast({ title: "Evento encerrado", description: "Você pode voltar ao Modo Evento quando quiser." });
            navigate("/");
          }}
        >
          <Power className="h-4 w-4" />
          Encerrar
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-6">
        {/* Quick Buttons Grid */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Botões Rápidos</h2>
          <div className="grid grid-cols-3 gap-2">
            {buttons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => addToBag(btn)}
                className="rounded-xl py-4 px-2 text-white font-bold text-sm shadow-md active:scale-95 transition-transform"
                style={{ backgroundColor: btn.color }}
              >
                {btn.label}
                {btn.default_price != null && (
                  <span className="block text-xs font-normal opacity-80 mt-0.5">
                    R$ {Number(btn.default_price).toFixed(2)}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowNewButton(true)}
              className="rounded-xl py-4 px-2 border-2 border-dashed border-muted-foreground/30 text-muted-foreground font-bold text-sm flex flex-col items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="h-6 w-6 mb-1" />
              Novo
            </button>
          </div>
        </section>

        {/* Bag */}
        {bagItems.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Sacola Atual</h2>
            <div className="space-y-2">
              {bagItems.map((item) => (
                <div
                  key={item.buttonId}
                  className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="font-medium text-sm">{item.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      R$ {item.price.toFixed(2)} × {item.quantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold w-16 text-right">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQty(item.buttonId, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQty(item.buttonId, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Camera */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Fotos</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handlePhotos}
          />
          <Button
            variant="outline"
            className="w-full h-14 text-base gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-5 w-5" />
            Tirar Foto
          </Button>
          {photoPreviewUrls.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              {photoPreviewUrls.map((url, idx) => (
                <div key={idx} className="relative shrink-0 w-16 h-16">
                  <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Voice */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Observações</h2>
          <Button
            variant={isRecording ? "destructive" : "outline"}
            className="w-full h-14 text-base gap-2 mb-2"
            onClick={toggleRecording}
          >
            {isRecording ? (
              <>
                <MicOff className="h-5 w-5" />
                <span className="animate-pulse">Gravando... Toque para parar</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Gravar Observação por Voz
              </>
            )}
          </Button>
          <Textarea
            placeholder="Notas sobre a venda..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </section>
      </main>

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background border-t px-4 py-3 space-y-2 z-30 shrink-0">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total estimado</span>
          <span className="text-xl font-bold">R$ {total.toFixed(2)}</span>
        </div>
        <Button
          className="w-full h-14 text-lg font-bold gap-2"
          disabled={saving || (bagItems.length === 0 && photos.length === 0 && !notes.trim())}
          onClick={saveDraft}
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "Salvando..." : "Salvar Rascunho"}
        </Button>
      </footer>

      {/* New Button Dialog */}
      <Dialog open={showNewButton} onOpenChange={setShowNewButton}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Botão Rápido</DialogTitle>
            <DialogDescription>Crie um atalho para adicionar itens rapidamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Rótulo</Label>
              <Input placeholder="Ex: Legging" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </div>
            <div>
              <Label>Preço padrão (opcional)</Label>
              <Input type="number" placeholder="0.00" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {["#8B5CF6", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#EC4899"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="w-8 h-8 rounded-full border-2 transition-transform"
                    style={{
                      backgroundColor: c,
                      borderColor: newColor === c ? "white" : "transparent",
                      transform: newColor === c ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!newLabel.trim() || createButton.isPending}
              onClick={() => createButton.mutate()}
            >
              {createButton.isPending ? "Criando..." : "Criar Botão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
