import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Package, TrendingUp, Pause, Play, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface HubConnection {
  id: string;
  owner_id: string;
  seller_id: string | null;
  invited_email: string;
  commission_pct: number;
  status: string;
  invite_code: string;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
  _sharedCount?: number;
  _splitTotal?: number;
}

interface Props {
  connection: HubConnection;
  isOwner: boolean;
  onManageProducts: (id: string) => void;
  onViewReport: (id: string) => void;
  onToggleStatus: (id: string, current: string) => void;
}

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Aguardando aceite", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  suspended: { label: "Suspenso", variant: "destructive" },
};

export function HubConnectionCard({ connection, isOwner, onManageProducts, onViewReport, onToggleStatus }: Props) {
  const status = statusLabel[connection.status] ?? statusLabel.pending;

  const copyCode = () => {
    navigator.clipboard.writeText(connection.invite_code);
    toast.success("Código copiado!");
  };

  const partnerName = isOwner
    ? (connection.profiles?.full_name || connection.invited_email)
    : "Dono do Estoque";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-sm truncate">{partnerName}</p>
              <Badge variant={status.variant} className="text-xs shrink-0">{status.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {isOwner ? `Comissão: ${connection.commission_pct}% do lucro bruto` : `Você recebe o lucro após comissão do dono`}
            </p>

            {connection.status === "pending" && isOwner && (
              <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
                <code className="text-xs font-mono text-muted-foreground">{connection.invite_code}</code>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={copyCode}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}

            {connection.status === "active" && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {connection._sharedCount ?? 0} produto(s)
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {(connection._splitTotal ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em splits
                </span>
              </div>
            )}
          </div>

          {connection.status === "active" && (
            <div className="flex flex-col gap-1.5 shrink-0">
              {isOwner && (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onManageProducts(connection.id)}>
                  <Package className="h-3 w-3 mr-1" />
                  Produtos
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onViewReport(connection.id)}>
                <ChevronRight className="h-3 w-3 mr-1" />
                Acerto
              </Button>
              {isOwner && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => onToggleStatus(connection.id, connection.status)}
                >
                  {connection.status === "active"
                    ? <><Pause className="h-3 w-3 mr-1" /> Suspender</>
                    : <><Play className="h-3 w-3 mr-1" /> Reativar</>}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
