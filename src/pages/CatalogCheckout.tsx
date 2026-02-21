import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, ShoppingBag } from "lucide-react";

interface CartItem {
  displayItem: {
    id: string;
    productId: string;
    name: string;
    color: string | null;
    image_url: string | null;
    isB2B: boolean;
    isPartner: boolean;
    sizeIsPartner: Record<string, boolean>;
  };
  selectedSize: string;
  quantity: number;
  effectivePrice: number;
}

interface StoreData {
  id: string;
  owner_id: string;
  store_name: string;
  whatsapp_number: string | null;
  primary_color: string | null;
  logo_url: string | null;
}

interface CheckoutState {
  cart: CartItem[];
  store: StoreData;
  cartTotal: number;
  slug: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

const generateShortCode = (): string => {
  const hex = Math.random().toString(16).substring(2, 6).toUpperCase();
  return `VP-${hex}`;
};

const getItemSource = (item: CartItem): string => {
  if (item.displayItem.isB2B) return "b2b";
  if (item.displayItem.isPartner) return "partner";
  if (item.displayItem.sizeIsPartner?.[item.selectedSize]) return "partner";
  return "own";
};

const getSourceLabel = (source: string): string => {
  switch (source) {
    case "b2b": return "[Sob Encomenda]";
    case "partner": return "[Parceira]";
    default: return "";
  }
};

export default function CatalogCheckout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const state = location.state as CheckoutState | null;

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sending, setSending] = useState(false);

  // Pre-fill from localStorage
  useEffect(() => {
    if (!slug) return;
    try {
      const stored = localStorage.getItem(`store_lead_${slug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name) setName(parsed.name);
        if (parsed.whatsapp) setWhatsapp(parsed.whatsapp);
      }
    } catch {}
  }, [slug]);

  // If no state, redirect back
  if (!state || !state.cart || state.cart.length === 0 || !state.store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <ShoppingBag className="h-16 w-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Carrinho vazio</h1>
        <p className="text-gray-500 mb-4">Seu carrinho está vazio ou expirou.</p>
        <Button variant="outline" onClick={() => navigate(`/${slug}`)}>
          Voltar ao catálogo
        </Button>
      </div>
    );
  }

  const { cart, store, cartTotal } = state;
  const primaryColor = store.primary_color || "#DA2576";

  const formatWhatsApp = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWhatsapp(formatWhatsApp(e.target.value));
  };

  const isValid = name.trim().length >= 2 && whatsapp.replace(/\D/g, "").length >= 10;

  const handleSubmit = async () => {
    if (!isValid || sending) return;
    setSending(true);

    try {
      const cleanPhone = whatsapp.replace(/\D/g, "");
      const shortCode = generateShortCode();

      // 1. Save/update lead
      let leadId: string | null = null;
      const { data: existingLead } = await supabase
        .from("store_leads")
        .select("id")
        .eq("store_id", store.id)
        .eq("whatsapp", cleanPhone)
        .maybeSingle();

      if (existingLead) {
        leadId = existingLead.id;
        await supabase
          .from("store_leads")
          .update({ last_seen_at: new Date().toISOString(), name: name.trim() } as any)
          .eq("id", existingLead.id);
      } else {
        const deviceId = `${slug}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const { data: newLead } = await supabase
          .from("store_leads")
          .insert({
            store_id: store.id,
            owner_id: store.owner_id,
            name: name.trim(),
            whatsapp: cleanPhone,
            device_id: deviceId,
            last_seen_at: new Date().toISOString(),
          } as any)
          .select("id")
          .single();
        leadId = newLead?.id || null;
      }

      // Save to localStorage
      localStorage.setItem(`store_lead_${slug}`, JSON.stringify({
        name: name.trim(),
        whatsapp: cleanPhone,
        lead_id: leadId,
        captured_at: new Date().toISOString(),
      }));

      // 2. Save cart (saved_carts + saved_cart_items)
      const { data: savedCart } = await supabase
        .from("saved_carts")
        .insert({
          short_code: shortCode,
          store_id: store.id,
          owner_id: store.owner_id,
          lead_id: leadId,
          customer_name: name.trim(),
          customer_phone: cleanPhone,
          total: cartTotal,
          status: "waiting",
        } as any)
        .select("id")
        .single();

      if (savedCart) {
        const cartItems = cart.map(item => ({
          cart_id: savedCart.id,
          product_id: item.displayItem.productId,
          product_name: item.displayItem.name,
          variant_color: item.displayItem.color || null,
          selected_size: item.selectedSize,
          quantity: item.quantity,
          unit_price: item.effectivePrice,
          source: getItemSource(item),
        }));
        await supabase.from("saved_cart_items").insert(cartItems as any);
      }

      // 3. Insert sale with source='catalog' to trigger BotConversa webhook
      await supabase.from("sales").insert({
        owner_id: store.owner_id,
        customer_name: name.trim(),
        customer_phone: cleanPhone,
        payment_method: "Pendente",
        subtotal: cartTotal,
        total: cartTotal,
        discount_amount: 0,
        status: "completed",
        sale_source: "catalog",
        notes: `Pedido via catálogo ${shortCode}`,
      } as any);

      // 4. Mark lead_cart_items as converted
      if (leadId) {
        await supabase
          .from("lead_cart_items")
          .update({ status: "converted" } as any)
          .eq("lead_id", leadId)
          .eq("status", "abandoned");
      }

      // 5. Build WhatsApp message and open
      const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      let message = `🧾 *Código do pedido: ${shortCode}*\n\n`;
      message += "Olá! Gostaria de fazer o seguinte pedido:\n\n";

      cart.forEach((item, index) => {
        const colorInfo = item.displayItem.color ? ` - ${item.displayItem.color}` : "";
        const source = getItemSource(item);
        const sourceLabel = getSourceLabel(source);
        const emoji = index < numberEmojis.length ? numberEmojis[index] : `${index + 1}.`;
        message += `${emoji} ${item.displayItem.name}${colorInfo} ${sourceLabel}\n`;
        message += `Tamanho: ${item.selectedSize}\n`;
        message += `Quantidade: ${item.quantity}\n`;
        message += `Preço unitário: ${formatPrice(item.effectivePrice)}\n`;
        message += `Subtotal: ${formatPrice(item.effectivePrice * item.quantity)}\n\n`;
      });

      message += `✅ *TOTAL: ${formatPrice(cartTotal)}*`;

      const phone = store.whatsapp_number!.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");

      toast.success("Pedido enviado com sucesso! 🎉");
      navigate(`/${slug}`, { replace: true });
    } catch (err) {
      console.error("Erro ao finalizar pedido:", err);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.store_name} className="h-8 object-contain" />
          ) : (
            <span className="font-semibold text-gray-900">{store.store_name}</span>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Resumo do Pedido
            </h2>
          </div>

          <div className="divide-y">
            {cart.map((item, index) => (
              <div key={index} className="flex gap-3 p-4">
                {item.displayItem.image_url && (
                  <img
                    src={item.displayItem.image_url}
                    alt={item.displayItem.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {item.displayItem.name}
                  </p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-0.5">
                    {item.displayItem.color && <span>{item.displayItem.color}</span>}
                    <span>Tam: {item.selectedSize}</span>
                    <span>Qtd: {item.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">
                      {formatPrice(item.effectivePrice)} un.
                    </span>
                    <span className="font-semibold text-sm text-gray-900">
                      {formatPrice(item.effectivePrice * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center">
            <span className="font-semibold text-gray-700">Total</span>
            <span className="text-xl font-bold" style={{ color: primaryColor }}>
              {formatPrice(cartTotal)}
            </span>
          </div>
        </div>

        {/* Customer form */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Seus dados</h2>

          <div className="space-y-2">
            <Label htmlFor="checkout-name">Nome</Label>
            <Input
              id="checkout-name"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkout-whatsapp">WhatsApp</Label>
            <Input
              id="checkout-whatsapp"
              placeholder="(00) 00000-0000"
              value={whatsapp}
              onChange={handleWhatsAppChange}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
            />
          </div>
        </div>

        {/* Submit button */}
        <Button
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2 text-white shadow-lg"
          style={{ backgroundColor: primaryColor }}
          onClick={handleSubmit}
          disabled={!isValid || sending}
        >
          <MessageCircle className="h-5 w-5" />
          {sending ? "Enviando..." : "Enviar Pedido pelo WhatsApp"}
        </Button>
      </div>
    </div>
  );
}
