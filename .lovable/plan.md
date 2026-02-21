

# Barra Fixa de Captura de Lead Passiva (controlada pelo toggle existente)

## Resumo

Adicionar uma barra fixa no rodape do catalogo que captura Nome e WhatsApp de visitantes que navegam sem abrir o carrinho. A barra so aparece quando o toggle "Captura de Leads" na pagina WhatsApp CRM esta ativo. Os campos inline no carrinho permanecem **sempre visiveis**, independentemente do toggle.

## Separacao de responsabilidades

| Funcionalidade | Depende do toggle? |
|---|---|
| Campos inline no carrinho (Nome + WhatsApp) | **Nao** -- sempre aparecem |
| Barra passiva no rodape do catalogo | **Sim** -- so aparece quando toggle ligado |

## Como funciona a barra passiva

1. Cliente entra no catalogo e navega normalmente
2. Apos 8 segundos ou scroll > 300px, uma barra sutil desliza de baixo: "Quer receber novidades? Deixe seu WhatsApp"
3. Dois campos compactos (Nome + WhatsApp) + botao "Salvar"
4. Ao preencher, lead salvo no banco + localStorage, barra desaparece com "Obrigado!"
5. Se lead ja existe no localStorage, a barra nunca aparece
6. O "X" dispensa a barra pela sessao (sessionStorage)
7. Toggle desligado = barra nunca aparece, mas carrinho continua pedindo dados normalmente

## Alteracoes por arquivo

| Arquivo | O que muda |
|---|---|
| `src/pages/StoreCatalog.tsx` | Adicionar estados `showLeadBar` e `leadBarDismissed`. Adicionar useEffect com timer 8s + scroll listener (condicionado ao toggle). Renderizar barra fixa (`position: fixed, bottom: 0, z-40`) condicionada a `lead_capture_enabled && !storedLead`. **Manter campos inline do carrinho sem condicao ao toggle** -- eles aparecem sempre. Reutilizar `saveLeadData` existente. |
| `src/pages/WhatsAppCRM.tsx` | Atualizar texto descritivo do toggle de "Solicitar nome e WhatsApp ao adicionar itens ao carrinho" para "Exibir barra de captura de leads durante a navegacao no catalogo" |

## Detalhes tecnicos

### Campos inline do carrinho (sem mudanca)

Os campos de Nome e WhatsApp dentro do Sheet do carrinho continuam aparecendo **sempre**, para qualquer visitante, independentemente do toggle. Isso garante que todo pedido tenha dados de contato.

### Novos estados para a barra passiva

- `showLeadBar: boolean` (inicia false) -- controla visibilidade
- `leadBarDismissed: boolean` (inicia lendo sessionStorage) -- se usuario clicou X
- `barLeadName: string` e `barLeadWhatsapp: string` -- campos do formulario da barra

### Logica de exibicao da barra (useEffect)

```text
Condicoes para mostrar a barra:
  lead_capture_enabled === true (toggle ligado)
  AND localStorage nao tem lead_id
  AND sessionStorage nao tem lead_bar_dismissed
  AND (timer 8s expirou OR scrollY > 300)
```

### UI da barra

- `fixed bottom-0 left-0 right-0 z-40` (abaixo do Sheet do carrinho que e z-50)
- Background com blur: `bg-white/95 dark:bg-card/95 backdrop-blur-sm border-t shadow-lg`
- Animacao: `transition-transform duration-500` com `translate-y-full` / `translate-y-0`
- Layout responsivo: campos empilham no mobile, lado a lado no desktop
- Botao X no canto superior direito para dispensar
- Ao salvar com sucesso: toast de confirmacao + barra desaparece

### Interacao entre barra e carrinho

- Se lead capturado pela barra, campos no carrinho mostram estado "confirmado" (nome + check)
- Se lead NAO capturado pela barra mas abriu carrinho, campos inline funcionam normalmente como captura principal
- Ambos usam a mesma funcao `saveLeadData` -- sem duplicacao

