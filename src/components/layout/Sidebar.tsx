import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, TrendingUp, Settings, Warehouse, Clock, Users, ShieldCheck, Store, UserCheck, Gift, Truck, ShoppingBag, Package, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import logoVendaProfit from "@/assets/logo-venda-profit.png";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  onNavigate?: () => void;
}

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  disabled?: boolean;
  comingSoon?: boolean;
}

const navItems: NavItem[] = [{
  icon: LayoutDashboard,
  label: "Painel",
  path: "/"
}, {
  icon: Warehouse,
  label: "Estoque",
  path: "/stock"
}, {
  icon: Truck,
  label: "Fornecedores",
  path: "/suppliers"
}, {
  icon: ShoppingCart,
  label: "Vendas",
  path: "/sales"
}, {
  icon: UserCheck,
  label: "Clientes",
  path: "/customers"
}, {
  icon: Gift,
  label: "Consórcios",
  path: "/consortiums",
  disabled: true,
  comingSoon: true
}, {
  icon: ShoppingBag,
  label: "Bazar",
  path: "/bazar",
  disabled: true,
  comingSoon: true
}, {
  icon: Package,
  label: "Dropshipping",
  path: "/dropshipping",
  disabled: true,
  comingSoon: true
}, {
  icon: Clock,
  label: "Solicitações",
  path: "/stock-requests"
}, {
  icon: Users,
  label: "Parcerias",
  path: "/partnerships"
}, {
  icon: TrendingUp,
  label: "Relatórios",
  path: "/reports"
}, {
  icon: TrendingUp,
  label: "Rel. Parcerias",
  path: "/partner-reports"
}, {
  icon: Store,
  label: "Minha Loja",
  path: "/my-store"
}, {
  icon: Settings,
  label: "Configurações",
  path: "/settings"
}];

export function Sidebar({
  onNavigate
}: SidebarProps) {
  const location = useLocation();
  const {
    user
  } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    async function check() {
      if (!user) return;
      const {
        data
      } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin"
      });
      setIsAdmin(!!data);
    }
    check();
  }, [user]);
  
  const handleNavClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };
  
  return (
    <aside className="h-full w-64 bg-sidebar border-r border-sidebar-border md:fixed md:left-0 md:top-0 md:z-40 md:h-screen">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <img src={logoVendaProfit} alt="Venda PROFIT" className="h-10 w-10 rounded-xl shadow-glow" />
          <div>
            <h1 className="text-lg font-bold text-white">Venda PROFIT</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão Inteligente de Vendas</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          <TooltipProvider delayDuration={300}>
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              
              if (item.disabled) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                          "text-sidebar-foreground/40 cursor-not-allowed opacity-60"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="flex-1">{item.label}</span>
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover text-popover-foreground">
                      <p className="text-xs">Em breve</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </TooltipProvider>

          {/* Admin-only link */}
          {isAdmin && (
            <Link
              to="/admin/users"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                location.pathname === "/admin/users"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <ShieldCheck className="h-5 w-5" />
              Admin Usuários
            </Link>
          )}
        </nav>
      </div>
    </aside>
  );
}