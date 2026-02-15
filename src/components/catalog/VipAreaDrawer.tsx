import { Crown, ShoppingBag, MessageCircle, Shirt, Lock, Award, Store } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { BazarSubmissionDialog } from "./BazarSubmissionDialog";
import { BazarShowcaseDialog } from "./BazarShowcaseDialog";

const FEATURE_MAP: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  bazar_vip: { label: "Bazar VIP", icon: ShoppingBag, description: "Acesso a ofertas exclusivas" },
  chat: { label: "Chat Direto", icon: MessageCircle, description: "Fale diretamente com a loja" },
  provador_ia: { label: "Provador IA", icon: Shirt, description: "Experimente virtualmente" },
};

interface VipAreaDrawerProps {
  unlockedFeatures: string[];
  currentLevel: { name: string; color: string } | null;
  nextLevel: { name: string; color: string; min_spent: number } | null;
  progress: number;
  amountToNext: number | null;
  primaryColor: string;
  isIdentified: boolean;
  onIdentify: () => void;
  ownerId?: string;
  sellerPhone?: string;
  sellerName?: string;
  storeSlug?: string;
}

export function VipAreaDrawer({
  unlockedFeatures,
  currentLevel,
  nextLevel,
  progress,
  amountToNext,
  primaryColor,
  isIdentified,
  onIdentify,
  ownerId,
  sellerPhone,
  sellerName,
  storeSlug,
}: VipAreaDrawerProps) {
  const [open, setOpen] = useState(false);
  const [bazarOpen, setBazarOpen] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);

  const hasFeatures = unlockedFeatures.length > 0;

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-40 h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        style={{ backgroundColor: currentLevel?.color || primaryColor }}
        aria-label="Área VIP"
      >
        <Crown className="h-5 w-5 text-white" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Crown className="h-5 w-5" style={{ color: currentLevel?.color || primaryColor }} />
              <DrawerTitle>Área VIP</DrawerTitle>
            </div>
            <DrawerDescription>
              {isIdentified && currentLevel
                ? `Seu nível: ${currentLevel.name}`
                : "Identifique-se para ver seus benefícios"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-6 pb-6 space-y-4">
            {!isIdentified ? (
              <div className="text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Lock className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Informe seu WhatsApp para descobrir seu nível e benefícios exclusivos!
                </p>
                <Button onClick={() => { setOpen(false); onIdentify(); }} style={{ backgroundColor: primaryColor }}>
                  Ver meu Nível
                </Button>
              </div>
            ) : hasFeatures ? (
              <div className="grid gap-3">
                {/* Buy from Bazar button */}
                {unlockedFeatures.includes("bazar_vip") && ownerId && (
                  <button
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left w-full"
                    onClick={() => { setOpen(false); setShowcaseOpen(true); }}
                  >
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${currentLevel?.color || primaryColor}15` }}
                    >
                      <Store className="h-5 w-5" style={{ color: currentLevel?.color || primaryColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Comprar no Bazar</p>
                      <p className="text-xs text-muted-foreground">Peças exclusivas com preços incríveis</p>
                    </div>
                  </button>
                )}

                {unlockedFeatures.map((featureKey) => {
                  const feature = FEATURE_MAP[featureKey];
                  if (!feature) return null;
                  const Icon = feature.icon;
                  return (
                    <button
                      key={featureKey}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left w-full"
                      onClick={() => {
                        if (featureKey === "bazar_vip" && isIdentified && ownerId && sellerPhone && storeSlug) {
                          setOpen(false);
                          setBazarOpen(true);
                        }
                      }}
                    >
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${currentLevel?.color || primaryColor}15` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: currentLevel?.color || primaryColor }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {featureKey === "bazar_vip" ? "Vender Minha Peça" : feature.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Award className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Você ainda não tem benefícios desbloqueados.
                </p>
                {nextLevel && amountToNext != null && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Compre mais{" "}
                      <span className="font-semibold" style={{ color: nextLevel.color }}>
                        R$ {amountToNext.toFixed(2).replace(".", ",")}
                      </span>{" "}
                      para alcançar{" "}
                      <span className="font-semibold" style={{ color: nextLevel.color }}>
                        {nextLevel.name}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {ownerId && sellerPhone && storeSlug && (
        <BazarSubmissionDialog
          open={bazarOpen}
          onOpenChange={setBazarOpen}
          ownerId={ownerId}
          sellerPhone={sellerPhone}
          sellerName={sellerName}
          storeSlug={storeSlug}
        />
      )}

      {ownerId && (
        <BazarShowcaseDialog
          open={showcaseOpen}
          onOpenChange={setShowcaseOpen}
          ownerId={ownerId}
          primaryColor={primaryColor}
        />
      )}
    </>
  );
}
