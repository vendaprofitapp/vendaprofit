

# Favicon, Título da Página e Domínio Próprio por Usuário

## Resumo

Permitir que cada lojista personalize o favicon e o título que aparecem no navegador quando clientes visitam sua loja pública, além de documentar claramente como funciona o domínio personalizado (já parcialmente implementado).

---

## O que já existe

- O campo `custom_domain` já existe na tabela `store_settings` e é usado em vários pontos do código para gerar URLs.
- O campo `store_name` já existe e é exibido na loja pública.
- Não existe nenhum campo para favicon personalizado por loja.
- O `document.title` nunca é alterado dinamicamente no `StoreCatalog` -- sempre mostra "Venda PROFIT".

---

## Alterações

### 1. Migração de Banco de Dados

Adicionar duas colunas à tabela `store_settings`:

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `favicon_url` | text | NULL | URL do favicon personalizado da loja (armazenado no storage) |
| `page_title` | text | NULL | Título personalizado da aba do navegador (ex: "Loja da Maria") |

### 2. Storage

Usar o bucket `store-banners` (já existente e público) para uploads de favicon, ou criar um sub-path lógico (`favicons/`). Não é necessário criar um bucket novo.

### 3. StoreCatalog.tsx -- Título e Favicon Dinâmicos

Quando a loja pública é carregada (`StoreCatalog`):

- Adicionar um `useEffect` que, quando `store` estiver carregado:
  - Define `document.title` como `store.page_title || store.store_name || "Venda PROFIT"`
  - Se `store.favicon_url` existir, cria/atualiza um `<link rel="icon">` no `<head>` com o href apontando para a imagem da loja
  - No cleanup do `useEffect`, restaura o título e favicon originais do Venda PROFIT

### 4. StoreSettings.tsx -- Campos de Configuração

Adicionar na secção "Informações Básicas" (ou em nova secção "Identidade do Navegador"):

- **Título da Página**: Input de texto para `page_title` com placeholder "Ex: Loja da Maria"
- **Favicon**: Upload de imagem (aceitar .ico, .png, .svg até 256KB) que faz upload para `store-banners/{owner_id}/favicon.png` e salva a URL pública em `favicon_url`
- Pré-visualização do favicon ao lado do input
- Texto explicativo: "O favicon é o ícone que aparece na aba do navegador quando seus clientes acessam sua loja"

Incluir estes campos no `formData`, no `handleSubmit` (tanto insert quanto update) e na query inicial.

### 5. PublicBag.tsx -- Mesmo comportamento

Aplicar a mesma lógica de título/favicon dinâmico na página de bolsa consignada (`PublicBag`), usando os dados do dono da bolsa.

### 6. Domínio Próprio -- Documentação na UI

O campo `custom_domain` já existe e funciona para gerar URLs. Adicionar na secção de "Link da Loja" no `StoreSettings`:

- Texto explicativo: "Para conectar um domínio próprio (ex: minhaloja.com.br), entre em contato com o suporte para configuração DNS."
- O campo já salva o domínio e é usado nos links gerados -- basta melhorar a UX com instruções claras.

---

## Detalhes Técnicos

### Arquivos criados

Nenhum arquivo novo necessário.

### Arquivos alterados

1. **Nova migração SQL** -- adicionar `favicon_url` e `page_title` ao `store_settings`
2. **`src/pages/StoreCatalog.tsx`** -- useEffect para document.title + favicon dinâmico
3. **`src/pages/StoreSettings.tsx`** -- campos de configuração na UI + lógica de upload do favicon + inclusão nos submits
4. **`src/pages/PublicBag.tsx`** -- useEffect para title/favicon (opcional, se usar dados da loja)

### Sequência de implementação

1. Migração: adicionar colunas `favicon_url` e `page_title`
2. Atualizar `StoreSettings.tsx` com os novos campos e upload
3. Atualizar `StoreCatalog.tsx` com useEffect de título/favicon
4. Atualizar `PublicBag.tsx` com a mesma lógica

