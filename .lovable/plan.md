
# 4 Melhorias no Catálogo do Ponto Parceiro

## Visão geral das mudanças

1. Remover captura de lead ao adicionar ao carrinho; pedir dados apenas na finalização da compra
2. Exibir layout completo da loja (banner, categorias, filtros) com apenas os produtos do parceiro
3. Novo botão "Acesso ao estoque completo" na área de filtros de marketing
4. Ao clicar no botão, redirecionar para "Minha Loja" com opção de Bolsa Consignada

---

## 1. Remover lead ao adicionar ao carrinho

### Problema atual

A função `addToCart` em `PartnerCatalog.tsx` verifica o localStorage e, se não houver lead salvo, bloqueia a adição e abre o `LeadCaptureSheet`. Isso ocorre antes de qualquer compra.

### Solução

- Remover toda a verificação de lead no `addToCart` — chamar sempre `doAddToCart` diretamente, sem verificar `getStoredLead()`.
- Remover os estados `showLeadCapture` e `pendingAdd`, bem como o componente `<LeadCaptureSheet>` da página.
- Remover o import do `LeadCaptureSheet`.
- O `PartnerCheckoutPasses` já solicita os dados na tela de finalização se não houver lead. O callback `onCustomerCaptured` permanece para salvar o lead nesse momento.

---

## 2. Layout completo da loja no Catálogo do Ponto Parceiro

### Problema atual

O `PartnerCatalog.tsx` tem um header minimalista simples, sem banner proporcional, sem categorias, sem filtros de marketing, sem nome da loja/logo em destaque — diferente do visual rico do `StoreCatalog`.

### Solução

Recriar o header e a seção de navegação do `PartnerCatalog.tsx` seguindo o padrão do `StoreCatalog`:

**Header completo:**
- Logo com tamanho e posição configuráveis (`logo_position`, `logo_size`)
- Nome da loja se não houver logo
- Carrinho flutuante no canto

**Banner:**
- Banner responsivo (mobile/desktop) com altura configurável
- Exibido apenas se `is_banner_visible === true`
- Badge informativo do ponto parceiro logo abaixo do banner

**Filtros de categorias:**
- Carregar `main_categories` e `subcategories` da base
- Exibir pills de Categoria Principal (Todos + cada categoria)
- Ao selecionar uma categoria, revelar subcategorias
- Filtrar os `products` do parceiro por `main_category` / `subcategory`

**Barra de busca:**
- Manter a busca atual por nome

Os produtos exibidos continuam sendo **apenas os itens alocados no ponto parceiro** — a diferença é visual, não de dados.

---

## 3. Botão "Acesso ao estoque completo"

### Onde aparece

Na linha de filtros de marketing do `StoreCatalog`, os botões são: "Todos", "Oportunidades", "Pré-venda", "Lançamentos", "Área VIP".

No `PartnerCatalog`, no lugar desses filtros de marketing (que não fazem sentido aqui, pois não há dados de marketing nos itens do parceiro), será exibido um único botão estilizado:

```
🏪 Ver estoque completo
```

Com estilo de badge chamativo (cor primária, ícone `Store` ou `Package`).

---

## 4. Redirecionar para "Minha Loja" com opção de Bolsa Consignada

### Fluxo ao clicar em "Acesso ao estoque completo"

O `PartnerCatalog` já conhece o `store_slug` da loja dona (via `store_settings`). O botão irá:

1. Buscar o `store_slug` da `store_settings` do `owner_id` do ponto parceiro (já está carregado na query da página)
2. Abrir um **Dialog** de transição com a mensagem:

```
Você está prestes a acessar o estoque completo de [Nome da Loja].

Deseja solicitar uma Malinha Consignada para deixar no [Nome do Ponto Parceiro]?
```

Dois botões:
- **"Ver catálogo completo"** → navegar para `/{store_slug}` (nova aba ou mesma)
- **"Solicitar Malinha Consignada"** → navegar para `/{store_slug}?modo=consignado&ponto={partnerPoint.name}` (a loja principal pode exibir um aviso especial nesse modo — implementação mínima por ora: leva ao catálogo com a mensagem no URL para futura integração)

> Nota: a integração completa de Bolsa Consignada via Ponto Parceiro é complexa (exige criar a consignação com endereço do ponto, não do cliente). Por ora, o botão de "Malinha" leva ao catálogo com um parâmetro de URL `?consignado=1&ponto=NomeDoPonto` que futuramente pode ser usado para pré-preencher os dados. O comportamento atual do catálogo não muda.

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/PartnerCatalog.tsx` | (1) Remover lead ao adicionar; (2) Adicionar layout completo (banner, header, categorias); (3+4) Adicionar botão e dialog de acesso ao estoque completo |

Nenhuma migration de banco necessária. O `store_slug` já é carregado via `store_settings`.

---

## Detalhes técnicos

**Carregar store_slug:**
```ts
// Na query de store_settings, adicionar store_slug ao select
const { data: storeData } = await supabase
  .from("store_settings")
  .select("id, owner_id, store_name, store_slug, whatsapp_number, logo_url, banner_url, ...")
  .eq("owner_id", pp.owner_id)
  .maybeSingle();
```

**Filtro de categorias nos produtos do parceiro:**
Os produtos já possuem o campo `main_category` (ou `category`). A query de produtos precisa incluir `main_category` e `subcategory`:
```ts
.select("id, name, price, image_url, image_url_2, image_url_3, video_url, category, description, size, main_category, subcategory")
```

**Lógica de filtro:**
```ts
const filtered = products.filter(p => {
  const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
  const matchMain = !selectedMain || p.main_category === selectedMain;
  const matchSub = !selectedSub || p.subcategory === selectedSub;
  return matchSearch && matchMain && matchSub;
});
```
