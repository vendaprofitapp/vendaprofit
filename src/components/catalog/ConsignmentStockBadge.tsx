import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Clock } from "lucide-react";
import { WaitlistDialog } from "./WaitlistDialog";

interface ConsignmentStockBadgeProps {
  productId: string;
  productName: string;
  isConsigned: boolean; // Pre-calculated: true if all sizes are consigned
  primaryColor?: string;
}

export function ConsignmentStockBadge({ 
  productId, 
  productName,
  isConsigned,
  primaryColor = "#000000"
}: ConsignmentStockBadgeProps) {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  if (!isConsigned) {
    return null;
  }

  return (
    <>
      <div className="absolute top-2 left-2 z-10">
        <Badge 
          className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1 shadow-md"
        >
          <Clock className="h-3 w-3" />
          Em Provação
        </Badge>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
        <Button
          size="sm"
          variant="secondary"
          className="w-full gap-1 text-xs h-7"
          onClick={(e) => {
            e.stopPropagation();
            setWaitlistOpen(true);
          }}
        >
          <Bell className="h-3 w-3" />
          Entrar na Fila
        </Button>
      </div>

      <WaitlistDialog
        productId={productId}
        productName={productName}
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        primaryColor={primaryColor}
      />
    </>
  );
}
