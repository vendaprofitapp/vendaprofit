import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Warehouse, 
  ShoppingCart, 
  Users, 
  Briefcase, 
  Gift, 
  TrendingUp, 
  Store, 
  Settings, 
  Truck,
  Tag,
  ClipboardList,
  Clock,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";

interface TutorialSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  steps: {
    title: string;
    content: string;
  }[];
  tips?: string[];
  warnings?: string[];
}

const tutorialSections: TutorialSection[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Painel (Dashboard)",
    description: "Visão geral do seu negócio com métricas e indicadores em tempo real.",
    steps: [
      {
        title: "Entendendo as métricas",
        content: "O painel exibe suas vendas do dia, semana e mês, além de alertas de estoque baixo e produtos mais vendidos. Use essas informações para tomar decisões estratégicas."
      },
      {
        title: "Alertas do sistema",
        content: "Fique atento aos alertas de estoque baixo e pagamentos pendentes. Eles aparecem em destaque para que você não perca nenhuma ação importante."
      },
      {
        title: "Gráficos de desempenho",
        content: "Analise a evolução das suas vendas através dos gráficos. Compare períodos e identifique tendências do seu negócio."
      }
    ],
    tips: [
      "Acesse o painel diariamente para acompanhar o desempenho",
      "Configure alertas de estoque mínimo para cada produto"
    ]
  },
  {
    id: "stock",
    icon: Warehouse,
    title: "Controle de Estoque",
    description: "Gerencie todos os seus produtos, variantes, preços e quantidades.",
    steps: [
      {
        title: "Cadastrar um produto",
        content: "Clique em 'Novo Produto', preencha nome, categoria, preço de custo e venda. Adicione fotos para facilitar a identificação. Você pode usar o comando de voz para agilizar!"
      },
      {
        title: "Criar variantes (tamanhos/cores)",
        content: "Após criar o produto, adicione variantes clicando em 'Variantes'. Cada variante pode ter seu próprio estoque, cor e tamanho."
      },
      {
        title: "Importar produtos em lote",
        content: "Use a função de importação para cadastrar vários produtos de uma vez. Baixe o modelo Excel, preencha e faça upload."
      },
      {
        title: "Ajustar estoque",
        content: "Clique no produto e ajuste a quantidade. O sistema mantém histórico de todas as movimentações."
      }
    ],
    tips: [
      "Use o SKU para identificar produtos rapidamente",
      "Mantenha fotos atualizadas para facilitar vendas",
      "Configure estoque mínimo para receber alertas"
    ],
    warnings: [
      "Produtos com estoque zerado não aparecem no catálogo público"
    ]
  },
  {
    id: "suppliers",
    icon: Truck,
    title: "Fornecedores",
    description: "Cadastre e gerencie seus fornecedores para organizar compras.",
    steps: [
      {
        title: "Cadastrar fornecedor",
        content: "Adicione nome, CNPJ, contato e endereço. Você pode vincular produtos a fornecedores para saber de onde vem cada item."
      },
      {
        title: "Regras de compra",
        content: "Registre informações como valor mínimo de pedido, prazo de entrega e condições especiais no campo de observações."
      }
    ],
    tips: [
      "Mantenha contatos atualizados para facilitar reposições",
      "Anote condições especiais de cada fornecedor"
    ]
  },
  {
    id: "categories",
    icon: Tag,
    title: "Categorias",
    description: "Organize seus produtos em categorias para facilitar buscas e filtros.",
    steps: [
      {
        title: "Criar categorias",
        content: "Crie categorias que façam sentido para seu negócio: Vestidos, Blusas, Calças, Acessórios, etc."
      },
      {
        title: "Mesclar categorias",
        content: "Se tiver categorias duplicadas, use a função mesclar para unificar todos os produtos em uma só."
      }
    ],
    tips: [
      "Use nomes claros e objetivos",
      "Cada produto pode ter até 3 categorias"
    ]
  },
  {
    id: "orders",
    icon: ClipboardList,
    title: "Encomendas",
    description: "Gerencie pedidos de produtos sob demanda.",
    steps: [
      {
        title: "Registrar encomenda",
        content: "Quando um cliente pedir um produto que você não tem em estoque, registre a encomenda com nome do cliente, produto desejado e fornecedor."
      },
      {
        title: "Lista de compras",
        content: "Todas as encomendas pendentes são agrupadas em uma lista de compras organizada por fornecedor, facilitando suas compras."
      },
      {
        title: "Atualizar status",
        content: "Marque como 'Pedido ao Fornecedor', 'Chegou' ou 'Entregue' conforme o andamento."
      }
    ],
    tips: [
      "Use a lista de compras para otimizar pedidos aos fornecedores",
      "Mantenha o cliente informado sobre o status"
    ]
  },
  {
    id: "sales",
    icon: ShoppingCart,
    title: "Vendas",
    description: "Registre vendas, aplique descontos e controle formas de pagamento.",
    steps: [
      {
        title: "Registrar venda manual",
        content: "Selecione os produtos, quantidade, forma de pagamento e cliente (opcional). Aplique descontos se necessário."
      },
      {
        title: "Venda por voz",
        content: "Use o botão de microfone para ditar a venda: 'Vendi vestido azul tamanho M por 150 reais no pix'. O sistema entende e registra automaticamente!"
      },
      {
        title: "Formas de pagamento",
        content: "Configure taxas para cada forma de pagamento (cartão, pix, etc.) para calcular o lucro líquido automaticamente."
      }
    ],
    tips: [
      "A venda por voz agiliza muito o processo",
      "Configure as taxas de cartão nas configurações",
      "Vincule vendas a clientes para histórico"
    ]
  },
  {
    id: "customers",
    icon: UserCheck,
    title: "Clientes",
    description: "Cadastre clientes para histórico de compras e relacionamento.",
    steps: [
      {
        title: "Cadastrar cliente",
        content: "Adicione nome, telefone, Instagram, data de nascimento e tamanho preferido. Essas informações ajudam a personalizar o atendimento."
      },
      {
        title: "Histórico de compras",
        content: "Ao vincular vendas aos clientes, você terá o histórico completo de compras de cada um."
      }
    ],
    tips: [
      "Salve o tamanho do cliente para montar malinhas personalizadas",
      "Use a data de nascimento para ações de marketing"
    ]
  },
  {
    id: "consignments",
    icon: Briefcase,
    title: "Bolsa Consignada",
    description: "Envie produtos para clientes experimentarem em casa.",
    steps: [
      {
        title: "Criar malinha",
        content: "Selecione o cliente e adicione os produtos que ele levará para experimentar. O sistema reserva esses itens do estoque."
      },
      {
        title: "Link público",
        content: "Cada malinha gera um link único que você pode enviar ao cliente. Por ele, o cliente pode marcar o que vai ficar e devolver."
      },
      {
        title: "Finalizar malinha",
        content: "Quando o cliente devolver, registre o que foi vendido e devolvido. O estoque é atualizado automaticamente."
      },
      {
        title: "Troca inteligente",
        content: "Se o cliente quiser trocar por outro tamanho, use a função de troca que busca alternativas no seu estoque e de parceiros."
      }
    ],
    tips: [
      "Defina um prazo para devolução",
      "Acompanhe malinhas ativas pelo painel"
    ],
    warnings: [
      "Produtos em malinha ficam reservados e não disponíveis para outras vendas"
    ]
  },
  {
    id: "consortiums",
    icon: Gift,
    title: "Consórcios",
    description: "Gerencie grupos de consórcio com parcelas e sorteios.",
    steps: [
      {
        title: "Criar consórcio",
        content: "Defina nome, valor total, quantidade de parcelas, data de início e fim."
      },
      {
        title: "Adicionar participantes",
        content: "Cadastre os participantes com nome, telefone, forma de pagamento preferida e dia de vencimento."
      },
      {
        title: "Registrar pagamentos",
        content: "Marque as parcelas como pagas conforme os participantes forem pagando."
      },
      {
        title: "Realizar sorteios",
        content: "Use a função de sorteio para selecionar ganhadores. O sistema registra quem já foi contemplado."
      },
      {
        title: "Registrar itens ganhos",
        content: "Após o sorteio, registre os produtos que o ganhador escolheu com seu saldo."
      }
    ],
    tips: [
      "Configure penalidades para desistência nas configurações",
      "Acompanhe inadimplentes pelo painel de pagamentos"
    ]
  },
  {
    id: "stock-requests",
    icon: Clock,
    title: "Solicitações de Estoque",
    description: "Gerencie pedidos de estoque de parceiros.",
    steps: [
      {
        title: "Receber solicitações",
        content: "Quando um parceiro vê um produto seu e quer vender, ele pode solicitar. Você recebe a notificação aqui."
      },
      {
        title: "Aprovar/Rejeitar",
        content: "Analise a solicitação e aprove (o estoque é descontado) ou rejeite com justificativa."
      }
    ],
    tips: [
      "Responda rapidamente para não perder vendas",
      "Configure compartilhamento automático nas parcerias"
    ]
  },
  {
    id: "partnerships",
    icon: Users,
    title: "Parcerias",
    description: "Compartilhe produtos com outros vendedores e divida lucros.",
    steps: [
      {
        title: "Criar parceria direta",
        content: "Convide um parceiro pelo email. Defina a divisão de custos e lucros entre vocês."
      },
      {
        title: "Compartilhar produtos",
        content: "Ative o compartilhamento automático ou selecione produtos específicos para disponibilizar ao parceiro."
      },
      {
        title: "Acompanhar vendas",
        content: "Visualize vendas realizadas por parceiros nos relatórios de parcerias."
      }
    ],
    tips: [
      "Defina regras claras de divisão antes de começar",
      "Use o relatório de parcerias para acompanhar resultados"
    ]
  },
  {
    id: "reports",
    icon: TrendingUp,
    title: "Relatórios",
    description: "Analise o desempenho do seu negócio com relatórios detalhados.",
    steps: [
      {
        title: "Relatório de vendas",
        content: "Veja vendas por período, forma de pagamento, produto e cliente. Exporte para Excel se precisar."
      },
      {
        title: "Relatório de estoque",
        content: "Analise giro de estoque, produtos parados e itens mais vendidos."
      },
      {
        title: "Relatório de parcerias",
        content: "Acompanhe vendas e lucros gerados através de parcerias."
      }
    ],
    tips: [
      "Analise relatórios semanalmente para identificar tendências",
      "Use filtros para análises específicas"
    ]
  },
  {
    id: "my-store",
    icon: Store,
    title: "Minha Loja (Catálogo)",
    description: "Configure sua loja online com catálogo público de produtos.",
    steps: [
      {
        title: "Configurar loja",
        content: "Defina nome, descrição, cores, logo e banner da sua loja. Escolha um slug único (ex: vendaprofit.app/minhaloja)."
      },
      {
        title: "Personalizar aparência",
        content: "Escolha cores primárias, fontes e posição do logo. Adicione banner promocional se desejar."
      },
      {
        title: "WhatsApp para vendas",
        content: "Configure seu número de WhatsApp. Clientes poderão iniciar conversa direto do catálogo."
      },
      {
        title: "Produtos de parceiros",
        content: "Ative para mostrar produtos de parceiros no seu catálogo, aumentando o mix disponível."
      }
    ],
    tips: [
      "Use fotos de qualidade nos produtos",
      "Mantenha o banner atualizado com promoções",
      "Compartilhe o link da loja nas redes sociais"
    ]
  },
  {
    id: "settings",
    icon: Settings,
    title: "Configurações",
    description: "Personalize o sistema conforme suas necessidades.",
    steps: [
      {
        title: "Taxas de pagamento",
        content: "Configure a taxa cobrada por cada forma de pagamento (cartão de crédito, débito, pix) para cálculo correto do lucro."
      },
      {
        title: "Formas de pagamento personalizadas",
        content: "Crie formas de pagamento específicas do seu negócio, como 'Fiado', 'Boleto', etc."
      },
      {
        title: "Lembretes de pagamento",
        content: "Gerencie cobranças pendentes e pagamentos a receber."
      },
      {
        title: "Chaves de IA",
        content: "Configure suas chaves de API para funcionalidades avançadas como provador virtual e transcrição de voz."
      }
    ],
    tips: [
      "Mantenha as taxas atualizadas conforme sua maquininha",
      "Use lembretes para não esquecer cobranças"
    ]
  }
];

