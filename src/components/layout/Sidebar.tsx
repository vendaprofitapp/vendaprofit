import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, TrendingUp, Settings, Warehouse, Clock,
  Users, ShieldCheck, Store, UserCheck, Gift, Truck, ShoppingBag, Package,
  Lock, Tag, Briefcase, ClipboardList, PanelLeft, BookOpen, Wallet,
  Megaphone, Award, DollarSign, CreditCard, Video, MessageCircle, Zap,
  ExternalLink, BarChart3, MapPin, Layers, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { PlanGate } from "@/components/PlanGate";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import logoVendaProfit from "@/assets/logo-venda-profit.png";

const isStandaloneMode = () =>
  (window.navigator as any).standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;

interface SidebarProps {
  onNavigate?: () => void;
}

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Estratégias",
    items: [
      { icon: Store, label: "Minha Loja", path: "/my-store" },
      { icon: Zap, label: "Modo Evento", path: "/evento" },
      { icon: Briefcase, label: "Bolsa Consignada", path: "/consignments" },
      { icon: Gift, label: "Consórcios", path: "/consortiums" },
      { icon: ShoppingBag, label: "Bazar VIP", path: "/admin/bazar" },
      { icon: MapPin, label: "Pontos Parceiros", path: "/partner-points" },
      { icon: Users, label: "Sociedade", path: "/partnerships/sociedade" },
      { icon: Briefcase, label: "Parceria", path: "/partnerships/parceria" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { icon: UserCheck, label: "Clientes", path: "/customers" },
      { icon: BarChart3, label: "Analytics", path: "/analytics" },
      { icon: Megaphone, label: "Redes Sociais / Google", path: "/marketing" },
      { icon: MessageCircle, label: "WhatsApp", path: "/marketing/whatsapp" },
      { icon: Star, label: "Produtos em Destaque", path: "/marketing/destaques" },
      { icon: Award, label: "Fidelidade", path: "/admin/fidelidade" },
      { icon: CreditCard, label: "Incentivos", path: "/marketing/incentivos" },
      { icon: Lock, label: "Área Secreta", path: "/marketing/area-secreta" },
      { icon: Video, label: "Vídeo Vendedor", path: "/marketing/video-vendedor" },
    ],
  },
  {
    label: "Estoque",
    items: [
      { icon: Warehouse, label: "Controle", path: "/stock" },
      { icon: Tag, label: "Categorias", path: "/categories" },
      { icon: Truck, label: "Fornecedores", path: "/suppliers" },
      { icon: Clock, label: "Solicitações", path: "/stock-requests" },
      { icon: Package, label: "Pedidos B2B", path: "/b2b-orders" },
      { icon: ClipboardList, label: "Encomendas", path: "/orders" },
      { icon: Layers, label: "Detector de Conjuntos", path: "/stock/conjuntos" },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { icon: TrendingUp, label: "Geral", path: "/reports" },
      { icon: Store, label: "Minha Loja", path: "/reports/catalog" },
      { icon: Zap, label: "Eventos", path: "/reports/events" },
      { icon: Briefcase, label: "Bolsa Consignada", path: "/reports/consignment" },
      { icon: Gift, label: "Consórcios", path: "/reports/consortium" },
      { icon: ShoppingBag, label: "Bazar VIP", path: "/reports/bazar" },
      { icon: MapPin, label: "Pontos Parceiros", path: "/reports/partner-points" },
      { icon: Users, label: "Sociedade", path: "/reports/sociedade" },
      { icon: Users, label: "Parcerias", path: "/reports/parcerias" },
      { icon: Package, label: "B2B", path: "/reports/b2b" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { icon: Wallet, label: "Financeiro", path: "/financial" },
      { icon: Settings, label: "Configurações", path: "/settings" },
      { icon: BookOpen, label: "Tutorial", path: "/tutorial" },
    ],
  },
];

const linkClasses = (isActive: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
    isActive
      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
  );

