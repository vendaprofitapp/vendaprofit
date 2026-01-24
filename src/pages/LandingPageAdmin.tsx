import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Settings, 
  Video, 
  Star, 
  CreditCard, 
  HelpCircle, 
  Megaphone, 
  Plus, 
  Pencil, 
  Trash2,
  Save,
  Eye,
  Package,
  Mic,
  Shirt,
  BarChart3,
  Users,
  Store,
  Zap,
  Shield,
  Smartphone,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  useLandingPageSettings,
  useLandingPageFeatures,
  useLandingPageTestimonials,
  useLandingPagePricing,
  useLandingPageFAQs,
  useUpdateLandingPageSettings,
  useManageLandingPageFeature,
  useManageLandingPageTestimonial,
  useManageLandingPagePricing,
  useManageLandingPageFAQ,
  LandingPageFeature,
  LandingPageTestimonial,
  LandingPagePricing,
  LandingPageFAQ,
} from "@/hooks/useLandingPageCMS";
import { Link } from "react-router-dom";

const iconOptions = [
  { value: "Package", label: "Pacote", icon: Package },
  { value: "Mic", label: "Microfone", icon: Mic },
  { value: "Shirt", label: "Roupa", icon: Shirt },
  { value: "BarChart3", label: "Gráfico", icon: BarChart3 },
  { value: "Users", label: "Usuários", icon: Users },
  { value: "Store", label: "Loja", icon: Store },
  { value: "Zap", label: "Raio", icon: Zap },
  { value: "Shield", label: "Escudo", icon: Shield },
  { value: "Smartphone", label: "Celular", icon: Smartphone },
  { value: "Star", label: "Estrela", icon: Star },
];