export function TutorialTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Guia Completo do Sistema
          </CardTitle>
          <CardDescription>
            Aprenda a utilizar todas as funcionalidades do Venda PROFIT. 
            Clique em cada seção para ver o passo a passo detalhado.
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible className="space-y-4">
        {tutorialSections.map((section) => {
          const IconComponent = section.icon;
          return (
            <AccordionItem 
              key={section.id} 
              value={section.id}
              className="border rounded-lg px-4 bg-card"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <IconComponent className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{section.title}</h3>
                    <p className="text-sm text-muted-foreground font-normal">
                      {section.description}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-4 pt-2">
                  {/* Steps */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Passo a Passo
                    </h4>
                    {section.steps.map((step, index) => (
                      <div key={index} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <h5 className="font-medium text-sm">{step.title}</h5>
                          <p className="text-sm text-muted-foreground mt-1">
                            {step.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tips */}
                  {section.tips && section.tips.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        Dicas
                      </h4>
                      <div className="space-y-1">
                        {section.tips.map((tip, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {section.warnings && section.warnings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        Atenção
                      </h4>
                      <div className="space-y-1">
                        {section.warnings.map((warning, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm text-orange-600 dark:text-orange-400">
                            <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{warning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Quick Start Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">🚀 Início Rápido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Para começar a usar o sistema, siga estes passos básicos:
          </p>
          <ol className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">1</Badge>
              <span><strong>Cadastre suas categorias</strong> em Categorias</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">2</Badge>
              <span><strong>Adicione seus produtos</strong> em Estoque</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">3</Badge>
              <span><strong>Configure sua loja</strong> em Minha Loja</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">4</Badge>
              <span><strong>Comece a vender!</strong> Use Vendas ou Bolsa Consignada</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
