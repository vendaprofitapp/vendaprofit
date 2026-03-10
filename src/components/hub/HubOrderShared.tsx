/**
 * HubOrderShared.tsx
 * Shared types, constants and UI primitives for the HUB order state machine.
 */
import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Clock, CheckCircle2, Truck, AlertCircle, XCircle,
  Upload, FileText, ImageIcon, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────────────
export const VENDA_PROFIT_FEE = 5.0;
export const PLATFORM_PIX_KEY = "vendaprofit@pagamentos.com.br"; // simulado
export const PLATFORM_PIX_NAME = "Venda PROFIT Tecnologia LTDA";
export const STORAGE_BUCKET = "hub-shipping-labels";

// ─── Status lifecycle ─────────────────────────────────────────────────────────
export type OrderStatus =
  | "pending"              // aguardando aprovação manual
  | "aguardando_pagamento"
  | "pagamento_em_analise"
  | "aguardando_etiqueta"
  | "aguardando_postagem"
  | "concluido"
  | "completed"            // legacy alias
  | "approved"             // legacy alias → tratado como aguardando_pagamento
  | "rejected";

export const STATUS_CONFIG: Record<string, {
  label: string;
  badgeClass: string;
  icon: React.ElementType;
  step: number;
}> = {
  pending:              { label: "Aguardando Aprovação", badgeClass: "bg-amber-500/10 text-amber-700 border-amber-300",      icon: Clock,         step: 0 },
  aguardando_pagamento: { label: "Aguardando Pagamento", badgeClass: "bg-orange-500/10 text-orange-700 border-orange-300",   icon: AlertCircle,   step: 1 },
  approved:             { label: "Aguardando Pagamento", badgeClass: "bg-orange-500/10 text-orange-700 border-orange-300",   icon: AlertCircle,   step: 1 },
  pagamento_em_analise: { label: "Pagamento em Análise", badgeClass: "bg-blue-500/10 text-blue-700 border-blue-300",         icon: Clock,         step: 2 },
  aguardando_etiqueta:  { label: "Aguardando Etiqueta",  badgeClass: "bg-violet-500/10 text-violet-700 border-violet-300",   icon: Truck,         step: 3 },
  aguardando_postagem:  { label: "Aguardando Postagem",  badgeClass: "bg-indigo-500/10 text-indigo-700 border-indigo-300",   icon: Truck,         step: 4 },
  concluido:            { label: "Concluído",             badgeClass: "bg-green-500/10 text-green-700 border-green-300",      icon: CheckCircle2,  step: 5 },
  completed:            { label: "Concluído",             badgeClass: "bg-green-500/10 text-green-700 border-green-300",      icon: CheckCircle2,  step: 5 },
  rejected:             { label: "Recusado",              badgeClass: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle,   step: -1 },
};

export const PIPELINE_STEPS = [
  { key: "pending",              label: "Aprovação"   },
  { key: "aguardando_pagamento", label: "Pagamento"   },
  { key: "pagamento_em_analise", label: "Análise"     },
  { key: "aguardando_etiqueta",  label: "Etiqueta"    },
  { key: "aguardando_postagem",  label: "Postagem"    },
  { key: "concluido",            label: "Concluído"   },
];

// ─── StatusBadge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["pending"];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold gap-1 flex-shrink-0", cfg.badgeClass)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

// ─── OrderTimeline ────────────────────────────────────────────────────────────
export function OrderTimeline({ status }: { status: string }) {
  if (status === "rejected") return null;
  const currentStep = STATUS_CONFIG[status]?.step ?? 0;

  return (
    <div className="flex items-center w-full">
      {PIPELINE_STEPS.map((step, idx) => {
        const isDone = idx <= currentStep;
        const isCurrent = idx === currentStep;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                isDone
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-background border-muted-foreground/30 text-muted-foreground"
              )}>
                <span className="text-[8px] font-bold">{idx + 1}</span>
              </div>
              <span className={cn(
                "text-[9px] text-center w-12 leading-tight hidden sm:block",
                isDone ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-0.5 mb-3 rounded transition-all",
                idx < currentStep ? "bg-primary" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PIX Display ─────────────────────────────────────────────────────────────
export function PixCard({
  label,
  pixKey,
  amount,
  name,
  accent = false,
}: {
  label: string;
  pixKey: string;
  amount: number;
  name?: string;
  accent?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Chave PIX copiada!");
  };

  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-2",
      accent
        ? "border-primary/30 bg-primary/5"
        : "border-border bg-muted/30"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("text-base font-bold", accent ? "text-primary" : "text-foreground")}>
          R$ {amount.toFixed(2)}
        </p>
      </div>
      {name && <p className="text-xs text-muted-foreground">{name}</p>}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 font-mono truncate">
          {pixKey}
        </code>
        <Button
          size="sm"
          variant={copied ? "default" : "outline"}
          className="h-7 w-7 p-0 flex-shrink-0"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

// ─── FileUploadZone ───────────────────────────────────────────────────────────
interface FileUploadZoneProps {
  label: string;
  hint?: string;
  accept?: string;
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  uploading?: boolean;
  className?: string;
}

export function FileUploadZone({
  label,
  hint,
  accept = "image/*,application/pdf",
  currentUrl,
  onUpload,
  uploading = false,
  className,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const isPdf = currentUrl?.toLowerCase().endsWith(".pdf");
  const isImage = currentUrl && !isPdf;

  const handleFile = async (file: File) => {
    if (!file) return;
    await onUpload(file);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {/* Current file preview */}
      {currentUrl && !uploading && (
        <div className="rounded-xl border border-green-300 bg-green-500/5 p-2.5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          {isImage ? (
            <img src={currentUrl} alt="comprovativo" className="h-12 rounded object-cover" />
          ) : (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline flex items-center gap-1"
            >
              <FileText className="h-3.5 w-3.5" /> Abrir ficheiro
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 text-[10px]"
            onClick={() => inputRef.current?.click()}
          >
            Trocar
          </Button>
        </div>
      )}

      {/* Drop zone */}
      {!currentUrl || uploading ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30",
            uploading && "opacity-60 pointer-events-none"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground">A enviar...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              {accept.includes("pdf") && !accept.includes("image") ? (
                <FileText className="h-6 w-6 text-muted-foreground/50" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
              )}
              <p className="text-xs font-medium text-muted-foreground">Clique ou arraste aqui</p>
              <p className="text-[10px] text-muted-foreground/60">
                {accept.includes("pdf") ? "PDF ou Imagem" : "JPG, PNG, WEBP"}
              </p>
            </div>
          )}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Storage upload helper ────────────────────────────────────────────────────
export async function uploadOrderFile(
  orderId: string,
  slot: "supplier-receipt" | "platform-receipt" | "shipping-label",
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `orders/${orderId}/${slot}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
