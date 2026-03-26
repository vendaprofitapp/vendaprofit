import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface LoadMoreButtonProps {
  hasMore: boolean;
  loadMore: () => void;
  visibleCount: number;
  totalCount: number;
  label?: string;
}

export function LoadMoreButton({
  hasMore,
  loadMore,
  visibleCount,
  totalCount,
  label = "Carregar mais",
}: LoadMoreButtonProps) {
  if (!hasMore) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <p className="text-xs text-muted-foreground">
        Mostrando {visibleCount} de {totalCount}
      </p>
      <Button variant="outline" size="sm" onClick={loadMore} className="gap-2">
        {label}
      </Button>
    </div>
  );
}
