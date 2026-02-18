
# Termo de Aceite Digital — Ponto Parceiro

## Visão Geral

Será criada uma página web pública acessível em `/contrato/:token` que exibe o Termo de Parceria Comercial parametrizado com os dados reais do parceiro. O parceiro lê, marca o checkbox "Li e Aceito" e clica em confirmar — o sistema registra data/hora e IP do aceite diretamente no banco.

---

## O que Muda

| Componente | Tipo | O que faz |
|---|---|---|
| `partner_points` (banco) | Migração | Adiciona `contract_accepted_at`, `contract_accepted_ip`, `contract_token` |
| `src/pages/PartnerContract.tsx` | Novo arquivo | Página pública do contrato com texto parametrizado e botão de aceite |
| `src/pages/PartnerPointDetail.tsx` | Edição | Adiciona botão "Enviar Contrato" na ficha do parceiro |
| `App.tsx` | Edição | Registra a rota `/contrato/:token` |

---

## Banco de Dados — Migração

Três colunas novas na tabela `partner_points`:

```sql
ALTER TABLE partner_points
  ADD COLUMN contract_token text DEFAULT NULL,
  ADD COLUMN contract_accepted_at timestamptz DEFAULT NULL,
  ADD COLUMN contract_accepted_ip text DEFAULT NULL;
```

- `contract_token`: UUID único gerado quando a vendedora clica em "Enviar Contrato". Serve como chave pública da URL — sem exposição do `id` interno.
- `contract_accepted_at`: Data/hora do aceite (null = ainda não assinou).
- `contract_accepted_ip`: IP do parceiro no momento do aceite.

---

## Página Pública `/contrato/:token` — `PartnerContract.tsx`

### Comportamento

1. Busca o parceiro pelo `contract_token` (sem autenticação — é pública)
2. Busca os dados da Fornecedora via `owner_id` na tabela `profiles` + `store_settings`
3. Renderiza o Termo preenchido com as variáveis reais
4. Se `contract_accepted_at` já está preenchido, mostra tela de "Contrato já assinado em [data]" — sem permitir re-assinar

### Variáveis substituídas no texto

| Variável | Fonte |
|---|---|
| `[NOME_DA_SUA_MARCA]` | `store_settings.store_name` |
| `[SEU_DOCUMENTO]` | `profiles.cpf` |
| `[NOME_DO_BOX_OU_ACADEMIA]` | `partner_points.name` |
| `[DOCUMENTO_DO_PARCEIRO]` | `partner_points.cpf_cnpj` |
| `[NOME_DO_RESPONSAVEL]` | `partner_points.contact_name` |
| `[COMISSAO_ARARA]` | `partner_points.rack_commission_pct` |
| `[COMISSAO_RETIRADA]` | `partner_points.pickup_commission_pct` |
| `[FLUXO_CAIXA]` | `partner_points.payment_receiver` |
| `[TAXA_MEIO_PAGAMENTO]` | `partner_points.payment_fee_pct` |
| `[METODOS_DE_PAGAMENTO_ACEITOS]` | `partner_points.allowed_payment_methods[].name` |
| `[TABELA_MINIMO_POR_METODO]` | `allowed_payment_methods[]` onde `min_amount > 0` |
| `[FREQUENCIA_DE_ACERTO]` | `partner_points.replenishment_cycle_days` |
| `[RESPONSABILIDADE_INVENTARIO]` | `partner_points.loss_risk_enabled` |

### Cláusulas condicionais

- **Cláusula 3** exibe apenas o bloco correspondente ao `payment_receiver`:
  - `"partner"` → bloco "Pagamento ao Ponto Parceiro"
  - `"seller"` → bloco "Pagamento à Vendedora" com tabela de métodos e mínimos

### Aceite

Ao clicar em "Li e Aceito":
- Registra via `UPDATE partner_points SET contract_accepted_at = now()` onde `contract_token = :token`
- O IP é capturado via header `cf-connecting-ip` ou `x-forwarded-for` através de uma edge function pequena chamada `accept-partner-contract`
- Exibe tela de confirmação: "Contrato assinado com sucesso em [data]. Obrigado, [nome do responsável]!"

---

## `PartnerPointDetail.tsx` — Botão "Enviar Contrato"

Na ficha de cada parceiro, será adicionado um botão na linha de ações (ao lado de "Copiar Link QR" e "WhatsApp"):

```
[ 📄 Contrato ]
```

Comportamento ao clicar:
1. Se `contract_token` ainda é null → gera um UUID e salva no banco, depois copia o link
2. Se `contract_token` já existe → apenas copia/exibe o link
3. Badge de status ao lado: "Pendente" (sem aceite) ou "✅ Assinado em [data]"

O link gerado será: `https://vendaprofit.lovable.app/contrato/:token`

---

## Edge Function `accept-partner-contract`

Pequena função serverless responsável por:
- Receber `{ contract_token }` via POST
- Capturar o IP real do cliente (cabeçalhos `cf-connecting-ip` ou `x-forwarded-for`)
- Validar que o contrato ainda não foi assinado
- Executar o UPDATE com `contract_accepted_at = now()` e `contract_accepted_ip`
- Retornar sucesso ou erro

Isso é necessário porque o IP do cliente **não pode ser capturado pelo frontend** — apenas o servidor vê os cabeçalhos HTTP reais.

---

## Fluxo Completo

```text
Vendedora acessa ficha do parceiro
  → Clica "Enviar Contrato"
  → Sistema gera contract_token único
  → Copia link: /contrato/abc-uuid-xyz
  → Vendedora envia pelo WhatsApp para o dono do box

Dono do box abre o link no celular
  → Lê o termo com todos os dados preenchidos
  → Marca checkbox "Li e Aceito a Parceria"
  → Clica confirmar
  → Edge function registra data/hora + IP
  → Tela de confirmação exibida

Vendedora volta na ficha do parceiro
  → Badge "✅ Assinado em 18/02/2026 às 14:32" visível
```

---

## Validade Legal

O registro de IP + data/hora configura prova de aceite eletrônico conforme a Lei nº 14.063/2020 (assinaturas eletrônicas) e a jurisprudência dos Termos de Uso aceitos digitalmente. Não requer certificado ICP-Brasil para contratos comerciais entre pessoas físicas e jurídicas de menor porte.

---

## Arquivos Resumidos

- **Criados**: `src/pages/PartnerContract.tsx`, `supabase/functions/accept-partner-contract/index.ts`
- **Editados**: `src/pages/PartnerPointDetail.tsx` (botão + badge), `App.tsx` (rota)
- **Banco**: Migração com 3 colunas novas em `partner_points`
