import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import PlanExpired from "./pages/PlanExpired";

import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import PartnerReports from "./pages/PartnerReports";
import PartnerPointReports from "./pages/PartnerPointReports";
import Financial from "./pages/Financial";
import Settings from "./pages/Settings";
import StockControl from "./pages/StockControl";
import StockRequests from "./pages/StockRequests";
import Auth from "./pages/Auth";
import AdminUsers from "./pages/AdminUsers";
import NotFound from "./pages/NotFound";
import StoreSettingsPage from "./pages/StoreSettings";
import StoreCatalog from "./pages/StoreCatalog";
import Customers from "./pages/Customers";
import Consignments from "./pages/Consignments";
import Consortiums from "./pages/Consortiums";
import PublicBag from "./pages/PublicBag";
import LandingPage from "./pages/LandingPage";
import LandingPageAdmin from "./pages/LandingPageAdmin";
import Suppliers from "./pages/Suppliers";
import Categories from "./pages/Categories";
import Orders from "./pages/Orders";
import Tutorial from "./pages/Tutorial";
import Marketing from "./pages/Marketing";
import WhatsAppCRM from "./pages/WhatsAppCRM";
import LoyaltyAdmin from "./pages/LoyaltyAdmin";
import BazarAdmin from "./pages/BazarAdmin";
import B2BOrders from "./pages/B2BOrders";
import PurchaseIncentivesSettings from "./pages/PurchaseIncentivesSettings";
import SecretAreaSettings from "./pages/SecretAreaSettings";
import SalesVideoSettings from "./pages/SalesVideoSettings";
import EventMode from "./pages/EventMode";
import EventReconciliation from "./pages/EventReconciliation";
import AdminCatalog from "./pages/AdminCatalog";
import Analytics from "./pages/Analytics";
import PartnerPoints from "./pages/PartnerPoints";
import PartnerPointDetail from "./pages/PartnerPointDetail";
import PartnerCatalog from "./pages/PartnerCatalog";
import PartnerContract from "./pages/PartnerContract";
import StockSetDetector from "./pages/StockSetDetector";
import FeaturedProducts from "./pages/FeaturedProducts";
import BazarSeller from "./pages/BazarSeller";
import ReportManual from "./pages/ReportManual";
import ReportCatalog from "./pages/ReportCatalog";
import ReportB2B from "./pages/ReportB2B";
import ReportVoice from "./pages/ReportVoice";
import ReportBazar from "./pages/ReportBazar";
import ReportConsignment from "./pages/ReportConsignment";
import ReportEvent from "./pages/ReportEvent";
import ReportConsortium from "./pages/ReportConsortium";
import ReportInstagram from "./pages/ReportInstagram";
import ReportDeferredSales from "./pages/ReportDeferredSales";
import ReportMyPerformance from "./pages/ReportMyPerformance";
import ReportHubAcertos from "./pages/ReportHubAcertos";
import ReportHubFornecedor from "./pages/ReportHubFornecedor";
import ReportHubVendedor from "./pages/ReportHubVendedor";
import HubFornecedor from "./pages/HubFornecedor";
import HubVendedor from "./pages/HubVendedor";

import CatalogOrders from "./pages/CatalogOrders";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos de cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, offline } = useAuth();
  const { isExpired, loading: planLoading } = usePlan();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    if (!user) { setAdminChecked(true); return; }
    const timeout = setTimeout(() => setAdminChecked(true), 8000);
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      clearTimeout(timeout);
      setIsAdmin(!!data);
      setAdminChecked(true);
    });
    return () => clearTimeout(timeout);
  }, [user]);

  if (offline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground">Serviço temporariamente indisponível</h2>
          <p className="text-muted-foreground">Não foi possível conectar ao servidor. Verifique sua internet e tente novamente em alguns instantes.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (loading || planLoading || !adminChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isExpired && !isAdmin) {
    return <Navigate to="/plano-expirado" replace />;
  }

  return <>{children}</>;
}


// Componente para rota raiz - mostra landing page se não autenticado
function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não está logado, mostra a landing page
  if (!user) {
    return <LandingPage />;
  }

  // Se está logado, mostra o dashboard
  return <Index />;
}

