
# Integracao de APIs de Cotacao de Frete (Melhor Envio + SuperFrete) - Plano Revisado

## Resumo

Integrar as APIs do **Melhor Envio** e **SuperFrete** para cotacao automatica de frete. Os tokens de cada servico serao armazenados **por usuario** na tabela `profiles`, seguindo o mesmo padrao ja usado para chaves de IA (gemini_api_key, openai_api_key). Cada usuario configura seus proprios tokens na pagina de Configuracoes.

## Parte 1: Novas colunas no banco de dados

### Tabela `profiles` - novos campos

```text
origin_zip              (text, nullable)    - CEP de origem para calculo de frete
melhor_envio_token      (text, nullable)    - Token pessoal do Melhor Envio
superfrete_token        (text, nullable)    - Token pessoal do SuperFrete
```

### Tabela `products` - novos campos

```text
weight_grams    (integer, nullable) - Peso em gramas
width_cm        (integer, nullable) - Largura em cm
height_cm       (integer, nullable) - Altura em cm
length_cm       (integer, nullable) - Comprimento em cm
```

## Parte 2: Configuracoes do Usuario (Settings.tsx)

Criar uma nova secao **"Integracao de Frete"** na pagina de Configuracoes, seguindo o mesmo visual das secoes de IA e Seguranca ja existentes. Contera:

1. **CEP de Origem** - Campo de texto para o CEP de onde saem os produtos
2. **Token Melhor Envio** - Campo com mascara e botao olho (igual ao padrao das chaves de IA), com link "Obter token" apontando para melhorenvio.com.br
3. **Token SuperFrete** - Mesmo formato, com link para superfrete.com
4. Botao "Salvar Configuracoes de Frete"

Os tokens ficam salvos na tabela `profiles` do usuario, nao como secrets globais.

Criar um novo componente: `src/components/settings/ShippingSettingsSection.tsx`

## Parte 3: Peso e Dimensoes dos Produtos

Adicionar campos no `ProductFormDialog.tsx`:
- Peso (g), Largura (cm), Altura (cm), Comprimento (cm)
- Secao colapsavel "Peso e Dimensoes (para calculo de frete)"

## Parte 4: Edge Function `quote-shipping`

Criar `supabase/functions/quote-shipping/index.ts` que:

1. Recebe no body: `origin_zip`, `destination_zip`, `products[]`, `melhor_envio_token`, `superfrete_token`
2. Os tokens vem do frontend (lidos do profile do usuario), passados na requisicao
3. Consulta em paralelo as APIs que tiverem token configurado:
   - **Melhor Envio**: `POST https://melhorenvio.com.br/api/v2/me/shipment/calculate`
   - **SuperFrete**: `POST https://api.superfrete.com/api/v0/calculator`
4. Unifica, ordena por preco e retorna as opcoes
5. Se uma API falhar, retorna os resultados da outra
6. Se ambas falharem, retorna erro amigavel
7. Timeout de 10 segundos por API

### Seguranca
- Os tokens sao enviados pelo frontend por requisicao (nao ficam como secrets globais)
- A edge function nao armazena nada, apenas proxia as chamadas
- `verify_jwt = false` no config.toml, mas valida autenticacao via `getClaims()`

## Parte 5: Interface no ShippingSection

Quando o usuario seleciona "Postagem":

1. Se o cliente tem CEP, usa automaticamente
2. Botao **"Cotar Frete"** aparece (somente se o usuario tem pelo menos 1 token configurado e o CEP de origem esta definido)
3. Ao clicar, chama a edge function com os tokens do profile
4. Exibe lista de opcoes como cards selecionaveis:
   - Transportadora + servico, preco, prazo, plataforma de origem
5. Ao selecionar, preenche automaticamente empresa e valor do frete
6. Continua com selecao de "quem paga"
7. Se nenhum token estiver configurado, mostra mensagem com link para Configuracoes

O campo de valor manual continua disponivel para quem preferir nao usar cotacao automatica.

## Parte 6: Query do Profile na pagina de Vendas

A pagina `Sales.tsx` ja busca dados de clientes. Precisamos tambem buscar o profile do usuario logado para obter `origin_zip`, `melhor_envio_token` e `superfrete_token`, e passar ao ShippingSection.

## Detalhes Tecnicos

### Migration SQL
1. Adicionar `origin_zip`, `melhor_envio_token`, `superfrete_token` na tabela `profiles`
2. Adicionar `weight_grams`, `width_cm`, `height_cm`, `length_cm` na tabela `products`

### Arquivos a Criar
1. `supabase/functions/quote-shipping/index.ts` - Edge function de cotacao
2. `src/components/settings/ShippingSettingsSection.tsx` - Secao de configuracao de frete

### Arquivos a Modificar
1. `src/pages/Settings.tsx` - Adicionar ShippingSettingsSection e buscar novos campos do profile
2. `src/components/stock/ProductFormDialog.tsx` - Campos de peso e dimensoes
3. `src/components/sales/ShippingSection.tsx` - Botao "Cotar Frete" e lista de opcoes
4. `src/pages/Sales.tsx` - Buscar profile do usuario para tokens e CEP origem
5. `supabase/config.toml` - Adicionar `[functions.quote-shipping]` com `verify_jwt = false`

### Fluxo do Usuario

1. Vai em Configuracoes e insere CEP de origem, token do Melhor Envio e/ou token do SuperFrete
2. Cadastra produto com peso e dimensoes
3. Abre nova venda, seleciona cliente com CEP
4. Escolhe "Postagem" como forma de envio
5. Clica em "Cotar Frete"
6. Ve opcoes: PAC R$18, SEDEX R$32, Jadlog R$22...
7. Seleciona a opcao desejada
8. Escolhe quem paga o frete
9. Finaliza a venda

### Tratamento de erros

- Se nenhum token configurado: "Configure seus tokens de frete em Configuracoes para usar a cotacao automatica."
- Se CEP de origem nao definido: "Configure seu CEP de origem em Configuracoes."
- Se uma API falhar: mostra resultados da outra
- Se ambas falharem: "Nao foi possivel cotar. Insira o valor manualmente."
- Se produtos sem peso/dimensoes: "Informe peso e dimensoes dos produtos para cotar o frete."
