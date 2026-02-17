
# Correção: Nome do Produto Vindo como "XEngine Cross Domain Data Tunnel"

## Causa Raiz

Confirmado via teste direto: a edge function `scrape-product-images` retorna `"name": "XEngine Cross Domain Data Tunnel"` para todas as URLs da NewHype.

O bug esta na extração de nome via JSON-LD (linhas 570-592 de `scrape-product-images/index.ts`):

```typescript
// CODIGO ATUAL (com bug):
if (parsed.name) {           // Aceita QUALQUER JSON-LD com "name"
  productName = parsed.name;  // Pega o nome do script de tracking!
  break;
}
```

O site da NewHype (Dooca Commerce) injeta um bloco JSON-LD do "XEngine Cross Domain Data Tunnel" (ferramenta de tracking) que tem um campo `name`. Como o codigo aceita qualquer bloco com `name` sem verificar o `@type`, ele pega o nome do tracker em vez do produto.

A extração anterior via `<h1>` provavelmente funciona corretamente mas eh sobrescrita pelo JSON-LD bugado.

## Correção

### Arquivo: `supabase/functions/scrape-product-images/index.ts`

**Mudanca 1 — JSON-LD: Aceitar apenas `@type: 'Product'`** (linhas 570-592)

Alterar a logica para so extrair o nome quando o bloco JSON-LD for do tipo Product:

```typescript
// CORRIGIDO:
if (parsed['@type'] === 'Product' && parsed.name) {
  productName = parsed.name;
  break;
}
```

**Mudanca 2 — Fallback de URL: Usar penultimo segmento para Dooca** (linhas 594-605)

Quando o fallback de URL eh acionado, URLs Dooca tem formato `/produto/cor`. O codigo atual usa o ultimo segmento (a cor). Corrigir para usar o penultimo segmento quando houver 2+ segmentos no path:

```typescript
const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
// Para Dooca (produto/cor), usar penultimo segmento como nome
const slug = pathParts.length >= 2
  ? pathParts[pathParts.length - 2]
  : pathParts[pathParts.length - 1] || '';
```

## Resultado Esperado

Apos a correcao, o scraper retornara o nome correto do produto (ex: "CONJUNTO PUMP CASTOR" via `<h1>`, ou "Conjunto Pump" via URL fallback) em vez de "XEngine Cross Domain Data Tunnel".
