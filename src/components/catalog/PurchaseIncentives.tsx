import { Check, Lock, Truck, Gift, Star, Crown } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// Types
export interface IncentiveTier {
  min_value: number;
  benefit: string;
  emoji: string;
}

export interface PurchaseIncentivesConfig {
  enabled: boolean;
  installments: {
    enabled: boolean;
    max_installments: number;
    min_amount_per_installment: number;
    no_interest: boolean;
  };
  pix_discount: {
    enabled: boolean;
    discount_percent: number;
  };
  tiers: IncentiveTier[];
  messages: {
    on_add: string;
    near_free_shipping: string;
    unlocked_free_shipping: string;
    unlocked_gift: string;
  };
}

export const defaultIncentivesConfig: PurchaseIncentivesConfig = {
  enabled: false,
  installments: {
    enabled: true,
    max_installments: 3,
    min_amount_per_installment: 30,
    no_interest: true,
  },
  pix_discount: {
    enabled: true,
    discount_percent: 5,
  },
  tiers: [
    { min_value: 250, benefit: "Frete grátis SP", emoji: "truck" },
    { min_value: 350, benefit: "Frete grátis + mimo", emoji: "gift" },
    { min_value: 500, benefit: "Brinde premium", emoji: "star" },
    { min_value: 700, benefit: "Cliente VIP (cupom próximo pedido)", emoji: "crown" },
  ],
  messages: {
    on_add: "Falta só mais uma peça para parcelar em 4x ;)",
    near_free_shipping: "Você está a R${remaining} do frete grátis!",
    unlocked_free_shipping: "Parabéns! Você ganhou frete grátis!",
    unlocked_gift: "Seu pedido ganhou um presente!",
  },
};

const emojiIcons: Record<string, typeof Truck> = {
  truck: Truck,
  gift: Gift,
  star: Star,
  crown: Crown,
};

const getEmojiIcon = (emoji: string) => {
  return emojiIcons[emoji] || Gift;
};

// Helper: calculate installment info
export function getInstallmentInfo(price: number, config: PurchaseIncentivesConfig) {
  if (!config.enabled || !config.installments.enabled || price <= 0) return null;
  
  const { max_installments, min_amount_per_installment, no_interest } = config.installments;
  
  // Calculate max possible installments based on min amount
  let installments = Math.min(
    max_installments,
    Math.floor(price / min_amount_per_installment)
  );
  
  if (installments < 2) return null;
  
  const perInstallment = price / installments;
  
  return {
    installments,
    perInstallment,
    noInterest: no_interest,
  };
}

// Helper: calculate PIX price
export function getPixPrice(price: number, config: PurchaseIncentivesConfig) {
  if (!config.enabled || !config.pix_discount.enabled) return null;
  
  const discount = config.pix_discount.discount_percent;
  const pixPrice = price * (1 - discount / 100);
  
  return {
    price: pixPrice,
    discountPercent: discount,
  };
}

// Helper: get next tier message for toast
export function getNextTierMessage(cartTotal: number, config: PurchaseIncentivesConfig): string | null {
  if (!config.enabled || !config.tiers || config.tiers.length === 0) return null;
  
  const sortedTiers = [...config.tiers].sort((a, b) => a.min_value - b.min_value);
  
  // Find the next tier that hasn't been unlocked
  const nextTier = sortedTiers.find(t => cartTotal < t.min_value);
  
  if (nextTier) {
    const remaining = nextTier.min_value - cartTotal;
    return config.messages.near_free_shipping.replace("${remaining}", remaining.toFixed(0));
  }
  
  return null;
}

// Helper: check if a tier was just unlocked (for celebratory toast)
export function getUnlockedTierMessage(prevTotal: number, newTotal: number, config: PurchaseIncentivesConfig): string | null {
  if (!config.enabled || !config.tiers || config.tiers.length === 0) return null;
  
  const sortedTiers = [...config.tiers].sort((a, b) => a.min_value - b.min_value);
  
  // Find tiers that were just crossed
  for (const tier of sortedTiers) {
    if (prevTotal < tier.min_value && newTotal >= tier.min_value) {
      // First tier unlocked = free shipping message, others = gift message
      if (tier === sortedTiers[0]) {
        return config.messages.unlocked_free_shipping;
      }
      return config.messages.unlocked_gift;
    }
  }
  
  return null;
}

// ============================
// Component: InstallmentInfo
// Below the price on each product card
// ============================
interface InstallmentInfoProps {
  price: number;
  config: PurchaseIncentivesConfig;
}

export function InstallmentInfo({ price, config }: InstallmentInfoProps) {
  if (!config.enabled) return null;
  
  const installment = getInstallmentInfo(price, config);
  const pix = getPixPrice(price, config);
  
  if (!installment && !pix) return null;
  
  const formatPrice = (p: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p);
  
  return (
    <div className="space-y-0.5">
      {installment && (
        <p className="text-[11px] text-gray-500">
          💳 {installment.installments}x de {formatPrice(installment.perInstallment)}
          {installment.noInterest && " sem juros"}
        </p>
      )}
      {pix && (
        <p className="text-[11px] text-green-600 font-medium">
          ou {formatPrice(pix.price)} no PIX ({pix.discountPercent}% OFF)
        </p>
      )}
    </div>
  );
}

// ============================
// Component: CartProgressBar
// Progress bar + tier list inside the cart
// ============================
interface CartProgressBarProps {
  cartTotal: number;
  config: PurchaseIncentivesConfig;
  primaryColor: string;
}

export function CartProgressBar({ cartTotal, config, primaryColor }: CartProgressBarProps) {
  if (!config.enabled || !config.tiers || config.tiers.length === 0) return null;
  
  const sortedTiers = [...config.tiers].sort((a, b) => a.min_value - b.min_value);
  const maxTierValue = sortedTiers[sortedTiers.length - 1].min_value;
  
  // Find the next unlocked tier for progress bar
  const nextTier = sortedTiers.find(t => cartTotal < t.min_value);
  const progressTarget = nextTier ? nextTier.min_value : maxTierValue;
  const progressPercent = Math.min(100, (cartTotal / progressTarget) * 100);
  
  const formatPrice = (p: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p);
  
  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
      {/* Progress bar for next tier */}
      {nextTier && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">🛍️ {formatPrice(cartTotal)} no carrinho</span>
            <span className="font-medium text-gray-700">
              Falta {formatPrice(nextTier.min_value - cartTotal)}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, backgroundColor: primaryColor }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            para {nextTier.benefit}
          </p>
        </div>
      )}
      
      {/* All tiers unlocked message */}
      {!nextTier && (
        <div className="text-center py-1">
          <p className="text-sm font-semibold text-green-600">🎉 Todos os benefícios desbloqueados!</p>
        </div>
      )}
      
      {/* Tier list */}
      <div className="space-y-1.5">
        {sortedTiers.map((tier, index) => {
          const isUnlocked = cartTotal >= tier.min_value;
          const Icon = getEmojiIcon(tier.emoji);
          
          return (
            <div
              key={index}
              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-all ${
                isUnlocked 
                  ? "bg-green-50 text-green-700" 
                  : "text-gray-400"
              }`}
            >
              {isUnlocked ? (
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
              )}
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className={isUnlocked ? "font-medium" : ""}>
                {formatPrice(tier.min_value)} - {tier.benefit}
              </span>
              {isUnlocked && (
                <span className="ml-auto text-[10px] text-green-500 font-semibold">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
