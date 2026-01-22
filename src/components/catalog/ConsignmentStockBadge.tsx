import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Clock } from "lucide-react";
import { WaitlistDialog } from "./WaitlistDialog";

interface ConsignmentStockBadgeProps {
  productId: string;
  productName: string;
  physicalStock: number;
  primaryColor?: string;
}

export function ConsignmentStockBadge({ 
  productId, 
  productName,
  physicalStock,
  primaryColor = "#000000"
}: ConsignmentStockBadgeProps) {
  const [hasConsignedItems, setHasConsignedItems] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkConsignedItems();
  }, [productId]);

  const checkConsignedItems = async () => {
    try {
      // Check if product has items in active/awaiting_approval consignments
      const { count, error } = await supabase
        .from("consignment_items")
        .select("id, consignments!inner(status)", { count: "exact", head: true })
        .eq("product_id", productId)
        .in("consignments.status", ["active", "awaiting_approval"])
        .in("status", ["pending", "active"]);

      if (error) throw error;
      setHasConsignedItems((count || 0) > 0);
    } catch (error) {
      console.error("Error checking consigned items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show if physical stock is 0 but there are consigned items
  if (isLoading || physicalStock > 0 || !hasConsignedItems) {
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