// Componente para rota de slug - sempre mostra o catálogo da loja
// O StoreCatalog irá buscar a loja pelo slug e mostrar 404 se não existir
function SlugRoute() {
  return <StoreCatalog />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RootRoute />} />
    <Route path="/landing" element={<LandingPage />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/stock" element={<ProtectedRoute><StockControl /></ProtectedRoute>} />
    
    <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
    <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
    <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
    <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
    <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
    <Route path="/consignments" element={<ProtectedRoute><Consignments /></ProtectedRoute>} />
    <Route path="/consortiums" element={<ProtectedRoute><Consortiums /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/partner-reports" element={<ProtectedRoute><PartnerReports /></ProtectedRoute>} />
    <Route path="/reports/partner-points" element={<ProtectedRoute><PartnerPointReports /></ProtectedRoute>} />
    <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
    <Route path="/stock-requests" element={<ProtectedRoute><StockRequests /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
    <Route path="/admin/landing-page" element={<ProtectedRoute><LandingPageAdmin /></ProtectedRoute>} />
    <Route path="/my-store" element={<ProtectedRoute><StoreSettingsPage /></ProtectedRoute>} />
    <Route path="/catalog-orders" element={<ProtectedRoute><CatalogOrders /></ProtectedRoute>} />
    <Route path="/tutorial" element={<ProtectedRoute><Tutorial /></ProtectedRoute>} />
    <Route path="/marketing" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
    <Route path="/marketing/whatsapp" element={<ProtectedRoute><WhatsAppCRM /></ProtectedRoute>} />
    <Route path="/marketing/destaques" element={<ProtectedRoute><FeaturedProducts /></ProtectedRoute>} />
    <Route path="/admin/fidelidade" element={<ProtectedRoute><LoyaltyAdmin /></ProtectedRoute>} />
    <Route path="/admin/bazar" element={<ProtectedRoute><BazarAdmin /></ProtectedRoute>} />
    <Route path="/b2b-orders" element={<ProtectedRoute><B2BOrders /></ProtectedRoute>} />
    <Route path="/marketing/incentivos" element={<ProtectedRoute><PurchaseIncentivesSettings /></ProtectedRoute>} />
    <Route path="/marketing/area-secreta" element={<ProtectedRoute><SecretAreaSettings /></ProtectedRoute>} />
    <Route path="/marketing/video-vendedor" element={<ProtectedRoute><SalesVideoSettings /></ProtectedRoute>} />
    <Route path="/evento" element={<ProtectedRoute><EventMode /></ProtectedRoute>} />
    <Route path="/evento/conciliacao" element={<ProtectedRoute><EventReconciliation /></ProtectedRoute>} />
    <Route path="/admin/catalog" element={<ProtectedRoute><AdminCatalog /></ProtectedRoute>} />
    <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
    <Route path="/partner-points" element={<ProtectedRoute><PartnerPoints /></ProtectedRoute>} />
    <Route path="/partner-points/:id" element={<ProtectedRoute><PartnerPointDetail /></ProtectedRoute>} />
    <Route path="/stock/conjuntos" element={<ProtectedRoute><StockSetDetector /></ProtectedRoute>} />
    <Route path="/reports/manual" element={<ProtectedRoute><ReportManual /></ProtectedRoute>} />
    <Route path="/reports/catalog" element={<ProtectedRoute><ReportCatalog /></ProtectedRoute>} />
    <Route path="/reports/b2b" element={<ProtectedRoute><ReportB2B /></ProtectedRoute>} />
    <Route path="/reports/voice" element={<ProtectedRoute><ReportVoice /></ProtectedRoute>} />
    <Route path="/reports/bazar" element={<ProtectedRoute><ReportBazar /></ProtectedRoute>} />
    <Route path="/reports/consignment" element={<ProtectedRoute><ReportConsignment /></ProtectedRoute>} />
    <Route path="/reports/events" element={<ProtectedRoute><ReportEvent /></ProtectedRoute>} />
    <Route path="/reports/consortium" element={<ProtectedRoute><ReportConsortium /></ProtectedRoute>} />
    <Route path="/reports/instagram" element={<ProtectedRoute><ReportInstagram /></ProtectedRoute>} />
    <Route path="/reports/deferred" element={<ProtectedRoute><ReportDeferredSales /></ProtectedRoute>} />
     <Route path="/reports/performance" element={<ProtectedRoute><ReportMyPerformance /></ProtectedRoute>} />
     <Route path="/reports/hub-acertos" element={<ProtectedRoute><ReportHubAcertos /></ProtectedRoute>} />
     <Route path="/reports/hub-fornecedor" element={<ProtectedRoute><ReportHubFornecedor /></ProtectedRoute>} />
     <Route path="/reports/hub-vendedor" element={<ProtectedRoute><ReportHubVendedor /></ProtectedRoute>} />
    <Route path="/hub-fornecedor" element={<ProtectedRoute><HubFornecedor /></ProtectedRoute>} />
    <Route path="/hub-vendedor" element={<ProtectedRoute><HubVendedor /></ProtectedRoute>} />
    <Route path="/plano-expirado" element={<PlanExpired />} />
    <Route path="/p/:token" element={<PartnerCatalog />} />
    <Route path="/contrato/:token" element={<PartnerContract />} />
    <Route path="/bag/:token" element={<PublicBag />} />
    <Route path="/bazar/vender" element={<BazarSeller />} />
    
    <Route path="/:slug" element={<SlugRoute />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