export default function LandingPageAdmin() {
  const { data: settings, isLoading: settingsLoading } = useLandingPageSettings();
  const { data: allFeatures } = useLandingPageFeatures();
  const { data: testimonials } = useLandingPageTestimonials();
  const { data: pricing } = useLandingPagePricing();
  const { data: faqs } = useLandingPageFAQs();

  const updateSettings = useUpdateLandingPageSettings();
  const manageFeature = useManageLandingPageFeature();
  const manageTestimonial = useManageLandingPageTestimonial();
  const managePricing = useManageLandingPagePricing();
  const manageFAQ = useManageLandingPageFAQ();

  // Form states
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [featureDialog, setFeatureDialog] = useState<{ open: boolean; feature?: LandingPageFeature; type: "features" | "benefits" }>({ open: false, type: "features" });
  const [testimonialDialog, setTestimonialDialog] = useState<{ open: boolean; testimonial?: LandingPageTestimonial }>({ open: false });
  const [pricingDialog, setPricingDialog] = useState<{ open: boolean; pricing?: LandingPagePricing }>({ open: false });
  const [faqDialog, setFaqDialog] = useState<{ open: boolean; faq?: LandingPageFAQ }>({ open: false });

  const handleSettingsChange = (field: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = () => {
    updateSettings.mutate(localSettings);
  };

  const features = allFeatures?.filter(f => f.section_type === "features") || [];
  const benefits = allFeatures?.filter(f => f.section_type === "benefits") || [];

  if (settingsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Editor da Landing Page</h1>
            <p className="text-muted-foreground">Personalize todos os elementos da sua página de vendas</p>
          </div>
          <div className="flex gap-2">
            <Link to="/landing" target="_blank">
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                Visualizar
              </Button>
            </Link>
            <Button onClick={saveSettings} disabled={updateSettings.isPending}>
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </div>
        </div>

        <Tabs defaultValue="hero" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="hero" className="gap-2">
              <Megaphone className="w-4 h-4" />
              Hero
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-2">
              <Video className="w-4 h-4" />
              Vídeo
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <Package className="w-4 h-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="testimonials" className="gap-2">
              <Star className="w-4 h-4" />
              Depoimentos
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Preços
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-2">
              <HelpCircle className="w-4 h-4" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="cta" className="gap-2">
              <Settings className="w-4 h-4" />
              CTA & Rodapé
            </TabsTrigger>
          </TabsList>

          {/* Hero Tab */}
          <TabsContent value="hero">
            <Card>
              <CardHeader>
                <CardTitle>Seção Hero</CardTitle>
                <CardDescription>Primeira impressão da sua landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Badge (texto do selo)</Label>
                    <Input 
                      defaultValue={settings?.hero_badge_text}
                      onChange={(e) => handleSettingsChange("hero_badge_text", e.target.value)}
                      placeholder="Sistema completo de gestão..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Título Principal</Label>
                    <Input 
                      defaultValue={settings?.hero_title}
                      onChange={(e) => handleSettingsChange("hero_title", e.target.value)}
                      placeholder="Transforme suas vendas..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Título Destacado (gradiente)</Label>
                  <Input 
                    defaultValue={settings?.hero_title_highlight}
                    onChange={(e) => handleSettingsChange("hero_title_highlight", e.target.value)}
                    placeholder="controle total na palma da mão..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Textarea 
                    defaultValue={settings?.hero_subtitle}
                    onChange={(e) => handleSettingsChange("hero_subtitle", e.target.value)}
                    placeholder="Controle estoque, venda por voz..."
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Botão Principal (CTA)</Label>
                    <Input 
                      defaultValue={settings?.hero_cta_primary_text}
                      onChange={(e) => handleSettingsChange("hero_cta_primary_text", e.target.value)}
                      placeholder="Começar Grátis por 14 dias"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Botão Secundário</Label>
                    <Input 
                      defaultValue={settings?.hero_cta_secondary_text}
                      onChange={(e) => handleSettingsChange("hero_cta_secondary_text", e.target.value)}
                      placeholder="Ver Demonstração"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Texto de Rodapé do Hero</Label>
                  <Input 
                    defaultValue={settings?.hero_footer_text}
                    onChange={(e) => handleSettingsChange("hero_footer_text", e.target.value)}
                    placeholder="✓ Sem cartão de crédito..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Video Tab */}
          <TabsContent value="video">
            <Card>
              <CardHeader>
                <CardTitle>Seção de Vídeo</CardTitle>
                <CardDescription>Demonstração do sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Badge</Label>
                    <Input 
                      defaultValue={settings?.video_badge_text}
                      onChange={(e) => handleSettingsChange("video_badge_text", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input 
                      defaultValue={settings?.video_title}
                      onChange={(e) => handleSettingsChange("video_title", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Título Destacado</Label>
                  <Input 
                    defaultValue={settings?.video_title_highlight}
                    onChange={(e) => handleSettingsChange("video_title_highlight", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Input 
                    defaultValue={settings?.video_subtitle}
                    onChange={(e) => handleSettingsChange("video_subtitle", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL do Vídeo (YouTube Embed)</Label>
                  <Input 
                    defaultValue={settings?.video_url}
                    onChange={(e) => handleSettingsChange("video_url", e.target.value)}
                    placeholder="https://www.youtube.com/embed/VIDEO_ID"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use o formato embed: https://www.youtube.com/embed/ID_DO_VIDEO
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Texto de Rodapé</Label>
                  <Input 
                    defaultValue={settings?.video_footer_text}
                    onChange={(e) => handleSettingsChange("video_footer_text", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features">
            <div className="space-y-6">
              {/* Section Titles */}
              <Card>
                <CardHeader>
                  <CardTitle>Títulos da Seção</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input 
                        defaultValue={settings?.features_title}
                        onChange={(e) => handleSettingsChange("features_title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Título Destacado</Label>
                      <Input 
                        defaultValue={settings?.features_title_highlight}
                        onChange={(e) => handleSettingsChange("features_title_highlight", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Input 
                      defaultValue={settings?.features_subtitle}
                      onChange={(e) => handleSettingsChange("features_subtitle", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Benefits Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Benefícios (3 cards superiores)</CardTitle>
                    <CardDescription>Cards de destaque no topo</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setFeatureDialog({ open: true, type: "benefits" })}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {benefits.map((benefit) => {
                      const IconComponent = iconOptions.find(i => i.value === benefit.icon_name)?.icon || Zap;
                      return (
                        <div key={benefit.id} className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <IconComponent className="w-5 h-5 text-primary" />
                              <span className="font-medium">{benefit.title}</span>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setFeatureDialog({ open: true, feature: benefit, type: "benefits" })}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => manageFeature.mutate({ action: "delete", feature: benefit })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{benefit.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Feature Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Funcionalidades (6 cards principais)</CardTitle>
                    <CardDescription>Cards de features do sistema</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setFeatureDialog({ open: true, type: "features" })}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => {
                      const IconComponent = iconOptions.find(i => i.value === feature.icon_name)?.icon || Package;
                      return (
                        <div key={feature.id} className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <IconComponent className="w-5 h-5 text-primary" />
                              <span className="font-medium">{feature.title}</span>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setFeatureDialog({ open: true, feature, type: "features" })}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => manageFeature.mutate({ action: "delete", feature })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Testimonials Tab */}
          <TabsContent value="testimonials">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Títulos da Seção</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input 
                        defaultValue={settings?.testimonials_title}
                        onChange={(e) => handleSettingsChange("testimonials_title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Título Destacado</Label>
                      <Input 
                        defaultValue={settings?.testimonials_title_highlight}
                        onChange={(e) => handleSettingsChange("testimonials_title_highlight", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Input 
                      defaultValue={settings?.testimonials_subtitle}
                      onChange={(e) => handleSettingsChange("testimonials_subtitle", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Depoimentos</CardTitle>
                    <CardDescription>Avaliações dos clientes</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setTestimonialDialog({ open: true })}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {testimonials?.map((testimonial) => (
                      <div key={testimonial.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                              {testimonial.customer_name[0]}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{testimonial.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{testimonial.customer_role}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setTestimonialDialog({ open: true, testimonial })}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => manageTestimonial.mutate({ action: "delete", testimonial })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: testimonial.rating }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground italic">"{testimonial.content}"</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Títulos da Seção</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input 
                        defaultValue={settings?.pricing_title}
                        onChange={(e) => handleSettingsChange("pricing_title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Título Destacado</Label>
                      <Input 
                        defaultValue={settings?.pricing_title_highlight}
                        onChange={(e) => handleSettingsChange("pricing_title_highlight", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Input 
                      defaultValue={settings?.pricing_subtitle}
                      onChange={(e) => handleSettingsChange("pricing_subtitle", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Planos de Preço</CardTitle>
                    <CardDescription>Cards de pricing</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setPricingDialog({ open: true })}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Plano
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {pricing?.map((plan) => (
                      <div key={plan.id} className={`p-4 border rounded-lg space-y-3 ${plan.is_popular ? "border-primary" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{plan.plan_name}</span>
                            {plan.is_popular && <Badge>Popular</Badge>}
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setPricingDialog({ open: true, pricing: plan })}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => managePricing.mutate({ action: "delete", pricing: plan })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{plan.plan_subtitle}</p>
                        <p className="text-2xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.price_period}</span></p>
                        <ul className="text-sm space-y-1">
                          {plan.features.map((f: string, i: number) => (
                            <li key={i} className="flex items-center gap-1">
                              <span className="text-primary">✓</span> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Títulos da Seção</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input 
                        defaultValue={settings?.faq_title}
                        onChange={(e) => handleSettingsChange("faq_title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Título Destacado</Label>
                      <Input 
                        defaultValue={settings?.faq_title_highlight}
                        onChange={(e) => handleSettingsChange("faq_title_highlight", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Perguntas Frequentes</CardTitle>
                    <CardDescription>FAQ Accordion</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setFaqDialog({ open: true })}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar FAQ
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {faqs?.map((faq) => (
                      <div key={faq.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <p className="font-medium">{faq.question}</p>
                            <p className="text-sm text-muted-foreground">{faq.answer}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setFaqDialog({ open: true, faq })}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => manageFAQ.mutate({ action: "delete", faq })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CTA Tab */}
          <TabsContent value="cta">
            <Card>
              <CardHeader>
                <CardTitle>Seção CTA Final</CardTitle>
                <CardDescription>Call to action e rodapé</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Título do CTA</Label>
                  <Input 
                    defaultValue={settings?.cta_title}
                    onChange={(e) => handleSettingsChange("cta_title", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo do CTA</Label>
                  <Textarea 
                    defaultValue={settings?.cta_subtitle}
                    onChange={(e) => handleSettingsChange("cta_subtitle", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Texto do Botão</Label>
                  <Input 
                    defaultValue={settings?.cta_button_text}
                    onChange={(e) => handleSettingsChange("cta_button_text", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Features do CTA (separadas por vírgula)</Label>
                  <Input 
                    defaultValue={settings?.cta_features?.join(", ")}
                    onChange={(e) => handleSettingsChange("cta_features", JSON.stringify(e.target.value.split(",").map(s => s.trim())))}
                    placeholder="14 dias grátis, Sem cartão de crédito, Suporte incluso"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Copyright do Rodapé</Label>
                  <Input 
                    defaultValue={settings?.footer_copyright}
                    onChange={(e) => handleSettingsChange("footer_copyright", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Feature Dialog */}
      <FeatureDialog 
        dialog={featureDialog} 
        onClose={() => setFeatureDialog({ open: false, type: "features" })}
        onSave={(feature) => {
          if (featureDialog.feature) {
            manageFeature.mutate({ action: "update", feature: { ...feature, id: featureDialog.feature.id } });
          } else {
            manageFeature.mutate({ action: "create", feature: { ...feature, section_type: featureDialog.type } });
          }
          setFeatureDialog({ open: false, type: "features" });
        }}
      />

      {/* Testimonial Dialog */}
      <TestimonialDialog 
        dialog={testimonialDialog}
        onClose={() => setTestimonialDialog({ open: false })}
        onSave={(testimonial) => {
          if (testimonialDialog.testimonial) {
            manageTestimonial.mutate({ action: "update", testimonial: { ...testimonial, id: testimonialDialog.testimonial.id } });
          } else {
            manageTestimonial.mutate({ action: "create", testimonial });
          }
          setTestimonialDialog({ open: false });
        }}
      />

      {/* Pricing Dialog */}
      <PricingDialog 
        dialog={pricingDialog}
        onClose={() => setPricingDialog({ open: false })}
        onSave={(pricing) => {
          if (pricingDialog.pricing) {
            managePricing.mutate({ action: "update", pricing: { ...pricing, id: pricingDialog.pricing.id } });
          } else {
            managePricing.mutate({ action: "create", pricing });
          }
          setPricingDialog({ open: false });
        }}
      />

      {/* FAQ Dialog */}
      <FAQDialog 
        dialog={faqDialog}
        onClose={() => setFaqDialog({ open: false })}
        onSave={(faq) => {
          if (faqDialog.faq) {
            manageFAQ.mutate({ action: "update", faq: { ...faq, id: faqDialog.faq.id } });
          } else {
            manageFAQ.mutate({ action: "create", faq });
          }
          setFaqDialog({ open: false });
        }}
      />
    </MainLayout>
  );
}

// Sub-components for dialogs
function FeatureDialog({ 
  dialog, 
  onClose, 
  onSave 
}: { 
  dialog: { open: boolean; feature?: LandingPageFeature; type: "features" | "benefits" };
  onClose: () => void;
  onSave: (feature: Partial<LandingPageFeature>) => void;
}) {
  const [form, setForm] = useState({
    icon_name: dialog.feature?.icon_name || "Package",
    title: dialog.feature?.title || "",
    description: dialog.feature?.description || "",
  });

  // Reset form when dialog opens with new data
  useState(() => {
    if (dialog.open) {
      setForm({
        icon_name: dialog.feature?.icon_name || "Package",
        title: dialog.feature?.title || "",
        description: dialog.feature?.description || "",
      });
    }
  });

  return (
    <Dialog open={dialog.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog.feature ? "Editar" : "Adicionar"} {dialog.type === "features" ? "Feature" : "Benefício"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ícone</Label>
            <Select value={form.icon_name} onValueChange={(v) => setForm(f => ({ ...f, icon_name: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {iconOptions.map((icon) => (
                  <SelectItem key={icon.value} value={icon.value}>
                    <div className="flex items-center gap-2">
                      <icon.icon className="w-4 h-4" />
                      {icon.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input 
              value={form.title} 
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} 
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea 
              value={form.description} 
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(form)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestimonialDialog({ 
  dialog, 
  onClose, 
  onSave 
}: { 
  dialog: { open: boolean; testimonial?: LandingPageTestimonial };
  onClose: () => void;
  onSave: (testimonial: Partial<LandingPageTestimonial>) => void;
}) {
  const [form, setForm] = useState({
    customer_name: dialog.testimonial?.customer_name || "",
    customer_role: dialog.testimonial?.customer_role || "",
    content: dialog.testimonial?.content || "",
    rating: dialog.testimonial?.rating || 5,
  });

  return (
    <Dialog open={dialog.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog.testimonial ? "Editar" : "Adicionar"} Depoimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input 
                value={form.customer_name} 
                onChange={(e) => setForm(f => ({ ...f, customer_name: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo/Empresa</Label>
              <Input 
                value={form.customer_role} 
                onChange={(e) => setForm(f => ({ ...f, customer_role: e.target.value }))} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Depoimento</Label>
            <Textarea 
              value={form.content} 
              onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} 
            />
          </div>
          <div className="space-y-2">
            <Label>Avaliação (1-5)</Label>
            <Select value={String(form.rating)} onValueChange={(v) => setForm(f => ({ ...f, rating: Number(v) }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} estrelas</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(form)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PricingDialog({ 
  dialog, 
  onClose, 
  onSave 
}: { 
  dialog: { open: boolean; pricing?: LandingPagePricing };
  onClose: () => void;
  onSave: (pricing: Partial<LandingPagePricing>) => void;
}) {
  const [form, setForm] = useState({
    plan_name: dialog.pricing?.plan_name || "",
    plan_subtitle: dialog.pricing?.plan_subtitle || "",
    price: dialog.pricing?.price || "",
    price_period: dialog.pricing?.price_period || "/mês",
    price_note: dialog.pricing?.price_note || "",
    features: dialog.pricing?.features?.join("\n") || "",
    button_text: dialog.pricing?.button_text || "Assinar",
    button_link: dialog.pricing?.button_link || "/auth",
    is_popular: dialog.pricing?.is_popular || false,
    badge_text: dialog.pricing?.badge_text || "",
    badge_color: dialog.pricing?.badge_color || "primary",
  });

  return (
    <Dialog open={dialog.open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialog.pricing ? "Editar" : "Adicionar"} Plano</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Plano</Label>
              <Input 
                value={form.plan_name} 
                onChange={(e) => setForm(f => ({ ...f, plan_name: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input 
                value={form.plan_subtitle} 
                onChange={(e) => setForm(f => ({ ...f, plan_subtitle: e.target.value }))} 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço (ex: R$197)</Label>
              <Input 
                value={form.price} 
                onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Período (ex: /mês)</Label>
              <Input 
                value={form.price_period} 
                onChange={(e) => setForm(f => ({ ...f, price_period: e.target.value }))} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nota de Preço (opcional)</Label>
            <Input 
              value={form.price_note} 
              onChange={(e) => setForm(f => ({ ...f, price_note: e.target.value }))} 
              placeholder="Cobrado anualmente (R$1.164/ano)"
            />
          </div>
          <div className="space-y-2">
            <Label>Features (uma por linha)</Label>
            <Textarea 
              value={form.features} 
              onChange={(e) => setForm(f => ({ ...f, features: e.target.value }))} 
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input 
                value={form.button_text} 
                onChange={(e) => setForm(f => ({ ...f, button_text: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Link do Botão</Label>
              <Input 
                value={form.button_link} 
                onChange={(e) => setForm(f => ({ ...f, button_link: e.target.value }))} 
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch 
                checked={form.is_popular} 
                onCheckedChange={(c) => setForm(f => ({ ...f, is_popular: c }))} 
              />
              <Label>Plano Popular (destaque)</Label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Badge Text (opcional)</Label>
              <Input 
                value={form.badge_text} 
                onChange={(e) => setForm(f => ({ ...f, badge_text: e.target.value }))} 
                placeholder="Mais Popular"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor do Badge</Label>
              <Select value={form.badge_color} onValueChange={(v) => setForm(f => ({ ...f, badge_color: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primária</SelectItem>
                  <SelectItem value="green">Verde</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({
            ...form,
            features: form.features.split("\n").filter(Boolean),
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FAQDialog({ 
  dialog, 
  onClose, 
  onSave 
}: { 
  dialog: { open: boolean; faq?: LandingPageFAQ };
  onClose: () => void;
  onSave: (faq: Partial<LandingPageFAQ>) => void;
}) {
  const [form, setForm] = useState({
    question: dialog.faq?.question || "",
    answer: dialog.faq?.answer || "",
  });

  return (
    <Dialog open={dialog.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog.faq ? "Editar" : "Adicionar"} FAQ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pergunta</Label>
            <Input 
              value={form.question} 
              onChange={(e) => setForm(f => ({ ...f, question: e.target.value }))} 
            />
          </div>
          <div className="space-y-2">
            <Label>Resposta</Label>
            <Textarea 
              value={form.answer} 
              onChange={(e) => setForm(f => ({ ...f, answer: e.target.value }))} 
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(form)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
