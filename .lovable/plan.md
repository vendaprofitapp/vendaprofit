# Formas de Envio no Lancamento de Vendas

## Resumo

Adicionar uma secao "Forma de Envio" no formulario de nova venda, com 4 opcoes: Presencial, Postagem, Aplicativos (Uber/99) e Outros. Inclui cadastro de endereco nos clientes, integracao futura com APIs de transportadoras, e logica financeira que trata o frete como despesa e/ou receita dependendo de quem paga.

## Parte 1: Adicionar Endereco ao Cadastro de Clientes

### Novas colunas na tabela `customers`

```text
address_street    (text, nullable) - Rua/Logradouro
address_number    (text, nullable) - Numero
address_complement (text, nullable) - Complemento
address_neighborhood (text, nullable) - Bairro
address_city      (text, nullable) - Cidade
address_state     (text, nullable) - Estado (UF)
address_zip       (text, nullable) - CEP
```

### Mudanca em `Customers.tsx`

- Adicionar campos de endereco no formulario de cadastro/edicao de cliente
- Secao colapsavel "Endereco de Entrega" com os campos acima

## Parte 2: Novas colunas na tabela `sales`

```text
shipping_method     (text, nullable)  - "presencial" | "postagem" | "app" | "outros"
shipping_company    (text, nullable)  - Nome da empresa (Correios, Uber, etc)
shipping_cost       (numeric, default 0) - Valor do frete
shipping_payer      (text, nullable)  - "seller" | "buyer"
shipping_address    (text, nullable)  - Endereco completo de entrega (texto formatado)
shipping_notes      (text, nullable)  - Observacoes do envio / campo texto livre para "Outros"
shipping_tracking   (text, nullable)  - Codigo de rastreio (preenchido depois, se aplicavel)
```

## Parte 3: Interface no Formulario de Venda

Adicionar uma secao **"Forma de Envio"** entre as observacoes e os totais, no lado direito do formulario de nova venda (`Sales.tsx`).

### Opcao 1: Presencial

- Seleciona e pronto, sem campos adicionais
- Nenhum custo de frete adicionado

### Opcao 2: Postagem

1. **Endereco**: Se um cliente cadastrado esta selecionado e tem endereco, preenche automaticamente. Senao, abre campos para digitar
2. **Empresa de postagem**: Campo de texto livre para informar (Correios, Jadlog, etc). Futuramente conectaremos APIs de cotacao
3. **Valor do frete**: Input numerico
4. **Quem paga**: Radio com "Vendedora" ou "Compradora"
  - Se **Vendedora**: valor do frete entra APENAS como despesa da venda (reduz lucro)
  - Se **Compradora**: valor do frete e somado ao total da venda (entra nos recebidos) E tambem registrado como despesa (pois a vendedora paga a transportadora)

### Opcao 3: Aplicativos (Uber, 99, etc)

1. Mesmos campos da Postagem (endereco, empresa, valor, quem paga)
2. **Aviso adicional exibido**: "Responsabilidade do Cliente: A partir do momento em que a encomenda e entregue ao prestador de servico, a responsabilidade e do cliente."
3. Mesma logica financeira de quem paga

### Opcao 4: Outros

1. **Descricao**: Campo de texto livre para descrever a forma de envio
2. **Valor**: Input numerico
3. **Quem paga**: Mesmo radio (Vendedora/Compradora), mesma logica

### Logica Financeira do Frete

Quando `shipping_payer = "buyer"` (compradora paga):

- O valor do frete e SOMADO ao total da venda (`sale.total += shipping_cost`)
- Uma despesa automatica e criada na tabela `expenses` com:
  - `category = "frete"`
  - `category_type = "variable"`
  - `amount = shipping_cost`
  - Vinculo ao sale_id via campo description

Quando `shipping_payer = "seller"` (vendedora paga):

- O total da venda NAO muda
- Uma despesa automatica e criada na tabela `expenses` com mesma logica acima

Resultado: o frete sempre aparece como despesa operacional no DRE, e quando o comprador paga, tambem aparece como receita.

## Parte 4: Exibicao nas Vendas Existentes

- Na visualizacao de detalhes da venda (dialog de "Ver Venda"), mostrar a secao de envio com todos os dados preenchidos
- No `EditSaleDialog`, permitir editar os dados de envio
- Na listagem de vendas, mostrar icone indicativo do tipo de envio

## Detalhes Tecnicos

### Migration SQL

1. Adicionar colunas de endereco na tabela `customers`
2. Adicionar colunas de shipping na tabela `sales`

### Arquivos a Criar

1. `**src/components/sales/ShippingSection.tsx**` - Componente da secao "Forma de Envio" com toda a logica condicional dos 4 tipos

### Arquivos a Modificar

1. `**src/pages/Sales.tsx**` - Integrar ShippingSection no formulario de nova venda, ajustar calculo de total para incluir frete quando comprador paga, criar despesa automatica ao finalizar venda
2. `**src/pages/Customers.tsx**` - Adicionar campos de endereco no formulario de cliente
3. `**src/components/sales/EditSaleDialog.tsx**` - Exibir e permitir editar dados de envio

### Fluxo do Usuario

1. Abre "Nova Venda" e adiciona produtos ao carrinho
2. Seleciona cliente cadastrado (endereco puxa automaticamente)
3. Em "Forma de Envio", escolhe "Postagem"
4. Sistema preenche endereco do cliente automaticamente
5. Digita "Correios" como empresa, R$25,00 como valor
6. Seleciona "Compradora paga"
7. O total da venda atualiza: Subtotal + R$25,00 de frete
8. Finaliza a venda e sistema abre a opção de enviar as informações do envio em caso de Postagem, aplicativos ou outros para o whatsapp do cliente (cadastrado no sistema)  

9. Sistema cria automaticamente uma despesa de R$25,00 (frete) na tabela expenses
10. No DRE: os R$25,00 aparecem tanto em Receita (recebido do cliente) quanto em Despesas (pagamento do frete)

### Sobre APIs de Transportadoras

A integracao com APIs de cotacao de frete (Correios, Jadlog, Uber, 99) sera implementada em uma fase futura. Por ora, o usuario informa manualmente a empresa e o valor. A estrutura ja esta preparada para receber dados automaticos quando as APIs forem conectadas.