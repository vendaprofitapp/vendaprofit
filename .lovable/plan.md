

# Modo Evento - Interface Mobile-First

## Resumo

Criar uma nova pagina `/evento` dedicada ao registro rapido de vendas em eventos presenciais, com UX 100% mobile-first, operacao com uma mao, e sem distracao.

## Arquivos a Criar/Modificar

### 1. `src/pages/EventMode.tsx` (NOVO)

Pagina principal do Modo Evento com os seguintes componentes integrados:

**Cabecalho:**
- Botao voltar (arrow-left) para sair do modo evento
- Badge "Modo Evento Ativo" com indicador pulsante

**Grid de Botoes Rapidos:**
- Query dos `event_quick_buttons` do usuario ordenados por `sort_order`
- Botoes grandes e coloridos (usando a cor salva no banco)
- Clique adiciona item a sacola; clique repetido incrementa quantidade
- Botao "+" para criar novo botao rapido via dialog simples (label, preco, cor)

**Sacola Atual (lista de itens):**
- Lista dos itens selecionados com label, quantidade, preco unitario e subtotal
- Botoes de +/- para ajustar quantidade e remover

**Captura Visual:**
- Botao grande de camera usando `<input type="file" accept="image/*" capture="environment" multiple />`
- Miniaturas das fotos tiradas com opcao de remover

**Transcricao de Voz:**
- Botao de microfone usando Web Speech API (`webkitSpeechRecognition`)
- Feedback visual "Gravando..." com animacao
- Texto transcrito inserido em textarea editavel

**Rodape Fixo:**
- Total estimado em destaque
- Botao gigante "Salvar Rascunho" que:
  1. Faz upload paralelo das fotos para bucket `event-photos`
  2. Salva rascunho em `event_sale_drafts`
  3. Limpa estado e exibe toast de sucesso

### 2. `src/App.tsx` (MODIFICAR)

- Adicionar import e rota protegida `/evento` para `EventMode`

### 3. `src/components/layout/Sidebar.tsx` (MODIFICAR)

- Adicionar link "Modo Evento" no grupo "Estrategias" com icone `Zap`

## Detalhes Tecnicos

| Item | Detalhe |
|------|---------|
| Pagina | `src/pages/EventMode.tsx` - pagina standalone sem MainLayout (fullscreen mobile) |
| Rota | `/evento` protegida |
| Sidebar | Link adicionado no grupo Estrategias |
| Storage | Upload para bucket `event-photos` no path `{userId}/{timestamp}-{filename}` |
| Speech API | `webkitSpeechRecognition` com lang `pt-BR`, continuous mode |
| Sem dependencias novas | Usa apenas o que ja existe no projeto |
