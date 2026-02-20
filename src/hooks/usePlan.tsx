import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanType = "trial" | "basic_monthly" | "basic_annual" | "premium_monthly" | "premium_annual";
export type PlanTier = "trial" | "basic" | "premium";
export type PlanStatus = "active" | "expired" | "cancelled";

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  status: PlanStatus;
  started_at: string;
  expires_at: string;
  product_count_limit: number | null;
  onboarding_completed: boolean;
  notes: string | null;
}

export interface UsePlanResult {
  plan: UserSubscription | null;
  planType: PlanType | null;
  tier: PlanTier;
  isExpired: boolean;
  isPremium: boolean;
  isBasic: boolean;
  isTrial: boolean;
  daysLeft: number;
  productLimit: number | null;
  onboardingCompleted: boolean;
  loading: boolean;
  refetch: () => void;
}

function deriveTier(planType: PlanType | null): PlanTier {
  if (!planType) return "trial";
  if (planType === "trial") return "trial";
  if (planType === "basic_monthly" || planType === "basic_annual") return "basic";
  return "premium";
}

export function usePlan(): UsePlanResult {
  const { user } = useAuth();
  const [plan, setPlan] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPlan(data as UserSubscription | null);
        setLoading(false);
      });
  }, [user, fetchKey]);

  const refetch = () => setFetchKey((k) => k + 1);

  const planType = plan?.plan_type ?? null;
  const tier = deriveTier(planType);

  const now = new Date();
  const expiresAt = plan?.expires_at ? new Date(plan.expires_at) : null;
  const isExpired = expiresAt ? expiresAt < now : false;
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    plan,
    planType,
    tier,
    isExpired,
    isPremium: tier === "premium",
    isBasic: tier === "basic",
    isTrial: tier === "trial",
    daysLeft,
    productLimit: plan?.product_count_limit ?? null,
    onboardingCompleted: plan?.onboarding_completed ?? false,
    loading,
    refetch,
  };
}
