# Adicionar Descrição do Produto ao Lightbox da "Minha Loja"

## Entendimento Atual

A página "Minha Loja" (StoreCatalog.tsx) possui:

- Um sistema de produtos em cards (na linha ~1640 do arquivo)
- Cada produto possui uma `description` no banco de dados (campo visível na interface `Product` - linha 85)
- Ao clicar na foto do produto, abre um **Lightbox Dialog** (linha 2188) que exibe:
  - A imagem/vídeo em modo expandido com navegação entre fotos
  - Informações do produto (nome, preço, tamanhos disponíveis, botão de compra)
  - Indicadores de marketing (promoção, pré-venda, lançamento)

## O que você quer adicionar?

A descrição do produto já está sendo carregada do banco de dados e está disponível para exibição. Precisamos clarificar alguns detalhes:

**Perguntas:**

1. **Posição**: descrição no lightbox **abaixo da imagem expandida**
2. **Truncamento**: 
  - Apenas as primeiras linhas com "Ver mais"?
3. **Estilo**: A descrição deve estar:
  - Em formato texto simples?
4. **Visibilidade**: Deve aparecer  apenas naqueles que têm descrição preenchida

