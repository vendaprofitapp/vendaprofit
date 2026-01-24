import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LandingPageSettings {
  id: string;
  owner_id: string;
  hero_badge_text: string;
  hero_title: string;
  hero_title_highlight: string;
  hero_subtitle: string;
  hero_cta_primary_text: string;
  hero_cta_secondary_text: string;
  hero_footer_text: string;
  video_badge_text: string;
  video_title: string;
  video_title_highlight: string;
  video_subtitle: string;
  video_url: string;
  video_footer_text: string;
  features_title: string;
  features_title_highlight: string;
  features_subtitle: string;
  testimonials_title: string;
  testimonials_title_highlight: string;
  testimonials_subtitle: string;
  pricing_title: string;
  pricing_title_highlight: string;
  pricing_subtitle: string;
  faq_title: string;
  faq_title_highlight: string;
  cta_title: string;
  cta_subtitle: string;
  cta_button_text: string;
  cta_features: string[];
  footer_copyright: string;
  primary_color: string | null;
  logo_url: string | null;
}

export interface LandingPageFeature {
  id: string;
  owner_id: string;
  section_type: "features" | "benefits";
  icon_name: string;
  title: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

export interface LandingPageTestimonial {
  id: string;
  owner_id: string;
  customer_name: string;
  customer_role: string;
  content: string;
  rating: number;
  avatar_url: string | null;
  display_order: number;
  is_active: boolean;
}

export interface LandingPagePricing {
  id: string;
  owner_id: string;
  plan_name: string;
  plan_subtitle: string;
  price: string;
  price_period: string;
  price_note: string | null;
  features: string[];
  button_text: string;
  button_link: string;
  is_popular: boolean;
  badge_text: string | null;
  badge_color: string;
  display_order: number;
  is_active: boolean;
}

export interface LandingPageFAQ {
  id: string;
  owner_id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

// Default values for when no data exists
const defaultSettings: Omit<LandingPageSettings, "id" | "owner_id"> = {
  hero_badge_text: "Sistema completo de gestão para lojas",
  hero_title: "Transforme suas vendas fitness com",
  hero_title_highlight: "controle total na palma da mão e I.A.",
  hero_subtitle: "Controle estoque, venda por voz, ofereça provador virtual e muito mais. Tudo em um único sistema feito para aumentar suas vendas.",
  hero_cta_primary_text: "Começar Grátis por 14 dias",
  hero_cta_secondary_text: "Ver Demonstração",
  hero_footer_text: "✓ Sem cartão de crédito    ✓ Cancele quando quiser",
  video_badge_text: "Veja o sistema em ação",
  video_title: "Conheça o",
  video_title_highlight: "Venda PROFIT por dentro",
  video_subtitle: "Assista e descubra como o sistema pode revolucionar sua loja",
  video_url: "https://www.youtube.com/embed/VIDEO_ID",
  video_footer_text: "🎬 Tour completo pelo sistema em menos de 5 minutos",
  features_title: "Tudo que você precisa em",
  features_title_highlight: "um só lugar",
  features_subtitle: "Funcionalidades pensadas para simplificar sua rotina e potencializar seus resultados",
  testimonials_title: "O que nossos",
  testimonials_title_highlight: "clientes dizem",
  testimonials_subtitle: "Histórias reais de vendedoras fitness que transformaram seus negócios",
  pricing_title: "Planos que cabem no seu",
  pricing_title_highlight: "bolso",
  pricing_subtitle: "Escolha o plano ideal para o seu negócio",
  faq_title: "Perguntas",
  faq_title_highlight: "Frequentes",
  cta_title: "Pronto para transformar sua loja?",
  cta_subtitle: "Junte-se a centenas de vendedoras fitness que já estão vendendo mais com o Venda PROFIT",
  cta_button_text: "Começar Agora — É Grátis",
  cta_features: ["14 dias grátis", "Sem cartão de crédito", "Suporte incluso"],
  footer_copyright: "Venda PROFIT. Todos os direitos reservados.",
  primary_color: null,
  logo_url: null,
};

const defaultFeatures: Omit<LandingPageFeature, "id" | "owner_id">[] = [
  { section_type: "features", icon_name: "Package", title: "Controle de Estoque", description: "Gerencie seu estoque em tempo real com alertas de baixo estoque e importação via nota fiscal.", display_order: 0, is_active: true },
  { section_type: "features", icon_name: "Mic", title: "Vendas por Voz", description: "Registre vendas apenas falando. Nossa IA transcreve e processa automaticamente.", display_order: 1, is_active: true },
  { section_type: "features", icon_name: "Shirt", title: "Provador Virtual IA", description: "Seus clientes podem experimentar roupas virtualmente antes de comprar.", display_order: 2, is_active: true },
  { section_type: "features", icon_name: "BarChart3", title: "Relatórios Inteligentes", description: "Dashboard completo com métricas de vendas, produtos mais vendidos e análises.", display_order: 3, is_active: true },
  { section_type: "features", icon_name: "Users", title: "Gestão de Clientes", description: "Cadastro completo de clientes com histórico de compras e preferências.", display_order: 4, is_active: true },
  { section_type: "features", icon_name: "Store", title: "Loja Virtual", description: "Catálogo online personalizado para seus clientes comprarem pelo WhatsApp.", display_order: 5, is_active: true },
  { section_type: "benefits", icon_name: "Zap", title: "Aumente suas Vendas", description: "Otimize processos e venda mais com menos esforço", display_order: 0, is_active: true },
  { section_type: "benefits", icon_name: "Shield", title: "Dados Seguros", description: "Seus dados protegidos com criptografia de ponta", display_order: 1, is_active: true },
  { section_type: "benefits", icon_name: "Smartphone", title: "Acesse de Qualquer Lugar", description: "Sistema 100% online, funciona em qualquer dispositivo", display_order: 2, is_active: true },
];

const defaultTestimonials: Omit<LandingPageTestimonial, "id" | "owner_id">[] = [
  { customer_name: "Maria Silva", customer_role: "Loja de Roupas Femininas", content: "O Venda PROFIT revolucionou minha loja! As vendas por voz economizam muito tempo.", rating: 5, avatar_url: null, display_order: 0, is_active: true },
  { customer_name: "João Santos", customer_role: "Boutique Masculina", content: "O provador virtual IA aumentou minhas vendas online em 40%. Incrível!", rating: 5, avatar_url: null, display_order: 1, is_active: true },
  { customer_name: "Ana Oliveira", customer_role: "Multi Marcas", content: "Finalmente um sistema completo e fácil de usar. Recomendo demais!", rating: 5, avatar_url: null, display_order: 2, is_active: true },
];

const defaultPricing: Omit<LandingPagePricing, "id" | "owner_id">[] = [
  { plan_name: "Teste Grátis", plan_subtitle: "Experimente sem compromisso", price: "R$0", price_period: "/14 dias", price_note: null, features: ["Acesso completo ao sistema", "Todas as funcionalidades", "Suporte por WhatsApp", "Sem cartão de crédito"], button_text: "Começar Grátis", button_link: "/auth", is_popular: false, badge_text: null, badge_color: "primary", display_order: 0, is_active: true },
  { plan_name: "Mensal", plan_subtitle: "Flexibilidade total", price: "R$197", price_period: "/mês", price_note: null, features: ["Tudo do plano gratuito", "Produtos ilimitados", "Provador Virtual IA", "Suporte prioritário"], button_text: "Assinar Agora", button_link: "/auth", is_popular: true, badge_text: "Mais Popular", badge_color: "primary", display_order: 1, is_active: true },
  { plan_name: "Anual", plan_subtitle: "Melhor custo-benefício", price: "R$97", price_period: "/mês", price_note: "Cobrado anualmente (R$1.164/ano)", features: ["Tudo do plano mensal", "Economia de R$1.200/ano", "Treinamento exclusivo", "Consultoria inicial"], button_text: "Assinar Anual", button_link: "/auth", is_popular: false, badge_text: "Economia de 51%", badge_color: "green", display_order: 2, is_active: true },
];

const defaultFAQs: Omit<LandingPageFAQ, "id" | "owner_id">[] = [
  { question: "Como funciona o período de teste?", answer: "Você pode testar o Venda PROFIT gratuitamente por 14 dias, sem precisar de cartão de crédito. Após o período, escolha o plano ideal para você.", display_order: 0, is_active: true },
  { question: "Preciso instalar algo no computador?", answer: "Não! O Venda PROFIT é 100% online. Basta acessar pelo navegador do seu computador, tablet ou celular.", display_order: 1, is_active: true },
  { question: "Como funciona o provador virtual com IA?", answer: "Seus clientes enviam uma foto e selecionam a roupa. Nossa IA gera uma imagem realista de como a peça ficaria no cliente.", display_order: 2, is_active: true },
  { question: "Posso importar meus produtos de outro sistema?", answer: "Sim! Você pode importar produtos via planilha Excel ou diretamente pela nota fiscal XML.", display_order: 3, is_active: true },
  { question: "O sistema funciona offline?", answer: "O Venda PROFIT requer conexão com a internet para funcionar, garantindo que seus dados estejam sempre sincronizados e seguros na nuvem.", display_order: 4, is_active: true },
];

export function useLandingPageSettings() {
  return useQuery({
    queryKey: ["landing-page-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_settings")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (!data) {
        return { ...defaultSettings, id: "", owner_id: "" } as LandingPageSettings;
      }
      
      return {
        ...data,
        cta_features: Array.isArray(data.cta_features) ? data.cta_features : defaultSettings.cta_features,
      } as LandingPageSettings;
    },
  });
}

export function useLandingPageFeatures(sectionType?: "features" | "benefits") {
  return useQuery({
    queryKey: ["landing-page-features", sectionType],
    queryFn: async () => {
      let query = supabase
        .from("landing_page_features")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (sectionType) {
        query = query.eq("section_type", sectionType);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (!data || data.length === 0) {
        const filtered = sectionType 
          ? defaultFeatures.filter(f => f.section_type === sectionType)
          : defaultFeatures;
        return filtered.map((f, i) => ({ ...f, id: `default-${i}`, owner_id: "" })) as LandingPageFeature[];
      }
      
      return data as LandingPageFeature[];
    },
  });
}

export function useLandingPageTestimonials() {
  return useQuery({
    queryKey: ["landing-page-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_testimonials")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return defaultTestimonials.map((t, i) => ({ ...t, id: `default-${i}`, owner_id: "" })) as LandingPageTestimonial[];
      }
      
      return data as LandingPageTestimonial[];
    },
  });
}

