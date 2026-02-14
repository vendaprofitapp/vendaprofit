
# Epico 13-14: Feeds de Produtos + Painel de Vitrines Externas

## Resumo

Criar Edge Functions publicas que geram feeds XML (Google Shopping) e CSV (Meta Commerce) em tempo real a partir dos produtos do usuario, com regra "Always Profit" (estoque zero = fora do feed). Adicionar um painel simples na aba Marketing para copiar o link do feed e ver instrucoes de configuracao.

---

## Epico 13: Edge Functions de Feed

### Migracao de Banco de Dados

Adicionar coluna `feed_token` (text, DEFAULT `substring(md5(random()::text), 1, 24)`) na tabela `store_settings` para autenticar o acesso publico ao feed sem expor dados do usuario.

### Edge Function: `product-feed`

Rota unica `supabase/functions/product-feed/index.ts` que aceita query params:
- `store_id` (uuid da store_settings)
- `token` (feed_token para autenticacao)
- `format` (opcional: `google` ou `meta`, default `google`)

Logica:
1. Valida `store_id` + `token` contra `store_settings`
2. Busca `store_settings` para obter `store_slug`, `store_name`
3. Busca todos os `products` onde `owner_id = store_settings.owner_id` AND `is_active = true` AND `stock_quantity > 0` (regra Always Profit)
4. Para cada produto, tambem busca `product_variants` para calcular disponibilidade real (soma de variantes com stock > 0)
5. Gera XML ou CSV conforme o formato solicitado
6. Paginacao interna: busca em blocos de 500 produtos para nao sobrecarregar

**Formato Google Shopping (XML)**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>{store_name}</title>
    <link>{origin}/{store_slug}</link>
    <item>
      <g:id>{product.id}</g:id>
      <g:title>{product.name}</g:title>
      <g:description>{product.description || product.name}</g:description>
      <g:link>{origin}/{store_slug}?product={product.id}</g:link>
      <g:image_link>{product.image_url}</g:image_link>
      <g:price>{product.price} BRL</g:price>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>{store_name}</g:brand>
    </item>
  </channel>
</rss>
```

**Formato Meta (CSV)**:
Headers: `id,title,description,availability,condition,price,link,image_link,brand`
Mesmos dados em formato tabulado.

**Headers de resposta**: `Content-Type: application/xml` (ou `text/csv`), sem CORS restritivo pois e um feed publico consumido por crawlers.

**Cache**: Header `Cache-Control: public, max-age=3600` para que plataformas nao sobrecarreguem a funcao.

### Entrada no `supabase/config.toml`

```toml
[functions.product-feed]
verify_jwt = false
```

---

## Epico 14: Painel de Vitrines Externas

### Novo componente: `src/components/marketing/ExternalShowcasesSection.tsx`

Dois cards lado a lado (ou empilhados no mobile):

**Card Google Shopping**:
- Icone Google + titulo "Google Shopping"
- Subtitulo: "Apareca de graca nas buscas de produtos do Google"
- Campo com o link do feed XML (read-only) + botao "Copiar Link"
- Botao "Como configurar" que abre Dialog com 3 passos:
  1. Acesse merchant.google.com e crie uma conta
  2. Va em Produtos > Feeds > Adicionar feed
  3. Selecione "Feed agendado (URL)" e cole o link copiado

**Card Meta/Instagram Shop**:
- Icone Instagram + titulo "Instagram & Facebook Shop"
- Subtitulo: "Habilite a sacolinha no seu perfil do Instagram"
- Campo com o link do feed CSV (read-only) + botao "Copiar Link"
- Botao "Como configurar" que abre Dialog com 3 passos:
  1. Acesse business.facebook.com > Gerenciador de Comercio
  2. Adicione um Catalogo > Feed de dados
  3. Cole o link copiado e agende atualizacoes diarias

Ambos os links sao gerados automaticamente: `{SUPABASE_URL}/functions/v1/product-feed?store_id={storeSettings.id}&token={storeSettings.feed_token}&format=google|meta`

Se o `feed_token` nao existir, o componente gera um ao montar (mutation que faz UPDATE no store_settings com um token aleatorio).

### Integracao na pagina Marketing

Nova aba **"Vitrines"** (8a aba) com icone `Store` entre "Anuncios" e "Contatados":
- Renderiza `ExternalShowcasesSection`
- Inclui badge "Novo" para chamar atencao

---

## Detalhes Tecnicos

### Arquivos criados

1. `supabase/functions/product-feed/index.ts` -- Edge Function principal
2. `src/components/marketing/ExternalShowcasesSection.tsx` -- UI dos cards

### Arquivos alterados

1. `supabase/config.toml` -- adicionar entrada product-feed
2. `src/pages/Marketing.tsx` -- adicionar aba "Vitrines" com o componente
3. Nova migracao SQL para adicionar `feed_token` ao `store_settings`

### URLs dos Feeds (resumo)

| Feed | URL |
|------|-----|
| Google Shopping (XML) | `{SUPABASE_URL}/functions/v1/product-feed?store_id={id}&token={token}&format=google` |
| Meta Commerce (CSV) | `{SUPABASE_URL}/functions/v1/product-feed?store_id={id}&token={token}&format=meta` |

### Regra Always Profit

Produtos com `stock_quantity = 0` sao automaticamente excluidos do feed. Se o produto tem variantes, o sistema verifica se a soma total das variantes e > 0. O feed reflete o estado em tempo real do banco.

### Sequencia de implementacao

1. Migracao: adicionar `feed_token` a `store_settings`
2. Criar Edge Function `product-feed` com geracao XML e CSV
3. Criar componente `ExternalShowcasesSection`
4. Atualizar `Marketing.tsx` com nova aba "Vitrines"
