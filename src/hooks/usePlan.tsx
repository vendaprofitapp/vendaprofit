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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]).then(([{ data: planData }, { data: adminData }]) => {
      setPlan(planData as UserSubscription | null);
      setIsAdmin(!!adminData);
      setLoading(false);
    });
  }, [user, fetchKey]);

  const refetch = () => setFetchKey((k) => k + 1);

  const planType = plan?.plan_type ?? null;
  const tier = deriveTier(planType);

  const now = new Date();
  const expiresAt = plan?.expires_at ? new Date(plan.expires_at) : null;
  const isExpiredValue = expiresAt ? expiresAt < now : false;
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    plan,
    planType,
    tier: isAdmin ? "premium" : tier,
    isExpired: isAdmin ? false : isExpiredValue,
    isPremium: isAdmin || tier === "premium",
    isBasic: !isAdmin && tier === "basic",
    isTrial: !isAdmin && tier === "trial",
    daysLeft,
    productLimit: isAdmin ? null : plan?.product_count_limit ?? null,
    onboardingCompleted: plan?.onboarding_completed ?? false,
    loading,
    refetch,
  };
}
