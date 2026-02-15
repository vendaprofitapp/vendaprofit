
# Adicionar Novos Tamanhos ao Sistema

## O que muda

Incluir os tamanhos infantis (2, 4, 6, 8, 10, 12) e os tamanhos de peso/embalagem (Pote 400 grs, Pote 350 grs, Pote 220 grs, Pacote 500 grs, Pacote 1 kg) em todas as listas de tamanhos do sistema.

## Arquivos a modificar

| Arquivo | O que muda |
|---------|-----------|
| `src/components/stock/ProductFormDialog.tsx` | Adicionar novos tamanhos em `availableSizes` e `sizeOrder` |
| `src/components/stock/StockImportDialog.tsx` | Adicionar novos tamanhos em `availableSizes` |
| `src/components/sales/VariantSelectionDialog.tsx` | Adicionar novos tamanhos em `SIZE_ORDER` |
| `src/components/sales/VoiceSaleDialog.tsx` | Adicionar novos tamanhos em `SIZE_ORDER` |
| `src/pages/StockRequests.tsx` | Adicionar novos tamanhos em `SIZE_ORDER` |
| `src/components/stock/VoiceStockDialog.tsx` | Adicionar novos tamanhos em `sizeOrder` |

## Ordem dos tamanhos

A ordem final sera:

```text
Infantis:  2, 4, 6, 8, 10, 12
Letras:    PP, P, M, G, GG, XG, XXG, XXXG, EG, EGG, EGGG
Unico:     U, UN, UNICO, UNICO
Calcados:  33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48
Peso:      Pote 220 grs, Pote 350 grs, Pote 400 grs, Pacote 500 grs, Pacote 1 kg
```

## Detalhes Tecnicos

- Nos 6 arquivos listados, as arrays de tamanhos serao atualizadas para incluir os novos valores
- A ordenacao segue a logica: infantis primeiro, depois letras, unico, calcados, e por ultimo peso/embalagem
- Nenhuma mudanca no banco de dados e necessaria pois tamanhos sao texto livre nas variantes
