
## Melhorar a seção de teste do Botconversa

### Problema identificado
O botão "Testar agora" depende do telefone cadastrado no perfil do admin logado (tabela `profiles.phone`). Se o campo estiver vazio, o botão fica desabilitado. Não há como inserir um número diretamente na tela de Integrações para testes rápidos.

### Como a integração busca o telefone de cada usuária
A Edge Function `botconversa-notify` recebe um `owner_id` e busca `profiles.phone` para aquela usuária. Se não encontrar telefone, registra status `skipped`. Isso acontece tanto nos testes manuais quanto nos disparos automáticos dos triggers de banco.

### Solução proposta

**Arquivo: `src/components/admin/BotconversaAdminSection.tsx`**

1. Adicionar um campo de input de telefone diretamente na seção "Enviar mensagem de teste"
   - Pré-preencher automaticamente com o telefone do perfil do admin (se existir)
   - Permitir editar/digitar qualquer número diretamente ali, sem precisar sair da tela
   - Usar o número digitado apenas para o teste — não salva no perfil

2. Remover a restrição que desabilita o botão quando `adminPhone` é nulo
   - O botão só fica desabilitado se o campo de telefone estiver em branco

3. Manter a lógica de envio: passa o número digitado diretamente no payload do teste para a Edge Function, que por sua vez envia para o Botconversa

### Fluxo após a mudança

```text
Admin digita telefone no campo de teste
         ↓
Clica em "Testar agora"
         ↓
Edge Function botconversa-notify recebe event_type=new_lead
         ↓
Usa o número passado no payload (ao invés de buscar no profiles)
         ↓
Envia mensagem via Botconversa API
         ↓
Log registrado em botconversa_logs
```

### Ajuste na Edge Function

A Edge Function atualmente **sempre** busca o telefone pelo `owner_id` no `profiles`. Para o caso de teste com número manual, precisamos de um pequeno ajuste: se o payload incluir um campo `test_phone`, a função usa esse número diretamente, sem consultar o perfil.

**Arquivo: `supabase/functions/botconversa-notify/index.ts`**
- Se `body.test_phone` estiver presente, usar esse número como destino em vez de buscar no `profiles`
- Manter o comportamento original para todos os disparos automáticos (sem `test_phone`)

### Resumo das alterações

| Arquivo | Mudança |
|---|---|
| `src/components/admin/BotconversaAdminSection.tsx` | Adicionar campo de telefone editável na seção de teste; remover bloqueio do botão quando perfil sem telefone |
| `supabase/functions/botconversa-notify/index.ts` | Suportar `test_phone` no payload para testes com número manual |
