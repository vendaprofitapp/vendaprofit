import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  TrendingUp,
  Settings,
  Dumbbell,
  Warehouse,
  Clock,
  Users,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Warehouse, label: "Controle de Estoque", path: "/stock" },
  { icon: Package, label: "Produtos", path: "/products" },
  { icon: ShoppingCart, label: "Vendas", path: "/sales" },
  { icon: Clock, label: "Solicitações", path: "/stock-requests" },
  { icon: Users, label: "Parcerias", path: "/partnerships" },
  { icon: TrendingUp, label: "Relatórios", path: "/reports" },
  { icon: TrendingUp, label: "Rel. Parcerias", path: "/partner-reports" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function check() {
      if (!user) return;
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      setIsAdmin(!!data);
    }
    check();
  }, [user]);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">FitStock</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão de Estoque</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
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

          {/* Admin-only link */}
          {isAdmin && (
            <Link
              to="/admin/users"
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

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent p-4">
            <p className="text-xs font-medium text-sidebar-foreground/80">
              Estoque Total
            </p>
            <p className="text-2xl font-bold text-sidebar-foreground">
              1,248
            </p>
            <p className="text-xs text-sidebar-foreground/60">
              peças disponíveis
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
