

# Correcao: Loja em Branco para a Usuaria dayana_tbperez@hotmail.com

## Problema Identificado

A usuaria possui **dois registros** na tabela `store_settings` para o mesmo `owner_id`:

| ID | Slug | Nome | Criado em |
|---|---|---|---|
| 4d8bd952... | pwrdatibaia | PWRD Atibaia | 02/02/2026 |
| c8e3ae87... | pwrd-atibaia | PWRD Atibaia | 18/02/2026 |

A query usa `.maybeSingle()`, que retorna erro quando mais de uma linha e encontrada. Isso faz com que `storeSettings` fique `null`, mostrando tudo em branco e impedindo salvar (pois o sistema tenta criar um terceiro registro, que tambem falha).

Nenhuma outra usuaria tem registros duplicados.

## Solucao

Duas acoes:

### 1. Remover o registro duplicado (dados)
Deletar o registro mais antigo (sem slug com hifen), mantendo o mais recente que a usuaria provavelmente criou por ultimo.

Executar via ferramenta de dados:
```sql
DELETE FROM store_settings WHERE id = '4d8bd952-6dbc-4699-b520-521eb75b5147';
```

### 2. Prevenir duplicatas futuras (schema)
Adicionar uma constraint `UNIQUE` na coluna `owner_id` da tabela `store_settings` para garantir que cada usuario tenha no maximo um registro de loja. Isso impede que o bug se repita.

```sql
ALTER TABLE store_settings ADD CONSTRAINT store_settings_owner_id_unique UNIQUE (owner_id);
```

Tambem ajustar a mutacao de criacao no `StoreSettings.tsx` para usar `upsert` ao inves de `insert`, como camada extra de protecao.

## Arquivos a Alterar

### `src/pages/StoreSettings.tsx`
- Na secao de criacao (linhas 561-596), trocar `.insert(...)` por `.upsert(...)` para que, caso ja exista um registro para o `owner_id`, ele seja atualizado ao inves de duplicado.

## Impacto
- Corrige imediatamente o problema da usuaria
- Previne que qualquer outro usuario tenha o mesmo problema no futuro
- Nenhuma outra funcionalidade e afetada

