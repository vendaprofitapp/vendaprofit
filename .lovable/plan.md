
# Remover Pop-up "Reservar suas pecas" e Renomear Botao

## Problema
Ao clicar "Finalizar pelo WhatsApp" na sacola, o sistema verifica se o cliente ja preencheu seus dados (lead). Se nao preencheu, abre o pop-up "Reservar suas pecas" ao inves de ir para a pagina de checkout. Como a pagina de checkout ja coleta Nome e WhatsApp, esse pop-up e redundante e causa confusao.

## Solucao

### Arquivo: `src/pages/StoreCatalog.tsx`

**1. Remover a verificacao de lead no checkout**
Na funcao `sendCartViaWhatsApp` (linha ~1524), remover o bloco que verifica `getStoredLead()` e abre o `LeadCaptureSheet`. A funcao deve navegar diretamente para a pagina de checkout sem verificar se o lead existe, pois a pagina de checkout ja coleta esses dados.

**2. Remover o state `pendingCheckout`**
- Remover a declaracao `const [pendingCheckout, setPendingCheckout] = useState(false)` (linha ~251)
- Remover o bloco que verifica `pendingCheckout` dentro do callback `onLeadCaptured` (linhas ~422-428)

**3. Renomear o botao na sacola**
Trocar o texto "Finalizar pelo WhatsApp" (linha ~1790) para "Revisar e enviar pedido".

## Impacto
- O pop-up "Reservar suas pecas" continua existindo para captura de leads ao adicionar itens ao carrinho (esse fluxo nao muda)
- O checkout sempre ira para a pagina dedicada, onde o cliente preenche seus dados
- Nenhuma outra funcionalidade e afetada
