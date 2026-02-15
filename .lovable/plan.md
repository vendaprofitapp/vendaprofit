
# Conexao B2B e URL de Produto para Dropshipping

## Diagnostico

O sistema B2B ja esta implementado no codigo, porem:
1. Nenhum fornecedor tem `b2b_enabled = true` nem `b2b_url` preenchida no banco
2. Nenhum produto tem `b2b_product_url` preenchida
3. Falta um botao para testar se a conexao com o site do fornecedor funciona antes de ativar

## O que sera feito

### 1. Botao "Testar Conexao" no cadastro de fornecedor

No formulario de fornecedor (Suppliers.tsx), ao lado da URL do Portal B2B, sera adicionado um botao **"Testar Conexao"** que:
- Usa o Firecrawl (ja configurado) para acessar a URL informada
- Se conseguir acessar e extrair conteudo, mostra mensagem de sucesso verde
- Se falhar, mostra mensagem de erro vermelha com orientacao
- Isso da confianca ao usuario de que a URL esta correta antes de ativar o toggle

### 2. Campo "URL do Produto B2B" mais visivel no cadastro de produto

O campo ja existe em ProductFormDialog.tsx (linha 748-761), mas so aparece quando um fornecedor esta selecionado. Sera melhorado:
- Adicionar icone visual mais chamativo
- Adicionar botao "Testar URL" ao lado do campo, que chama a Edge Function `check-b2b-stock` para verificar se o produto esta disponivel no fornecedor
- Mostrar feedback visual do resultado do teste

### 3. Verificacao na listagem de fornecedores

Na tabela de fornecedores, ao lado do toggle B2B, mostrar um indicador visual (icone verde/vermelho) de se o fornecedor tem URL B2B configurada, para lembrar o usuario de preencher.

## Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Suppliers.tsx` | Botao "Testar Conexao" no formulario B2B + indicador na listagem |
| `src/components/stock/ProductFormDialog.tsx` | Botao "Testar URL" no campo b2b_product_url |

## Detalhes Tecnicos

### Botao "Testar Conexao" (Suppliers.tsx)
```text
// Ao clicar no botao, chama a Edge Function firecrawl-scrape com a URL do portal B2B
// Se retornar sucesso (pagina acessivel), mostra toast de sucesso
// Se falhar, mostra toast de erro
const testConnection = async () => {
  const response = await supabase.functions.invoke('firecrawl-scrape', {
    body: { url: formData.b2b_url, options: { formats: ['markdown'] } }
  });
  // Verifica se retornou conteudo
};
```

### Botao "Testar URL" (ProductFormDialog.tsx)
```text
// Chama a Edge Function check-b2b-stock com o product_id (se editando)
// Ou faz um scrape direto da URL informada (se produto novo)
const testB2bUrl = async () => {
  const response = await supabase.functions.invoke('firecrawl-scrape', {
    body: { url: form.b2b_product_url, options: { formats: ['markdown'] } }
  });
  // Mostra se a pagina do produto esta acessivel
};
```

### Indicador na listagem
Na coluna "B2B Ativo", alem do Switch, mostrar um icone de alerta se `b2b_url` estiver vazia (lembrete para configurar).
