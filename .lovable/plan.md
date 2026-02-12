
# Links Filtrados por Categoria no Catálogo da Loja

## O que será feito

Permitir que lojistas compartilhem links do catálogo já filtrados por categoria ou subcategoria. Por exemplo:
- `vendaprofit.lovable.app/minha-loja?categoria=Feminino` -- abre mostrando só produtos femininos
- `vendaprofit.lovable.app/minha-loja?categoria=Feminino&sub=Tops` -- abre mostrando só tops femininos

## Como funciona hoje

Os filtros de categoria são estados locais do React (`useState`). Quando o cliente acessa o link da loja, sempre começa sem filtros -- vendo todos os produtos.

## Mudanças necessárias

### Arquivo: `src/pages/StoreCatalog.tsx`

1. **Importar `useSearchParams`** do `react-router-dom` para ler parâmetros da URL
2. **Inicializar os filtros a partir da URL**: ao carregar a pagina, ler os parametros `categoria` e `sub` da URL e usar como valores iniciais de `selectedMainCategory` e `selectedSubcategory`
3. **Sincronizar URL com filtros**: quando o usuario clicar nas badges de categoria/subcategoria, atualizar tambem os parametros da URL (sem recarregar a pagina), para que o link possa ser copiado e compartilhado a qualquer momento
4. **Adicionar botao de copiar link filtrado**: um pequeno botao ao lado dos filtros ativos que copia o link atual (com os filtros aplicados) para a area de transferencia, facilitando o compartilhamento

### Experiencia do usuario

- Cliente recebe um link como `vendaprofit.lovable.app/minhaloja?categoria=Feminino&sub=Tops`
- Ao abrir, o catalogo ja mostra filtrado por "Feminino > Tops"
- As badges de categoria ja aparecem selecionadas
- O cliente pode mudar os filtros normalmente, e a URL se atualiza automaticamente

## Detalhes tecnicos

```text
URL: /:slug?categoria=Feminino&sub=Tops

useSearchParams() -> le "categoria" e "sub"
  |
  v
useState inicializa com valores da URL
  |
  v
Ao clicar em categoria -> setSelectedMainCategory + setSearchParams
```

- Usar `useSearchParams` do react-router-dom (ja instalado)
- Os nomes dos parametros serao `categoria` e `sub` (amigaveis em portugues)
- A sincronizacao sera bidirecional: URL -> estado (ao carregar) e estado -> URL (ao clicar)
- Um `useEffect` fara a leitura inicial dos parametros
- O botao de copiar link usara `navigator.clipboard.writeText()`
