
# Correção do Importador para o Site NewHype (Dooca Commerce)

## Diagnóstico Técnico

O site newhype.com.br usa a plataforma **Dooca Commerce**, com uma estrutura de URL diferente da esperada pelo filtro atual:

```text
Categorias:   newhype.com.br/combo                          (4 partes)
              newhype.com.br/conjunto-com-calca              (4 partes)
              newhype.com.br/macaquinho-1                    (4 partes)

Combos:       newhype.com.br/combo-premium-372              (4 partes)

Peças indiv.: newhype.com.br/conjunto-pump/castor           (5 partes)
              newhype.com.br/elegance-canelado/prata        (5 partes)
              newhype.com.br/cj-sleek/verde-menta           (5 partes)
```

O filtro atual aceita URLs com `split('/').length >= 4`, o que inclui categorias (`/combo`) e combos (`/combo-premium-372`), enquanto ignora as **peças reais** que têm 5 segmentos (produto + cor). É o contrário do desejado.

Adicionalmente, na etapa de scraping, o heading extraído para peças é `# CONJUNTO PUMP  CASTOR` — o nome fica com a cor concatenada, o que é correto para identificação mas precisa de um tratamento para separar nome do produto da cor.

---

## Correção 1 — `supabase/functions/map-supplier-site/index.ts`

### Detecção de formato Dooca Commerce

Adicionar reconhecimento específico para o padrão de URL da Dooca:

```
dominio.com/nome-produto/cor  →  5 partes no split  →  é produto
dominio.com/nome-produto      →  4 partes no split  →  pode ser categoria OU combo
```

A regra será:

1. **URLs com 5 partes** (`/produto/cor`): sempre são produtos individuais — **incluir**
2. **URLs com 4 partes** com hifens: podem ser combos ou categorias — aplicar filtros existentes
3. **Exclusões adicionais** para o padrão Dooca: nomes de categorias conhecidas da NewHype (`/conjunto-com-calca`, `/macaquinho-1`, `/conjunto-com-calca-1`, `/acessorio`, `/colete`, `/jaqueta`, `/macacao`, `/camisas`) — **excluir**
4. Também excluir URLs terminando com `-1`, `-2` etc. (variantes de slug de categoria no Dooca)

A detecção de plataforma Dooca será feita ao verificar se o host usa `dooca.store` no conteúdo ou se as URLs seguem o padrão `dominio/slug/cor`.

### Nova lógica de filtro:

```typescript
// Detectar URLs no formato Dooca: dominio/produto/cor (5 partes)
const parts = link.split('/').filter(p => p.length > 0);
const isDoocaProduct = parts.length === 4; // protocolo + domínio + produto + cor

// Ex: https://newhype.com.br/conjunto-pump/castor → split dá 5 itens
// Então usar: link.split('/').length === 5 para produto+cor
```

---

## Correção 2 — `src/components/admin/NewProductsScanner.tsx`

### Extração de nome sem a cor

Atualmente o heading capturado é `# CONJUNTO PUMP  CASTOR`. O nome deve ser apenas `CONJUNTO PUMP`.

A URL do produto tem o formato `/nome-produto/cor`. O **nome limpo** pode ser extraído da própria URL (penúltimo segmento, transformando hifens em espaços e colocando em maiúsculas), ao invés de usar o `headingMatch` que inclui a cor.

```typescript
// Extrair nome da URL: /conjunto-pump/castor → "CONJUNTO PUMP"
const urlParts = batch[i].split('/').filter(p => p.length > 0);
const productSlug = urlParts[urlParts.length - 2]; // penúltimo segmento
const nameFromUrl = productSlug
  ?.replace(/-/g, ' ')
  .toUpperCase()
  .trim();

// Usar nameFromUrl como primeiro candidato,
// headingMatch como fallback para URLs de segmento único (combos)
```

### Deduplicação por nome base (sem cor)

Como o mesmo produto existe em várias cores (`/conjunto-pump/castor`, `/conjunto-pump/preto`, `/conjunto-pump/rosa-cereja`), o scanner deve agrupar por nome base e usar **apenas a primeira URL** de cada produto, evitando duplicatas no resultado.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/map-supplier-site/index.ts` | Reconhecer URLs no formato `produto/cor` (5 segmentos) como produto; excluir slugs de categorias conhecidas do Dooca |
| `src/components/admin/NewProductsScanner.tsx` | Extrair nome limpo da URL (sem a cor), deduplicar por nome base |

---

## Resultado Esperado

Após a correção, ao usar "Buscar Novidades" com o site `https://www.newhype.com.br/`:

- O mapeamento retornará URLs como `/conjunto-pump/castor`, `/elegance-canelado/prata`, `/cj-sleek/verde-menta`, etc.
- Cada produto aparecerá **uma única vez** com nome limpo (ex: `CONJUNTO PUMP`, `ELEGANCE CANELADO`, `CJ SLEEK`)
- Combos como `combo-premium-372` ainda serão detectados se desejado, mas separados dos produtos individuais
