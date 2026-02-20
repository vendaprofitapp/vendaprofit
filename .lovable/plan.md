
## Correção: Trigger do Botconversa não dispara para leads reais

### Causa raiz

A função de banco `call_botconversa_notify` usa `extensions.http_post()`, que requer a extensão **http** do PostgreSQL. Porém, essa extensão **não está instalada** no projeto — apenas a extensão **pg_net** está disponível.

O que acontece:
1. O teste manual pela tela de admin funciona porque chama a Edge Function **diretamente** via `supabase.functions.invoke()` (JavaScript no navegador)
2. Um lead real criado pelo catálogo aciona o **trigger do banco** -> chama `call_botconversa_notify` -> tenta `extensions.http_post()` -> **FALHA** porque a extensão não existe -> o `EXCEPTION WHEN OTHERS` engole o erro silenciosamente
3. Resultado: nenhum log, nenhuma notificação, sem mensagem de erro visível

### Solução

Trocar `extensions.http_post()` por `net.http_post()` (da extensão `pg_net` que já está instalada). A assinatura da função é ligeiramente diferente.

### Mudança (Migration SQL)

Recriar a função `call_botconversa_notify` usando `net.http_post`:

```sql
CREATE OR REPLACE FUNCTION public.call_botconversa_notify(...)
  ...
  -- De:
  PERFORM extensions.http_post(url, body, headers);

  -- Para:
  PERFORM net.http_post(
    url := _project_url || '/functions/v1/botconversa-notify',
    body := jsonb_build_object(...),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
```

A função `net.http_post` do `pg_net` aceita os mesmos parâmetros (`url`, `body` como `jsonb`, `headers` como `jsonb`), mas o `body` deve ser passado como `jsonb` (não como `text`).

### Arquivo modificado

| Tipo | O quê |
|---|---|
| Migration SQL | Recriar `call_botconversa_notify` trocando `extensions.http_post` por `net.http_post` |

Nenhum arquivo de código-fonte precisa ser alterado. Apenas a função de banco.
