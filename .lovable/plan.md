
# Captura de Lead Inline no Carrinho (sem pop-up)

## Problema

O pop-up (Drawer/Dialog) do `LeadCaptureSheet` causa instabilidades em dispositivos moveis -- conflitos com o teclado virtual, camadas sobrepostas ao Sheet do carrinho, e comportamento imprevisivel ao fechar/abrir multiplos modais.

## Estrategia Proposta: Formulario Embutido no Carrinho

Em vez de abrir um pop-up separado, os campos de Nome e WhatsApp serao exibidos **diretamente dentro do painel do carrinho (Sheet)**, logo acima do botao "Revisar e enviar pedido". Isso elimina completamente o problema de multiplos modais no mobile.

### Como funciona para o cliente:

1. Cliente adiciona itens ao carrinho normalmente (sem interrupcao)
2. Ao abrir a sacola, se os dados ainda nao foram capturados, ele ve dois campos compactos (Nome e WhatsApp) integrados ao rodape do carrinho, antes do botao de finalizar
3. O botao de finalizar so fica habilitado apos preencher os campos (quando lead capture esta ativo)
4. Ao preencher, os dados sao salvos automaticamente no banco e no localStorage -- sem necessidade de clicar em "salvar"
5. Se o cliente ja forneceu os dados antes, os campos aparecem preenchidos com um indicador visual de confirmacao

### Vantagens:

- Zero pop-ups: nenhum modal, drawer ou overlay adicional
- Fluxo natural: o cliente preenche no momento que ja esta decidindo comprar
- Sem conflitos de teclado virtual no mobile
- Dados capturados antes do checkout, habilitando o rastreio de carrinhos abandonados
- Compativel com o toggle "Captura de Leads" existente (quando desativado, os campos nao aparecem)

## Alteracoes por Arquivo

| Arquivo | Alteracao |
|---|---|
| `src/pages/StoreCatalog.tsx` | Substituir o `LeadCaptureSheet` por campos inline dentro do SheetContent do carrinho. Mover logica de captura para o rodape do carrinho. Remover o state `showLeadCapture` e `pendingCartAdd`. |
| `src/components/catalog/LeadCaptureSheet.tsx` | Manter o arquivo (ainda usado pelo `showLoyaltyCapture`), sem alteracoes. |

## Detalhes Tecnicos

### Dentro do SheetContent do carrinho (`StoreCatalog.tsx`):

- Quando `lead_capture_enabled === true` e nao ha lead salvo no localStorage:
  - Renderizar dois campos `Input` (Nome e WhatsApp) com formatacao automatica no rodape, entre o total e o botao de enviar
  - O botao "Revisar e enviar pedido" fica desabilitado ate que ambos os campos sejam validos (nome >= 2 chars, WhatsApp >= 10 digitos)
  - Ao clicar no botao de enviar, salvar os dados do lead no banco (reutilizando `saveLeadData`) antes de navegar ao checkout

- Quando lead ja esta salvo no localStorage:
  - Exibir uma linha compacta com o nome do cliente e um icone de check, sem campos editaveis
  - Botao de enviar habilitado normalmente

- Os campos usam `inputMode="text"` e `inputMode="tel"` respectivamente, e `scrollIntoView` no focus para garantir boa experiencia no mobile

- O `saveAbandonedCart` continua funcionando normalmente via o useEffect existente, pois o `lead_id` estara disponivel no localStorage assim que o cliente preencher os campos
