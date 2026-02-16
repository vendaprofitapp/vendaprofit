
# Permitir Salvar Rascunho Sem Itens no Modo Evento

## Problema

Atualmente o botao "Salvar Rascunho" so funciona se houver pelo menos um item na sacola (botao rapido clicado). A vendedora nao consegue salvar um rascunho contendo apenas fotos e/ou observacoes.

## Solucao

Alterar duas validacoes em `src/pages/EventMode.tsx`:

1. **Validacao do `saveDraft`** (linha ~157): Trocar a condicao de `bagItems.length === 0` para verificar se nao ha NENHUM conteudo (sem itens, sem fotos e sem notas). Se pelo menos um desses existir, permitir salvar.

2. **Estado `disabled` do botao** (linha ~219): Trocar `bagItems.length === 0` pela mesma logica - desabilitar apenas quando nao houver nenhum conteudo.

## Detalhe Tecnico

| Local | Antes | Depois |
|-------|-------|--------|
| Condicao de bloqueio no `saveDraft` | `bagItems.length === 0` | `bagItems.length === 0 && photos.length === 0 && !notes.trim()` |
| Atributo `disabled` do botao | `saving \|\| bagItems.length === 0` | `saving \|\| (bagItems.length === 0 && photos.length === 0 && !notes.trim())` |

## Arquivo Afetado

| Arquivo | Acao |
|---------|------|
| `src/pages/EventMode.tsx` | Modificar - relaxar validacao de salvamento |
