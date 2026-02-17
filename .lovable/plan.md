
# Filtrar Vendas na Tela "Registrar Vendas"

## Problema

A query de vendas na pagina `/sales` busca todas as vendas sem filtrar por usuario. Como as politicas de RLS permitem que socias vejam vendas umas das outras (necessario para os relatorios de sociedade), vendas de parceiras tambem aparecem nessa tela.

## Solucao

Adicionar `.eq("owner_id", user.id)` na query de vendas em `src/pages/Sales.tsx`. Isso garante que apenas as vendas registradas pela propria usuaria aparecam nessa tela, enquanto os relatorios de sociedade continuam mostrando os dados cruzados normalmente.

## Mudanca

### Arquivo: `src/pages/Sales.tsx` (linha ~221-224)

```
// De:
const { data, error } = await supabase
  .from("sales")
  .select("*")
  .order("created_at", { ascending: false });

// Para:
const { data, error } = await supabase
  .from("sales")
  .select("*")
  .eq("owner_id", user?.id)
  .order("created_at", { ascending: false });
```

Isso tambem corrigira automaticamente os cards de resumo (Vendas Hoje, Vendas do Mes, Ticket Medio), pois eles sao calculados a partir dos mesmos dados.

| Arquivo | Acao |
|---------|------|
| `src/pages/Sales.tsx` | Adicionar filtro `owner_id` na query de vendas |
