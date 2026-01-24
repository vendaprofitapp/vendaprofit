-- Landing Page CMS Tables

-- Main landing page settings
CREATE TABLE public.landing_page_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  
  -- Hero Section
  hero_badge_text text DEFAULT 'Sistema completo de gestão para lojas',
  hero_title text DEFAULT 'Transforme suas vendas fitness com',
  hero_title_highlight text DEFAULT 'controle total na palma da mão e I.A.',
  hero_subtitle text DEFAULT 'Controle estoque, venda por voz, ofereça provador virtual e muito mais. Tudo em um único sistema feito para aumentar suas vendas.',
  hero_cta_primary_text text DEFAULT 'Começar Grátis por 14 dias',
  hero_cta_secondary_text text DEFAULT 'Ver Demonstração',
  hero_footer_text text DEFAULT '✓ Sem cartão de crédito    ✓ Cancele quando quiser',
  
  -- Video Section
  video_badge_text text DEFAULT 'Veja o sistema em ação',
  video_title text DEFAULT 'Conheça o',
  video_title_highlight text DEFAULT 'Venda PROFIT por dentro',
  video_subtitle text DEFAULT 'Assista e descubra como o sistema pode revolucionar sua loja',
  video_url text DEFAULT 'https://www.youtube.com/embed/VIDEO_ID',
  video_footer_text text DEFAULT '🎬 Tour completo pelo sistema em menos de 5 minutos',
  
  -- Features Section
  features_title text DEFAULT 'Tudo que você precisa em',
  features_title_highlight text DEFAULT 'um só lugar',
  features_subtitle text DEFAULT 'Funcionalidades pensadas para simplificar sua rotina e potencializar seus resultados',
  
  -- Testimonials Section
  testimonials_title text DEFAULT 'O que nossos',
  testimonials_title_highlight text DEFAULT 'clientes dizem',
  testimonials_subtitle text DEFAULT 'Histórias reais de vendedoras fitness que transformaram seus negócios',
  
  -- Pricing Section
  pricing_title text DEFAULT 'Planos que cabem no seu',
  pricing_title_highlight text DEFAULT 'bolso',
  pricing_subtitle text DEFAULT 'Escolha o plano ideal para o seu negócio',
  
  -- FAQ Section
  faq_title text DEFAULT 'Perguntas',
  faq_title_highlight text DEFAULT 'Frequentes',
  
  -- CTA Section
  cta_title text DEFAULT 'Pronto para transformar sua loja?',
  cta_subtitle text DEFAULT 'Junte-se a centenas de vendedoras fitness que já estão vendendo mais com o Venda PROFIT',
  cta_button_text text DEFAULT 'Começar Agora — É Grátis',
  cta_features jsonb DEFAULT '["14 dias grátis", "Sem cartão de crédito", "Suporte incluso"]'::jsonb,
  
  -- Footer
  footer_copyright text DEFAULT 'Venda PROFIT. Todos os direitos reservados.',
  
  -- Styling
  primary_color text DEFAULT NULL,
  logo_url text DEFAULT NULL,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Landing page features/benefits cards
CREATE TABLE public.landing_page_features (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  section_type text NOT NULL CHECK (section_type IN ('features', 'benefits')),
  icon_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Landing page testimonials
CREATE TABLE public.landing_page_testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_role text NOT NULL,
  content text NOT NULL,
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  avatar_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Landing page pricing plans
CREATE TABLE public.landing_page_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  plan_name text NOT NULL,
  plan_subtitle text NOT NULL,
  price text NOT NULL,
  price_period text NOT NULL,
  price_note text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  button_text text NOT NULL,
  button_link text DEFAULT '/auth',
  is_popular boolean NOT NULL DEFAULT false,
  badge_text text,
  badge_color text DEFAULT 'primary',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Landing page FAQs
CREATE TABLE public.landing_page_faqs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_faqs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for landing_page_settings
CREATE POLICY "Public can view landing page settings" 
ON public.landing_page_settings FOR SELECT USING (true);

CREATE POLICY "Admins can manage landing page settings" 
ON public.landing_page_settings FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for landing_page_features
CREATE POLICY "Public can view active features" 
ON public.landing_page_features FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage landing page features" 
ON public.landing_page_features FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for landing_page_testimonials
CREATE POLICY "Public can view active testimonials" 
ON public.landing_page_testimonials FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage landing page testimonials" 
ON public.landing_page_testimonials FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for landing_page_pricing
CREATE POLICY "Public can view active pricing" 
ON public.landing_page_pricing FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage landing page pricing" 
ON public.landing_page_pricing FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for landing_page_faqs
CREATE POLICY "Public can view active faqs" 
ON public.landing_page_faqs FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage landing page faqs" 
ON public.landing_page_faqs FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_landing_page_settings_updated_at
BEFORE UPDATE ON public.landing_page_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landing_page_features_updated_at
BEFORE UPDATE ON public.landing_page_features
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landing_page_testimonials_updated_at
BEFORE UPDATE ON public.landing_page_testimonials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landing_page_pricing_updated_at
BEFORE UPDATE ON public.landing_page_pricing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landing_page_faqs_updated_at
BEFORE UPDATE ON public.landing_page_faqs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();