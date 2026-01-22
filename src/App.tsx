import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";

import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import PartnerReports from "./pages/PartnerReports";
import Financial from "./pages/Financial";
import Partnerships from "./pages/Partnerships";
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
import PublicBag from "./pages/PublicBag";
import LandingPage from "./pages/LandingPage";
import Suppliers from "./pages/Suppliers";
import Categories from "./pages/Categories";
import Orders from "./pages/Orders";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/landing" element={<LandingPage />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/stock" element={<ProtectedRoute><StockControl /></ProtectedRoute>} />
    
    <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
    <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
    <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
    <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
    <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
    <Route path="/consignments" element={<ProtectedRoute><Consignments /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/partner-reports" element={<ProtectedRoute><PartnerReports /></ProtectedRoute>} />
    <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
    <Route path="/partnerships" element={<ProtectedRoute><Partnerships /></ProtectedRoute>} />
    <Route path="/stock-requests" element={<ProtectedRoute><StockRequests /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
    <Route path="/my-store" element={<ProtectedRoute><StoreSettingsPage /></ProtectedRoute>} />
    <Route path="/bag/:token" element={<PublicBag />} />
    <Route path="/:slug" element={<StoreCatalog />} />
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
