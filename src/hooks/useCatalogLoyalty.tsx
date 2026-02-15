import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LoyaltyLevel {
  name: string;
  color: string;
  min_spent: number;
  features: string[];
}

interface CatalogLoyaltyData {
  total_spent: number;
  current_level: LoyaltyLevel | null;
  next_level: { name: string; color: string; min_spent: number } | null;
  progress_percent: number;
  levels: LoyaltyLevel[];
}

interface UseCatalogLoyaltyResult {
  data: CatalogLoyaltyData | null;
  isLoading: boolean;
  currentLevel: LoyaltyLevel | null;
  nextLevel: { name: string; color: string; min_spent: number } | null;
  totalSpent: number;
  progress: number;
  unlockedFeatures: string[];
  amountToNext: number | null;
}

export function useCatalogLoyalty(ownerId: string | undefined, phone: string | undefined): UseCatalogLoyaltyResult {
  const { data, isLoading } = useQuery({
    queryKey: ["catalog-loyalty", ownerId, phone],
    queryFn: async () => {
      if (!ownerId || !phone) return null;
      
      const { data, error } = await supabase.rpc("get_catalog_customer_loyalty", {
        _owner_id: ownerId,
        _phone: phone,
      });

      if (error) {
        console.error("Error fetching loyalty data:", error);
        return null;
      }

      return data as unknown as CatalogLoyaltyData;
    },
    enabled: !!ownerId && !!phone,
    staleTime: 60_000,
  });

  const currentLevel = data?.current_level ?? null;
  const nextLevel = data?.next_level ?? null;
  const totalSpent = data?.total_spent ?? 0;
  const progress = data?.progress_percent ?? 0;
  const unlockedFeatures = (currentLevel?.features as string[]) ?? [];
  const amountToNext = nextLevel ? nextLevel.min_spent - totalSpent : null;

  return {
    data,
    isLoading,
    currentLevel,
    nextLevel,
    totalSpent,
    progress,
    unlockedFeatures,
    amountToNext,
  };
}
