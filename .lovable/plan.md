
# Correcao: Produto de Parceira com Mesmo Nome Nao Aparece no PDV

## Problema Identificado

No arquivo `src/pages/Sales.tsx`, linha 1379-1389, existe uma logica de deduplicacao que **remove produtos de parceiras quando o nome do produto e identico ao de um produto proprio**:

```text
const ownNames = new Set(filteredOwnProducts.map(p => p.name.toLowerCase().trim()));
const uniquePartnerProducts = filteredPartnerProducts.filter(
  pp => !ownNames.has(pp.name.toLowerCase().trim())
);
```

Isso significa que se voce tem "Blusa X" tamanho P e sua parceira tem "Blusa X" tamanho M, o sistema esconde o produto da parceira porque os nomes sao iguais. O catalogo publico (StoreCatalog) nao tem essa restricao, por isso la o produto aparece normalmente.

## Solucao

Alterar a logica de deduplicacao para comparar **por ID do produto** ao inves de por nome. Produtos de parceiras sao registros diferentes no banco (IDs diferentes), entao nunca vao colidir por ID. A deduplicacao por nome era excessivamente agressiva.

## Arquivo a modificar

**`src/pages/Sales.tsx`** (linhas 1379-1389)

Trocar a logica de:
- Criar um Set de nomes dos produtos proprios
- Filtrar parceiros que tenham o mesmo nome

Para:
- Criar um Set de IDs dos produtos proprios
- Filtrar parceiros que tenham o mesmo ID (evita duplicatas reais, mas permite produtos com mesmo nome e tamanhos diferentes)

## Detalhes tecnicos

A alteracao e minima -- apenas 2 linhas mudam:

```text
// ANTES (filtra por nome - BUG)
const ownNames = new Set(filteredOwnProducts.map(p => p.name.toLowerCase().trim()));
const uniquePartnerProducts = filteredPartnerProducts.filter(
  pp => !ownNames.has(pp.name.toLowerCase().trim())
);

// DEPOIS (filtra por ID - CORRETO)
const ownIds = new Set(filteredOwnProducts.map(p => p.id));
const uniquePartnerProducts = filteredPartnerProducts.filter(
  pp => !ownIds.has(pp.id)
);
```

Isso garante que produtos de parceiras com o mesmo nome mas tamanhos/cores diferentes aparecerao na secao "Estoque de Parceiras" do PDV, mantendo o comportamento correto de nao duplicar o mesmo produto fisico.
