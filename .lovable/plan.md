

# Melhorar Visualizacao da Descricao no Lightbox

## Problema Atual

A descricao do produto esta sendo exibida como texto branco semi-transparente (`text-white/70`) diretamente sobre a imagem, com `line-clamp-2` sem opcao de expandir. Isso causa:
- Dificuldade de leitura quando a imagem tem cores claras
- Texto cortado sem possibilidade de ver o restante
- Visual "solto" sem delimitacao clara

## Solucao Proposta: Card com fundo e "Ver mais"

Manter a descricao na mesma posicao (abaixo do nome, sobre a imagem), mas:

1. Envolver nome + descricao em um card com fundo escuro semi-transparente e blur
2. Adicionar botao "Ver mais / Ver menos" para descricoes longas (mais de 100 caracteres)
3. Melhorar o contraste e espaçamento

### Mudanca em `src/pages/StoreCatalog.tsx`

**De (linhas 2260-2275):**
- Texto solto sobre a imagem sem fundo
- `line-clamp-2` sem expansao

**Para:**
- Container com `bg-black/50 backdrop-blur-sm rounded-xl p-4 mx-4 mb-4`
- Descricao com `line-clamp-3` por padrao
- Botao "Ver mais" que remove o clamp e mostra texto completo
- Botao "Ver menos" para recolher
- Estado `descriptionExpanded` controlando a expansao (resetado ao trocar de produto)

### Detalhes tecnicos

```text
<div className="absolute bottom-4 left-0 right-0 px-4">
  <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4 max-w-lg mx-auto">
    <p>Nome do produto + cor + contador</p>
    {description && (
      <>
        <p className={descriptionExpanded ? "" : "line-clamp-3"}>
          {item.description}
        </p>
        {item.description.length > 100 && (
          <button onClick={toggle}>Ver mais / Ver menos</button>
        )}
      </>
    )}
  </div>
</div>
```

- Adicionar estado `descriptionExpanded` (useState boolean)
- Resetar para `false` quando `selectedItem` mudar (useEffect existente ou novo)
- Estilo do botao: `text-white/60 text-xs mt-1 hover:text-white/90`
