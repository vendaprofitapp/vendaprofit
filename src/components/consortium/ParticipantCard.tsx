import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Package, 
  MessageCircle, 
  Trophy, 
  AlertTriangle, 
  CheckCircle, 
  X,
  UserX,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Participant {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  payment_method: string;
  payment_due_day: number | null;
  is_drawn: boolean;
  drawn_at: string | null;
  notes: string | null;
  status: "active" | "withdrawn" | "replaced";
  current_balance: number;
  first_shipping_used: boolean;
}

interface Winner {
  id: string;
  participant_id: string;
  participant_name: string;
  items_total: number;
}

interface PaymentStatus {
  isOverdue: boolean;
  overdueCount: number;
  paidCount: number;
  totalCount: number;
}

interface Props {
  participant: Participant;
  winner: Winner | null;
  consortiumValue: number;
  paymentStatus?: PaymentStatus;
  onViewPayments: () => void;
  onViewItems: () => void;
  onWhatsApp: () => void;
  onWithdraw: () => void;
  onRemove: () => void;
  onChargeOverdue: () => void;
}

export function ParticipantCard({
  participant,
  winner,
  consortiumValue,
  paymentStatus,
  onViewPayments,
  onViewItems,
  onWhatsApp,
  onWithdraw,
  onRemove,
  onChargeOverdue,
}: Props) {
  const remaining = winner ? Number(consortiumValue) - winner.items_total : null;

  const getStatusBadge = () => {
    if (participant.status === "withdrawn") {
      return (
        <Badge variant="destructive" className="gap-1">
          <UserX className="h-3 w-3" />
          Desistente
        </Badge>
      );
    }
    
    if (participant.is_drawn) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 gap-1">
          <Trophy className="h-3 w-3" />
          Sorteado
        </Badge>
      );
    }

    if (paymentStatus?.isOverdue) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Em Atraso ({paymentStatus.overdueCount})
        </Badge>
      );
    }

    return (
      <Badge className="bg-green-500/10 text-green-500 gap-1">
        <CheckCircle className="h-3 w-3" />
        Adimplente
      </Badge>
    );
  };

  return (
    <Card className={`bg-card border-border ${participant.status === "withdrawn" ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{participant.customer_name}</h3>
              {participant.customer_phone && (
                <p className="text-sm text-muted-foreground">{participant.customer_phone}</p>
              )}
            </div>
            {getStatusBadge()}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Pagamento:</span>
              <span className="ml-1 capitalize">{participant.payment_method.replace("_", " ")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vencimento:</span>
              <span className="ml-1">Dia {participant.payment_due_day || 10}</span>
            </div>
            {paymentStatus && (
              <div>
                <span className="text-muted-foreground">Parcelas:</span>
                <span className="ml-1">
                  {paymentStatus.paidCount}/{paymentStatus.totalCount}
                </span>
              </div>
            )}
            {winner && (
              <div>
                <span className="text-muted-foreground">Saldo:</span>
                <span className={`ml-1 font-medium ${
                  remaining === 0 
                    ? "text-green-500" 
                    : remaining && remaining < 0 
                      ? "text-destructive" 
                      : ""
                }`}>
                  R$ {remaining?.toFixed(2)}
                </span>
              </div>
            )}
            {participant.status === "withdrawn" && participant.current_balance > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Crédito disponível:</span>
                <span className="ml-1 font-medium text-primary">
                  R$ {participant.current_balance.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 flex-1 min-w-[100px]"
              onClick={onViewPayments}
            >
              <DollarSign className="h-4 w-4" />
              Parcelas
            </Button>

            {winner && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 flex-1 min-w-[100px]"
                onClick={onViewItems}
              >
                <Package className="h-4 w-4" />
                Peças
              </Button>
            )}

            {participant.customer_phone && (
              <Button
                variant="outline"
                size="sm"
                onClick={onWhatsApp}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}

            {/* Cobrar parcela vencida via WhatsApp */}
            {paymentStatus?.isOverdue && participant.customer_phone && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={onChargeOverdue}
              >
                <Clock className="h-4 w-4" />
                Cobrar
              </Button>
            )}

            {/* Encerrar cota */}
            {participant.status === "active" && !participant.is_drawn && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground hover:text-destructive"
                onClick={onWithdraw}
              >
                <UserX className="h-4 w-4" />
              </Button>
            )}

            {/* Remover (só se não foi sorteado e está ativo) */}
            {!participant.is_drawn && participant.status === "active" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
