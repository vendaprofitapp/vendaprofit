import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Package,
  Mic,
  Shirt,
  BarChart3,
  Users,
  Store,
  Star,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Smartphone,
  Play,
  LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import logoVendaProfit from "@/assets/logo-venda-profit.png";
import {
  useLandingPageSettings,
  useLandingPageFeatures,
  useLandingPageTestimonials,
  useLandingPagePricing,
  useLandingPageFAQs,
} from "@/hooks/useLandingPageCMS";

// Lazy load the VideoSalesBubble for better performance
const VideoSalesBubble = lazy(() => 
  import("@/components/marketing/VideoSalesBubble").then(m => ({ default: m.VideoSalesBubble }))
);

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  Package,
  Mic,
  Shirt,
  BarChart3,
  Users,
  Store,
  Star,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Smartphone,
  Play,
};

const LandingPage = () => {
  const { data: settings } = useLandingPageSettings();
  const { data: features } = useLandingPageFeatures("features");
  const { data: benefits } = useLandingPageFeatures("benefits");
  const { data: testimonials } = useLandingPageTestimonials();
  const { data: pricing } = useLandingPagePricing();
  const { data: faqs } = useLandingPageFAQs();

  const logoUrl = settings?.logo_url || logoVendaProfit;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Venda PROFIT" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Venda PROFIT
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                Começar Grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6 animate-fade-in">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">{settings?.hero_badge_text}</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in">
              {settings?.hero_title}{" "}
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                {settings?.hero_title_highlight}
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in">
              {settings?.hero_subtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25">
                  {settings?.hero_cta_primary_text}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8">
                {settings?.hero_cta_secondary_text}
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              {settings?.hero_footer_text}
            </p>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
                <Play className="w-4 h-4" />
                <span className="text-sm font-medium">{settings?.video_badge_text}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {settings?.video_title}{" "}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {settings?.video_title_highlight}
                </span>
              </h2>
              <p className="text-lg text-muted-foreground">
                {settings?.video_subtitle}
              </p>
            </div>

            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-border bg-background">
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  src={settings?.video_url}
                  title="Demonstração Venda PROFIT"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-4">
              {settings?.video_footer_text}
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {benefits?.map((benefit, index) => {
              const IconComponent = iconMap[benefit.icon_name] || Zap;
              return (
                <div
                  key={benefit.id || index}
                  className="flex items-start gap-4 p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-all hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                    <IconComponent className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{benefit.title}</h3>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {settings?.features_title}{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {settings?.features_title_highlight}
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {settings?.features_subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features?.map((feature, index) => {
              const IconComponent = iconMap[feature.icon_name] || Package;
              return (
                <Card
                  key={feature.id || index}
                  className="group hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1 bg-gradient-to-br from-background to-muted/20"
                >
                  <CardContent className="p-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 group-hover:from-primary group-hover:to-primary/60 transition-all">
                      <IconComponent className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {settings?.testimonials_title}{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {settings?.testimonials_title_highlight}
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              {settings?.testimonials_subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials?.map((testimonial, index) => (
              <Card key={testimonial.id || index} className="bg-background hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6 italic">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    {testimonial.avatar_url ? (
                      <img 
                        src={testimonial.avatar_url} 
                        alt={testimonial.customer_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
                        {testimonial.customer_name[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{testimonial.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.customer_role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {settings?.pricing_title}{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {settings?.pricing_title_highlight}
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              {settings?.pricing_subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricing?.map((plan, index) => (
              <Card 
                key={plan.id || index} 
                className={`relative hover:shadow-lg transition-all hover:-translate-y-1 ${
                  plan.is_popular 
                    ? "border-primary shadow-lg shadow-primary/20" 
                    : "border-border bg-gradient-to-br from-background to-muted/30"
                }`}
              >
                {plan.badge_text && (
                  <div 
                    className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-sm font-medium rounded-full ${
                      plan.badge_color === "green" 
                        ? "bg-green-500 text-white" 
                        : "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                    }`}
                  >
                    {plan.badge_text}
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold mb-2">{plan.plan_name}</h3>
                  <p className="text-muted-foreground mb-6">{plan.plan_subtitle}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.price_period}</span>
                  </div>
                  {plan.price_note && (
                    <p className="text-sm text-muted-foreground mb-4">{plan.price_note}</p>
                  )}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={plan.button_link}>
                    <Button 
                      className={`w-full ${
                        plan.is_popular 
                          ? "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" 
                          : ""
                      }`}
                      variant={plan.is_popular ? "default" : "outline"}
                    >
                      {plan.button_text}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {settings?.faq_title}{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {settings?.faq_title_highlight}
              </span>
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs?.map((faq, index) => (
              <AccordionItem
                key={faq.id || index}
                value={`item-${index}`}
                className="border rounded-xl px-6 bg-background hover:border-primary/50 transition-colors"
              >
                <AccordionTrigger className="text-left hover:no-underline py-5">
                  <span className="font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        
        <div className="container mx-auto relative z-10">
          <div className="max-w-3xl mx-auto text-center text-primary-foreground">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {settings?.cta_title}
            </h2>
            <p className="text-xl mb-8 opacity-90">
              {settings?.cta_subtitle}
            </p>
            <Link to="/auth">
              <Button
                size="lg"
                className="text-lg px-10 bg-background text-primary hover:bg-background/90 shadow-xl"
              >
                {settings?.cta_button_text}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-6 mt-8 text-sm opacity-80 flex-wrap">
              {settings?.cta_features?.map((feature: string, index: number) => (
                <span key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="Venda PROFIT" className="w-8 h-8 rounded-lg" />
              <span className="font-bold">Venda PROFIT</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {settings?.footer_copyright}
            </p>
          </div>
        </div>
      </footer>

      {/* Video Sales Bubble - Lazy loaded */}
      <Suspense fallback={null}>
        <VideoSalesBubble 
          previewUrl={settings?.bio_video_preview} 
          fullUrl={settings?.bio_video_full} 
        />
      </Suspense>
    </div>
  );
};

export default LandingPage;
