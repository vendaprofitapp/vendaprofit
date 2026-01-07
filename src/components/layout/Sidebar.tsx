import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, Settings, Warehouse, Clock, Users, ShieldCheck, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
interface SidebarProps {
  onNavigate?: () => void;
}
const navItems = [{
  icon: LayoutDashboard,
  label: "Painel",
  path: "/"
}, {
  icon: Warehouse,
  label: "Estoque",
  path: "/stock"
}, {
  icon: Package,
  label: "Produtos",
  path: "/products"
}, {
  icon: ShoppingCart,
  label: "Vendas",
  path: "/sales"
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
  return <aside className="h-full w-64 bg-sidebar border-r border-sidebar-border md:fixed md:left-0 md:top-0 md:z-40 md:h-screen">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow text-white bg-[#c41c68]">
            <DollarSign className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Vendas L.E.V.E.</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão de Estoque</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return <Link key={item.path} to={item.path} onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200", isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>;
        })}

          {/* Admin-only link */}
          {isAdmin && <Link to="/admin/users" onClick={handleNavClick} className={cn("flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200", location.pathname === "/admin/users" ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
              <ShieldCheck className="h-5 w-5" />
              Admin Usuários
            </Link>}
        </nav>
      </div>
    </aside>;
}