export function useLandingPagePricing() {
  return useQuery({
    queryKey: ["landing-page-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_pricing")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return defaultPricing.map((p, i) => ({ ...p, id: `default-${i}`, owner_id: "" })) as LandingPagePricing[];
      }
      
      return data.map(p => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
      })) as LandingPagePricing[];
    },
  });
}

export function useLandingPageFAQs() {
  return useQuery({
    queryKey: ["landing-page-faqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_faqs")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return defaultFAQs.map((f, i) => ({ ...f, id: `default-${i}`, owner_id: "" })) as LandingPageFAQ[];
      }
      
      return data as LandingPageFAQ[];
    },
  });
}

// Admin mutations
export function useUpdateLandingPageSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<LandingPageSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("landing_page_settings")
        .select("id")
        .limit(1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("landing_page_settings")
          .update(settings)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("landing_page_settings")
          .insert({ ...settings, owner_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });
}

// Helper to check if ID is a default placeholder
const isDefaultId = (id?: string) => id?.startsWith("default-");

export function useManageLandingPageFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, feature }: { action: "create" | "update" | "delete"; feature: Partial<LandingPageFeature> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Treat default IDs as create operations
      const effectiveAction = (action === "update" || action === "delete") && isDefaultId(feature.id) 
        ? (action === "delete" ? "skip" : "create") 
        : action;

      if (effectiveAction === "skip") {
        // Skip delete for default items - they don't exist in DB
        return;
      }

      if (effectiveAction === "create") {
        const { id, owner_id, ...rest } = feature;
        const { error } = await supabase
          .from("landing_page_features")
          .insert({ 
            section_type: rest.section_type || "features",
            icon_name: rest.icon_name || "Package",
            title: rest.title || "",
            description: rest.description || "",
            display_order: rest.display_order || 0,
            is_active: rest.is_active ?? true,
            owner_id: user.id 
          });
        if (error) throw error;
      } else if (effectiveAction === "update" && feature.id) {
        const { id, owner_id, ...updateData } = feature;
        const { error } = await supabase
          .from("landing_page_features")
          .update(updateData)
          .eq("id", feature.id);
        if (error) throw error;
      } else if (effectiveAction === "delete" && feature.id) {
        const { error } = await supabase
          .from("landing_page_features")
          .delete()
          .eq("id", feature.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-features"] });
      toast.success("Feature atualizada!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useManageLandingPageTestimonial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, testimonial }: { action: "create" | "update" | "delete"; testimonial: Partial<LandingPageTestimonial> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Treat default IDs as create operations
      const effectiveAction = (action === "update" || action === "delete") && isDefaultId(testimonial.id) 
        ? (action === "delete" ? "skip" : "create") 
        : action;

      if (effectiveAction === "skip") {
        return;
      }

      if (effectiveAction === "create") {
        const { id, owner_id, ...rest } = testimonial;
        const { error } = await supabase
          .from("landing_page_testimonials")
          .insert({ 
            customer_name: rest.customer_name || "",
            customer_role: rest.customer_role || "",
            content: rest.content || "",
            rating: rest.rating || 5,
            avatar_url: rest.avatar_url,
            display_order: rest.display_order || 0,
            is_active: rest.is_active ?? true,
            owner_id: user.id 
          });
        if (error) throw error;
      } else if (effectiveAction === "update" && testimonial.id) {
        const { id, owner_id, ...updateData } = testimonial;
        const { error } = await supabase
          .from("landing_page_testimonials")
          .update(updateData)
          .eq("id", testimonial.id);
        if (error) throw error;
      } else if (effectiveAction === "delete" && testimonial.id) {
        const { error } = await supabase
          .from("landing_page_testimonials")
          .delete()
          .eq("id", testimonial.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-testimonials"] });
      toast.success("Depoimento atualizado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useManageLandingPagePricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, pricing }: { action: "create" | "update" | "delete"; pricing: Partial<LandingPagePricing> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Treat default IDs as create operations
      const effectiveAction = (action === "update" || action === "delete") && isDefaultId(pricing.id) 
        ? (action === "delete" ? "skip" : "create") 
        : action;

      if (effectiveAction === "skip") {
        return;
      }

      if (effectiveAction === "create") {
        const { id, owner_id, ...rest } = pricing;
        const { error } = await supabase
          .from("landing_page_pricing")
          .insert({ 
            plan_name: rest.plan_name || "",
            plan_subtitle: rest.plan_subtitle || "",
            price: rest.price || "",
            price_period: rest.price_period || "",
            price_note: rest.price_note,
            features: rest.features || [],
            button_text: rest.button_text || "",
            button_link: rest.button_link || "/auth",
            is_popular: rest.is_popular ?? false,
            badge_text: rest.badge_text,
            badge_color: rest.badge_color || "primary",
            display_order: rest.display_order || 0,
            is_active: rest.is_active ?? true,
            owner_id: user.id 
          });
        if (error) throw error;
      } else if (effectiveAction === "update" && pricing.id) {
        const { id, owner_id, ...updateData } = pricing;
        const { error } = await supabase
          .from("landing_page_pricing")
          .update(updateData)
          .eq("id", pricing.id);
        if (error) throw error;
      } else if (effectiveAction === "delete" && pricing.id) {
        const { error } = await supabase
          .from("landing_page_pricing")
          .delete()
          .eq("id", pricing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-pricing"] });
      toast.success("Plano atualizado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useManageLandingPageFAQ() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, faq }: { action: "create" | "update" | "delete"; faq: Partial<LandingPageFAQ> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Treat default IDs as create operations
      const effectiveAction = (action === "update" || action === "delete") && isDefaultId(faq.id) 
        ? (action === "delete" ? "skip" : "create") 
        : action;

      if (effectiveAction === "skip") {
        return;
      }

      if (effectiveAction === "create") {
        const { id, owner_id, ...rest } = faq;
        const { error } = await supabase
          .from("landing_page_faqs")
          .insert({ 
            question: rest.question || "",
            answer: rest.answer || "",
            display_order: rest.display_order || 0,
            is_active: rest.is_active ?? true,
            owner_id: user.id 
          });
        if (error) throw error;
      } else if (effectiveAction === "update" && faq.id) {
        const { id, owner_id, ...updateData } = faq;
        const { error } = await supabase
          .from("landing_page_faqs")
          .update(updateData)
          .eq("id", faq.id);
        if (error) throw error;
      } else if (effectiveAction === "delete" && faq.id) {
        const { error } = await supabase
          .from("landing_page_faqs")
          .delete()
          .eq("id", faq.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-faqs"] });
      toast.success("FAQ atualizada!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

// Export defaults for seeding
export { defaultSettings, defaultFeatures, defaultTestimonials, defaultPricing, defaultFAQs };
