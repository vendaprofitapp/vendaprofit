import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface MainLayoutProps {
  children: ReactNode;
}

const pageTitles: Record<string, string> = {
  "/": "Painel",
  "/stock": "Estoque",
  "/products": "Produtos",
  "/sales": "Vendas",
  "/stock-requests": "Solicitações",
  "/partnerships": "Parcerias",
  "/reports": "Relatórios",
  "/partner-reports": "Rel. Parcerias",
  "/settings": "Configurações",
  "/admin/users": "Admin Usuários",
};

export function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageTitle = pageTitles[location.pathname] || "Vendas L.E.V.E.";

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="font-bold text-lg">{pageTitle}</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </header>
        <main className="p-4 pb-20">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
