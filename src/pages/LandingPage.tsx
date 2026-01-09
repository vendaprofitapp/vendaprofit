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
  ShoppingCart,
  Star,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Smartphone,
  Play,
} from "lucide-react";
import { Link } from "react-router-dom";

const LandingPage = () => {
  const features = [
    {
      icon: Package,
      title: "Controle de Estoque",
      description: "Gerencie seu estoque em tempo real com alertas de baixo estoque e importação via nota fiscal.",
    },
    {
      icon: Mic,
      title: "Vendas por Voz",
      description: "Registre vendas apenas falando. Nossa IA transcreve e processa automaticamente.",
    },
    {
      icon: Shirt,
      title: "Provador Virtual IA",
      description: "Seus clientes podem experimentar roupas virtualmente antes de comprar.",
    },
    {
      icon: BarChart3,
      title: "Relatórios Inteligentes",
      description: "Dashboard completo com métricas de vendas, produtos mais vendidos e análises.",
    },
    {
      icon: Users,
      title: "Gestão de Clientes",
      description: "Cadastro completo de clientes com histórico de compras e preferências.",
    },
    {
      icon: ShoppingCart,
      title: "Loja Virtual",
      description: "Catálogo online personalizado para seus clientes comprarem pelo WhatsApp.",
    },
  ];

  const benefits = [
    {
      icon: Zap,
      title: "Aumente suas Vendas",
      description: "Otimize processos e venda mais com menos esforço",
    },
    {
      icon: Shield,
      title: "Dados Seguros",
      description: "Seus dados protegidos com criptografia de ponta",
    },
    {
      icon: Smartphone,
      title: "Acesse de Qualquer Lugar",
      description: "Sistema 100% online, funciona em qualquer dispositivo",
    },
  ];

  const testimonials = [
    {
      name: "Maria Silva",
      role: "Loja de Roupas Femininas",
      content: "O Venda PROFIT revolucionou minha loja! As vendas por voz economizam muito tempo.",
      rating: 5,
    },
    {
      name: "João Santos",
      role: "Boutique Masculina",
      content: "O provador virtual IA aumentou minhas vendas online em 40%. Incrível!",
      rating: 5,
    },
    {
      name: "Ana Oliveira",
      role: "Multi Marcas",
      content: "Finalmente um sistema completo e fácil de usar. Recomendo demais!",
      rating: 5,
    },
  ];

  const faqs = [
    {
      question: "Como funciona o período de teste?",
      answer: "Você pode testar o Venda PROFIT gratuitamente por 14 dias, sem precisar de cartão de crédito. Após o período, escolha o plano ideal para você.",
    },
    {
      question: "Preciso instalar algo no computador?",
      answer: "Não! O Venda PROFIT é 100% online. Basta acessar pelo navegador do seu computador, tablet ou celular.",
    },
    {
      question: "Como funciona o provador virtual com IA?",
      answer: "Seus clientes enviam uma foto e selecionam a roupa. Nossa IA gera uma imagem realista de como a peça ficaria no cliente.",
    },
    {
      question: "Posso importar meus produtos de outro sistema?",
      answer: "Sim! Você pode importar produtos via planilha Excel ou diretamente pela nota fiscal XML.",
    },
    {
      question: "O sistema funciona offline?",
      answer: "O Venda PROFIT requer conexão com a internet para funcionar, garantindo que seus dados estejam sempre sincronizados e seguros na nuvem.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
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
              <span className="text-sm font-medium">Sistema completo de gestão para lojas</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in">
              Transforme sua loja com{" "}
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                Inteligência Artificial
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in">
              Controle estoque, venda por voz, ofereça provador virtual e muito mais. 
              Tudo em um único sistema feito para aumentar suas vendas.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25">
                  Começar Grátis por 14 dias
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Ver Demonstração
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              ✓ Sem cartão de crédito &nbsp;&nbsp; ✓ Cancele quando quiser
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
                <span className="text-sm font-medium">Veja o sistema em ação</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Conheça o{" "}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Venda PROFIT por dentro
                </span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Assista e descubra como o sistema pode revolucionar sua loja
              </p>
            </div>

            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-border bg-background">
              <div className="aspect-video">
                {/* Substitua VIDEO_ID pelo ID do seu vídeo do YouTube */}
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/VIDEO_ID"
                  title="Demonstração Venda PROFIT"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-4">
              🎬 Tour completo pelo sistema em menos de 5 minutos
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa em{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                um só lugar
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Funcionalidades pensadas para simplificar sua rotina e potencializar seus resultados
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1 bg-gradient-to-br from-background to-muted/20"
              >
                <CardContent className="p-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 group-hover:from-primary group-hover:to-primary/60 transition-all">
                    <feature.icon className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O que nossos{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                clientes dizem
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Histórias reais de vendedoras fitness que transformaram seus negócios
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-background hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6 italic">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
                      {testimonial.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
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
              Planos que cabem no seu{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                bolso
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Escolha o plano ideal para o seu negócio
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Teste Grátis */}
            <Card className="relative hover:shadow-lg transition-all hover:-translate-y-1 border-border">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-2">Teste Grátis</h3>
                <p className="text-muted-foreground mb-6">Experimente sem compromisso</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">R$0</span>
                  <span className="text-muted-foreground">/14 dias</span>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Acesso completo ao sistema</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Todas as funcionalidades</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Suporte por WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Sem cartão de crédito</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button variant="outline" className="w-full">
                    Começar Grátis
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Mensal */}
            <Card className="relative hover:shadow-xl transition-all hover:-translate-y-1 border-primary shadow-lg shadow-primary/20">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-medium rounded-full">
                Mais Popular
              </div>
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-2">Mensal</h3>
                <p className="text-muted-foreground mb-6">Flexibilidade total</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">R$197</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Tudo do plano gratuito</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Produtos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Provador Virtual IA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Suporte prioritário</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                    Assinar Agora
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Anual */}
            <Card className="relative hover:shadow-lg transition-all hover:-translate-y-1 border-border bg-gradient-to-br from-background to-muted/30">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-500 text-white text-sm font-medium rounded-full">
                Economia de 51%
              </div>
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-2">Anual</h3>
                <p className="text-muted-foreground mb-6">Melhor custo-benefício</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">R$97</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Cobrado anualmente (R$1.164/ano)
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Tudo do plano mensal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Economia de R$1.200/ano</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Treinamento exclusivo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Consultoria inicial</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    Assinar Anual
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Perguntas{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Frequentes
              </span>
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
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
              Pronto para transformar sua loja?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Junte-se a centenas de vendedoras fitness que já estão vendendo mais com o Venda PROFIT
            </p>
            <Link to="/auth">
              <Button
                size="lg"
                className="text-lg px-10 bg-background text-primary hover:bg-background/90 shadow-xl"
              >
                Começar Agora — É Grátis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-6 mt-8 text-sm opacity-80">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                14 dias grátis
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Sem cartão de crédito
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Suporte incluso
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">Venda PROFIT</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Venda PROFIT. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
