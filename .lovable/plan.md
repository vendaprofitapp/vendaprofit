

# Corrigir Relatorios de Vendas com Parcerias

## Problemas Identificados

### 1. Contas nao batem (splits != total da venda)
Vendas com desconto geram splits calculados sobre o preco cheio, nao sobre o valor liquido apos desconto:
- Venda R$451,25 tem splits somando R$475 (diferenca de R$23,75 = desconto aplicado)
- Venda R$280 tem splits somando R$267 (diferenca de R$12,85)

**Causa**: O `profitEngine` recebe o preco bruto, mas a venda tem desconto que nao esta sendo repassado para o calculo dos splits. Os splits deveriam ser calculados sobre `sale.total` (pos-desconto), nao sobre a soma dos `sale_items.total`.

### 2. Relatorio de Vendas (Reports.tsx) ignora parceria
O relatorio principal calcula lucro como `preco_venda - custo`, mostrando 100% do lucro como se fosse da vendedora, quando na verdade 30% pertence a socia. Nao consulta `financial_splits`.

**Correcao**: Para vendas que possuem `financial_splits`, usar o valor do split do usuario como "Meu Lucro Real" em vez do calculo simples.

### 3. Nomenclaturas genericas nos splits
As descricoes dizem "sócia" e "vendedora" sem identificar QUEM:
- "Lucro 30% socia (parceria)" deveria ser "Lucro 30% Isabelle Santos (parceria)"
- "Lucro 70% vendedora (parceria)" deveria ser "Lucro 70% Camila Nogueira (parceria)"

### 4. PartnerReports.tsx com labels confusos
- Cards dizem "Devo as Parceiras" sem mostrar o nome
- Tabelas dizem "Meu Ganho" / "Devo" sem contexto claro
- A coluna "Ganho Dela" nao mostra o nome da parceira

## Plano de Correcao

### Parte 1 - Corrigir calculo dos splits na criacao da venda

**Arquivo**: `src/pages/Sales.tsx` (onde a venda e criada e os splits sao gerados)

- Ao chamar `calculateSaleSplits`, passar o `salePrice` como o valor TOTAL da venda (pos-desconto), nao a soma dos itens
- Isso garante que os splits somem exatamente ao total da venda
- Para vendas com multiplos itens de parceria, distribuir o desconto proporcionalmente

### Parte 2 - Incluir nomes reais nas descricoes dos splits

**Arquivo**: `src/pages/Sales.tsx` (onde os splits sao inseridos no `financial_splits`)

- Ao criar os registros em `financial_splits`, substituir "socia" e "vendedora" pelos nomes reais das parceiras
- Buscar o perfil da parceira antes de gerar as descricoes
- Exemplo: "Lucro 30% Isabelle Santos (parceria)" em vez de "Lucro 30% socia (parceria)"

### Parte 3 - Reports.tsx: Usar financial_splits para lucro real

**Arquivo**: `src/pages/Reports.tsx`

- Adicionar query para buscar `financial_splits` do usuario no periodo
- Na tabela detalhada, adicionar coluna "Meu Lucro (Parceria)" que mostra apenas a parte do usuario
- Nas estatisticas totais, subtrair a parte que pertence a socia do "Lucro Real"
- Adicionar indicador visual (badge) quando uma venda envolve parceria

### Parte 4 - PartnerReports.tsx: Nomenclatura clara com nomes

**Arquivo**: `src/pages/PartnerReports.tsx`

Substituir labels genericos por nomes:
- "Devo as Parceiras" -> "Devo a [Nome da Parceira]" (quando ha apenas 1 parceira)
- Card de resumo: mostrar foto/nome da parceira
- Tabelas: trocar "Parceira" por nome real, "Meu Ganho" por "[Seu nome] recebe", "Devo" por "Pagar a [Nome]"
- Coluna "Ganho Dela" -> "Ganho de [Nome]"
- Adicionar subtitulo nos cards com o nome da parceria ativa

### Parte 5 - AccountSettlement.tsx: Nomes nos resumos

**Arquivo**: `src/components/reports/AccountSettlement.tsx`

- No card "A Pagar", mostrar "A Pagar para [Nome]" quando ha apenas 1 parceira
- Nos itens do acerto, incluir nome do produto e da parceira na descricao
- No texto do WhatsApp, usar nomes reais

### Parte 6 - Corrigir splits existentes (dados historicos)

- Criar uma query SQL de correcao para atualizar as descricoes dos splits existentes, trocando "socia" e "vendedora" pelos nomes reais
- Recalcular splits de vendas com desconto que estao com valores incorretos

## Detalhes Tecnicos

### Arquivos Modificados

1. **`src/pages/Sales.tsx`** - Corrigir o calculo passando valor pos-desconto e incluir nomes reais
2. **`src/pages/Reports.tsx`** - Integrar `financial_splits` no calculo de lucro
3. **`src/pages/PartnerReports.tsx`** - Trocar labels genericos por nomes das parceiras
4. **`src/components/reports/AccountSettlement.tsx`** - Nomes nos cards e resumos
5. **Migration SQL** - Corrigir splits historicos com valores e descricoes erradas

### Logica de Correcao dos Splits Existentes (SQL)

Para cada venda com desconto onde splits != total:
1. Calcular a diferenca (splits_total - sale_total)
2. Redistribuir proporcionalmente entre os splits de profit_share
3. Atualizar descricoes com nomes reais das parceiras

### Impacto nos Numeros

Apos a correcao:
- **Camila** vera seus ganhos REAIS (70% do lucro), nao 100%
- **Isabelle** vera seus ganhos REAIS (30% do lucro quando Camila vende, 70% quando ela vende)
- O "Acerto de Contas" tera valores que batem entre as duas
- Ambas verao o nome da parceira em vez de "socia/vendedora"

