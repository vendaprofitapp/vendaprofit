import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Package, TrendingUp, Pause, Play, ChevronRight, CheckCircle, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import type { HubConnection } from "@/pages/HubVendas";

interface Props {
  connection: HubConnection;
  isOwner: boolean;
  onManageProducts: (id: string) => void;
  onViewReport: (id: string) => void;
  onToggleStatus: (id: string, current: string) => void;
  onAcceptInvite?: (connection: HubConnection) => void;
  onDeleteInvite?: (id: string) => void;
  onArchive?: (id: string) => void;
}

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Aguardando aceite", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  suspended: { label: "Suspenso", variant: "destructive" },
};

export function HubConnectionCard({ connection, isOwner, onManageProducts, onViewReport, onToggleStatus, onAcceptInvite, onDeleteInvite, onArchive }: Props) {
  const status = statusLabel[connection.status] ?? statusLabel.pending;

  const copyCode = () => {
    navigator.clipboard.writeText(connection.invite_code);
    toast.success("Código copiado!");
  };

  // Resolve display names from enriched profiles
  const ownerName = connection.owner_profile?.full_name || "Dono";
  const sellerName = connection.seller_profile?.full_name || connection.invited_email;

  const partnerName = isOwner
    ? `Vendedora: ${sellerName}`
    : `Dono: ${ownerName}`;

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
              {isOwner
                ? `Você recebe: Custo + ${connection.commission_pct}% do lucro bruto`
                : `Comissão do dono: ${connection.commission_pct}% do lucro bruto`}
            </p>

            {connection.status === "pending" && isOwner && (
              <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
                <code className="text-xs font-mono text-muted-foreground flex-1">{connection.invite_code}</code>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={copyCode}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}

            {connection.status === "pending" && !isOwner && onAcceptInvite && (
              <Button
                size="sm"
                className="mt-2 gap-1.5"
                onClick={() => onAcceptInvite(connection)}
              >
                <CheckCircle className="h-4 w-4" />
                Aceitar Convite
              </Button>
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

          {connection.status === "pending" && isOwner && onDeleteInvite && (
            <div className="shrink-0 self-start">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDeleteInvite(connection.id)}
                title="Excluir convite"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {connection.status === "active" && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onManageProducts(connection.id)}>
                <Package className="h-3 w-3 mr-1" />
                Produtos
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onViewReport(connection.id)}>
                <ChevronRight className="h-3 w-3 mr-1" />
                Acerto
              </Button>
              {isOwner && (
                <>
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
                  {onArchive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => onArchive(connection.id)}
                      title="Encerrar parceria (preserva histórico)"
                    >
                      <Archive className="h-3 w-3 mr-1" />
                      Encerrar
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