// Paths that require Premium plan
const PREMIUM_PATHS = new Set([
  "/consortiums",
  "/admin/bazar",
  "/partner-points",
  "/marketing",
  "/admin/fidelidade",
  "/marketing/incentivos",
  "/marketing/area-secreta",
  "/b2b-orders",
]);

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = usePlan();
  const [isAdmin, setIsAdmin] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

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

  useEffect(() => {
    async function fetchSlug() {
      if (!user) return;
      const { data } = await supabase
        .from("store_settings")
        .select("store_slug")
        .eq("owner_id", user.id)
        .maybeSingle();
      setStoreSlug(data?.store_slug ?? null);
    }
    fetchSlug();
  }, [user]);

  const handleNavClick = () => onNavigate?.();
  const isSalesActive = location.pathname === "/sales";

  const goldClasses = cn(
    "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 mb-1 w-full",
    "bg-yellow-500/90 text-gray-900 hover:bg-yellow-500 hover:shadow-md"
  );


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
          {/* CTA Vendas */}
          <Link
            to="/sales"
            onClick={handleNavClick}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-bold transition-all duration-200 mb-3",
              isSalesActive
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-primary text-primary-foreground shadow-glow hover:brightness-110"
            )}
          >
            <DollarSign className={cn("h-5 w-5", !isSalesActive && "animate-pulse")} />
            Registrar Venda
          </Link>

          {/* Dashboard */}
          <Link
            to="/"
            onClick={handleNavClick}
            className={linkClasses(location.pathname === "/")}
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Link>

          {/* Minha Loja - Gold CTA */}
          {storeSlug ? (
            <a
              href={`/${storeSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (isStandaloneMode()) {
                  e.preventDefault();
                  const url = `${window.location.origin}/${storeSlug}`;
                  if (navigator.share) {
                    navigator.share({ title: "Minha Loja", url });
                  } else {
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado! Cole no navegador para abrir.");
                  }
                }
                onNavigate?.();
              }}
              className={goldClasses}
            >
              <Store className="h-5 w-5" />
              Ver Minha Loja
              <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-60" />
            </a>
          ) : (
            <button
              onClick={() => { onNavigate?.(); navigate("/my-store"); }}
              className={goldClasses}
            >
              <Store className="h-5 w-5" />
              Ver Minha Loja
            </button>
          )}

          {/* Pedidos da Loja */}
          <Link
            to="/catalog-orders"
            onClick={handleNavClick}
            className={linkClasses(location.pathname === "/catalog-orders")}
          >
            <ShoppingCart className="h-5 w-5" />
            Pedidos da Loja
          </Link>

          {/* Grouped navigation */}
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-4 pt-4 pb-1">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isPremiumItem = PREMIUM_PATHS.has(item.path);
                const linkEl = (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleNavClick}
                    className={linkClasses(location.pathname === item.path)}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
                if (isPremiumItem && !isPremium && !isAdmin) {
                  return (
                    <PlanGate key={item.path}>
                      {linkEl}
                    </PlanGate>
                  );
                }
                return linkEl;
              })}
            </div>
          ))}

          {/* Admin */}
          {isAdmin && (
            <div>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-4 pt-4 pb-1">
                Admin
              </p>
              <Link
                to="/admin/users"
                onClick={handleNavClick}
                className={linkClasses(location.pathname === "/admin/users")}
              >
                <ShieldCheck className="h-5 w-5" />
                Admin Usuários
              </Link>
              <Link
                to="/admin/landing-page"
                onClick={handleNavClick}
                className={linkClasses(location.pathname === "/admin/landing-page")}
              >
                <PanelLeft className="h-5 w-5" />
                Editor Landing Page
              </Link>
              <Link
                to="/admin/catalog"
                onClick={handleNavClick}
                className={linkClasses(location.pathname === "/admin/catalog")}
              >
                <Package className="h-5 w-5" />
                Central de Peças
              </Link>
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}
