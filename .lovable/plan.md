
# Tornar Mensagens de Incentivos de Compra Mais Chamativas e Duradouras

## Problema

As mensagens (toasts) de incentivos de compra que aparecem ao adicionar produtos ao carrinho no catalogo sao pequenas e desaparecem rapido (3-4 segundos). Isso vale tanto para mobile quanto desktop.

## Solucao

Aumentar a duracao e o destaque visual das mensagens de incentivo, usando toasts customizados com estilo mais chamativo.

### Alteracoes

**Arquivo: `src/pages/StoreCatalog.tsx`** (linhas 436-456)

1. **Duracao**: Aumentar de 3-4 segundos para **6-8 segundos**
   - Mensagem de tier desbloqueado (celebracao): 8 segundos
   - Mensagem de progresso para proximo tier: 6 segundos
   - Mensagem generica de incentivo (on_add): 5 segundos

2. **Estilo visual**: Usar a opcao `className` do sonner para aumentar o tamanho do texto e adicionar destaque
   - Texto principal maior (font-semibold, text-base)
   - Descricao com tamanho legivel (text-sm)
   - Padding extra para maior visibilidade no mobile

3. **Mensagem de tier desbloqueado** (celebracao): Adicionar descricao complementar mostrando o beneficio conquistado

### Exemplo do resultado

Antes:
- Toast pequeno padrao, 3s de duracao

Depois:
- Toast com texto maior e mais visivel
- 6-8 segundos de duracao
- Estilo destacado com classes CSS customizadas aplicadas via `className` do sonner

### Detalhes tecnicos

O sonner aceita `className` e `style` como opcoes, permitindo customizar cada toast individualmente. As classes aplicadas serao:

```text
className: "!text-base !p-4" (para aumentar tamanho e padding)
descriptionClassName: "!text-sm" (para descricao legivel)
```

Isso garante visibilidade tanto no mobile (onde o toast pode ser ainda menor) quanto no desktop.
