
# WhatsApp CRM - Layout Kanban com Drag & Drop

## Resumo

Substituir o layout atual de Tabs (Pendentes / Contatados) por um layout Kanban com duas colunas lado a lado, onde o usuario pode arrastar cards de "Pendentes" para "Contatados". O botao "Chamar no WhatsApp" permanece visivel nos cards da coluna Pendentes. Na coluna Contatados, os botoes de Follow-up, Converter e Descartar continuam disponiveis.

## Alteracoes

### Arquivo: `src/pages/WhatsAppCRM.tsx`

**Remover:**
- Componente `Tabs` / `TabsList` / `TabsContent` / `TabsTrigger`
- Import de `Tabs` do radix
- Estado `activeTab`

**Adicionar:**
- Implementacao de drag-and-drop nativo usando a HTML5 Drag and Drop API (sem dependencias externas)
- Layout de duas colunas lado a lado (Kanban):
  - Coluna "Pendentes" (esquerda): lista os leads pendentes filtrados pelos summary cards
  - Coluna "Contatados" (direita): lista os leads ja contatados
- Cada card de lead na coluna Pendentes tera `draggable="true"` com handlers `onDragStart`
- Cada coluna tera handlers `onDragOver` e `onDrop`
- Ao dropar um card de Pendentes em Contatados, chama a mutation `markContacted`
- Cards na coluna Pendentes mantem o botao verde "Chamar no WhatsApp"
- Cards na coluna Contatados mantem botoes de Follow-up, Converter e Descartar
- No mobile (telas pequenas), as colunas empilham verticalmente

### Layout visual

```text
+---------------------------+---------------------------+
|  PENDENTES (filtrados)    |  CONTATADOS               |
|  [count] leads            |  [count] leads            |
+---------------------------+---------------------------+
| [Card Lead 1        drag] | [Card Lead A             ]|
|  Nome / Badge / Phone     |  Nome / Badge / Phone     |
|  [Chamar no WhatsApp]     |  [Follow-up] [Converter]  |
|                           |                    [X]    |
| [Card Lead 2        drag] |                           |
|  ...                      |                           |
+---------------------------+---------------------------+
```

### Detalhes tecnicos

- Usar `onDragStart` para guardar o ID e sourceTable do lead sendo arrastado em `dataTransfer`
- Usar `onDragOver` com `preventDefault()` para permitir o drop
- Usar `onDrop` para ler o ID e chamar `markContacted.mutate(leadId)`
- Feedback visual: ao arrastar sobre a coluna Contatados, aplicar borda destacada (ex: `ring-2 ring-green-500`)
- Estado `dragOverColumn` para controlar o highlight visual
- Para leads do tipo "birthday" e "inactive" (sourceTable "customer"), o drag nao dispara mutation pois nao tem `lead_cart_items`, apenas move visualmente e exibe toast informativo
- Layout responsivo: `grid grid-cols-1 lg:grid-cols-2` para empilhar no mobile

### Nenhuma alteracao no banco de dados

A logica de mutations permanece identica - apenas a UI muda de tabs para kanban.

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/WhatsAppCRM.tsx` | Reescrever layout de Tabs para Kanban com drag-and-drop nativo |
