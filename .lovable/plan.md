

# Fluxo de Conciliacao Pos-Evento

## Resumo

Criar o fluxo completo de conciliacao de rascunhos do Modo Evento, permitindo que a vendedora transforme rascunhos rapidos em vendas oficiais apos o evento, com alerta no Dashboard e interface dedicada.

## Arquivos a Criar/Modificar

### 1. `src/components/dashboard/EventDraftsBanner.tsx` (NOVO)

Componente de alerta que aparece no Dashboard e na pagina de Vendas quando ha rascunhos pendentes.

- Query em `event_sale_drafts` filtrando `status = 'pending'` e `owner_id = auth.uid()`
- Exibe card com icone Zap, contagem de rascunhos pendentes e botao "Conciliar"
- Botao navega para `/evento/conciliacao`
- Se nao houver rascunhos pendentes, retorna null (nao renderiza nada)
- Estilo similar aos cards existentes em SystemAlerts (cor violeta/roxa para combinar com o tema do Modo Evento)

### 2. `src/pages/EventReconciliation.tsx` (NOVO)

Pagina dedicada de conciliacao com lista de rascunhos pendentes.

**Layout:**
- MainLayout com cabecalho "Conciliacao de Rascunhos"
- Lista de cards, cada um representando um rascunho pendente
- Card compacto mostrando: data/hora, quantidade de itens, total estimado, miniatura da primeira foto

**Detalhe do Rascunho (Dialog):**
- Ao clicar em um card, abre um Dialog largo com:
  - Carrossel/galeria das fotos (usando scroll horizontal com miniaturas clicaveis)
  - Lista dos itens rapidos selecionados (label, quantidade, preco)
  - Texto das observacoes (transcritas por voz)
  - Botao "Oficializar Venda" que navega para `/sales?from_draft=DRAFT_ID`

**Acao de Descartar:**
- Botao secundario para descartar/excluir rascunho (com confirmacao via AlertDialog)

### 3. `src/pages/Sales.tsx` (MODIFICAR)

- Ler query param `from_draft` na URL
- Se presente, buscar o rascunho correspondente do banco
- Pre-preencher o campo `notes` com as observacoes do rascunho + informacoes dos itens rapidos (rotulos e quantidades para referencia)
- Abrir automaticamente o dialog de Nova Venda
- Apos a venda ser criada com sucesso (dentro de `createSaleMutation.onSuccess`), atualizar o status do rascunho para `reconciled`
- Limpar o query param da URL

### 4. `src/pages/Dashboard.tsx` (MODIFICAR)

- Importar e renderizar `EventDraftsBanner` logo abaixo de `SystemAlerts`

### 5. `src/App.tsx` (MODIFICAR)

- Adicionar rota protegida `/evento/conciliacao` para `EventReconciliation`

## Fluxo do Usuario

```text
Dashboard/Vendas
    |
    v
[Banner: "Voce tem X rascunhos pendentes"]
    |
    v  (clique em "Conciliar")
    |
[Pagina de Conciliacao - Lista de Cards]
    |
    v  (clique em um card)
    |
[Dialog com fotos, itens e notas]
    |
    v  (clique em "Oficializar Venda")
    |
[Pagina de Vendas - Dialog Nova Venda pre-preenchido]
    |
    v  (vendedora seleciona produtos reais e salva)
    |
[Rascunho atualizado para 'reconciled' automaticamente]
```

## Detalhes Tecnicos

| Item | Detalhe |
|------|---------|
| Banner | Query simples em `event_sale_drafts` com `status = 'pending'`, count only |
| Conciliacao | Query completa dos rascunhos pendentes com todos os campos |
| Galeria de fotos | Scroll horizontal com `overflow-x-auto`, imagens vindas de `photo_urls` |
| Pre-preenchimento | Notas do rascunho concatenadas com lista dos itens rapidos como referencia |
| Atualizacao do status | `UPDATE event_sale_drafts SET status = 'reconciled' WHERE id = ?` apos sucesso da venda |
| Navegacao | `useSearchParams` para ler `from_draft` e `useNavigate` para navegar |
| Sem dependencias novas | Usa apenas o que ja existe no projeto |

## Resumo de Arquivos

| Arquivo | Acao |
|--------|------|
| `src/components/dashboard/EventDraftsBanner.tsx` | Criar - banner de alerta |
| `src/pages/EventReconciliation.tsx` | Criar - pagina de conciliacao |
| `src/pages/Sales.tsx` | Modificar - pre-preenchimento e atualizacao de status |
| `src/pages/Dashboard.tsx` | Modificar - adicionar banner |
| `src/App.tsx` | Modificar - adicionar rota |

