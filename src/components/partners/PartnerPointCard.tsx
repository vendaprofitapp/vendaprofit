import { MapPin, Package, Phone, ChevronRight, Copy, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface PartnerPoint {
  id: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  rack_commission_pct: number;
  is_active: boolean;
  access_token: string;
  allocated_count?: number;
}

interface PartnerPointCardProps {
  partner: PartnerPoint;
}

export function PartnerPointCard({ partner }: PartnerPointCardProps) {
  const [copied, setCopied] = useState(false);

  const catalogUrl = `${window.location.origin}/p/${partner.access_token}`;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(catalogUrl);
    setCopied(true);
    toast.success("Link do catálogo copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5 p-2 rounded-lg bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">{partner.name}</h3>
                <Badge variant={partner.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                  {partner.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              {partner.contact_name && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{partner.contact_name}</p>
              )}

              {partner.contact_phone && (
                <div className="flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{partner.contact_phone}</span>
                </div>
              )}

              {partner.address && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{partner.address}</p>
              )}

              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    {partner.allocated_count ?? 0} peças alocadas
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  Comissão: {partner.rack_commission_pct}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleCopyLink}
              title="Copiar link do catálogo QR"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Link to={`/partner-points/${partner.id}`}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
