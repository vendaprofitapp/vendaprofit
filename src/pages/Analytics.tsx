import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AnalyticsDashboard } from "@/components/marketing/AnalyticsDashboard";
import { LeadsCRM } from "@/components/marketing/LeadsCRM";
import { subDays, startOfDay } from "date-fns";

export default function Analytics() {
  const { user } = useAuth();
  const [analyticsDateRange, setAnalyticsDateRange] = useState({
    start: startOfDay(subDays(new Date(), 6)),
    end: new Date(),
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-sm text-muted-foreground">Métricas da sua loja e leads capturados</p>
          </div>
        </div>

        {user?.id && (
          <div className="space-y-8">
            <AnalyticsDashboard
              ownerId={user.id}
              dateRange={analyticsDateRange}
              onDateRangeChange={setAnalyticsDateRange}
            />
            <LeadsCRM ownerId={user.id} dateRange={analyticsDateRange} />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
