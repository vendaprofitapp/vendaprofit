import { Bell, Search, User, LogOut, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { totalCount, sections, isLoading } = useNotifications();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar produtos, vendas..."
          className="pl-10 bg-secondary/50 border-transparent focus:border-primary/50"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Bell — Notification Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {!isLoading && totalCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                  {totalCount > 99 ? "99+" : totalCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Notificações</span>
              </div>
              {totalCount > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {totalCount} nova{totalCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : sections.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Tudo em dia ✓</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma notificação pendente</p>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="divide-y divide-border">
                  {sections.map((section) => (
                    <div key={section.key} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-base leading-none mt-0.5 shrink-0">{section.icon}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground leading-tight">{section.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{section.description}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs shrink-0"
                          style={{ color: section.color }}
                          onClick={() => navigate(section.route)}
                        >
                          Ver →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm text-muted-foreground truncate">
              {user?.email}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
