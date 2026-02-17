
# Criar Wizard de Onboarding para Novos Usuarios

## Problema

O Wizard de Onboarding mencionado na memoria do projeto nunca foi implementado no codigo. Quando o usuario `hybridrunbrasil@gmail.com` criou a conta, ele foi direto para o Dashboard sem passar por nenhuma configuracao inicial. Os campos essenciais do perfil estao todos vazios (`store_name`, `phone`, `origin_zip`, `cpf`), e nao foi criado nenhum registro em `store_settings`.

## Solucao

Criar um componente `OnboardingWizard` que aparece como um Dialog modal no Dashboard quando campos essenciais estao ausentes. O wizard tera 3 etapas:

### Etapa 1 — Identidade da Loja
- **Nome da revenda** (`profiles.store_name`)
- **WhatsApp** (`profiles.phone`)
- **CEP de origem** (`profiles.origin_zip`)
- **CPF** (`profiles.cpf`)

### Etapa 2 — Configurar Loja Online
- **Slug da URL** (gera automaticamente a partir do nome da revenda)
- Cria o registro em `store_settings` com `store_slug`, `store_name`, `whatsapp_number`

### Etapa 3 — Selecao de Marcas Parceiras
- Exibe as marcas disponiveis dos fornecedores do admin: **BECHOSE**, **INMOOV**, **NEW HYPE**, **POWERED BY COFFEE**, **YOPP**
- Marcas selecionadas sincronizam os fornecedores e produtos (com estoque zero) da conta admin para a conta do novo usuario
- Campo "Outra marca" para registrar em `brand_requests`

## Logica de Exibicao

O wizard aparece no Dashboard quando **qualquer um** desses campos esta vazio:
- `profiles.store_name`
- `profiles.phone`
- `profiles.origin_zip`

Se todos estiverem preenchidos, o wizard nao aparece.

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/onboarding/OnboardingWizard.tsx` | **CRIAR** — Componente Dialog multi-step com as 3 etapas |
| `src/pages/Dashboard.tsx` | **MODIFICAR** — Adicionar query para verificar campos vazios do perfil e renderizar o `OnboardingWizard` |

## Detalhes Tecnicos

### OnboardingWizard.tsx

```text
Componente: Dialog (Radix) nao-dismissivel (sem fechar clicando fora)
Estado: step (1, 2, 3), formData com campos de cada etapa
Step 1: Formulario com Input para store_name, phone (mascara), origin_zip (mascara), cpf (mascara)
Step 2: Input para slug (auto-gerado do store_name, editavel), preview da URL
Step 3: Checkboxes das 5 marcas + campo texto "Outra marca"
Botoes: "Proximo" / "Anterior" / "Finalizar"
```

### Acao ao Finalizar

1. Atualizar `profiles` com `store_name`, `phone`, `origin_zip`, `cpf`
2. Inserir em `store_settings` com `store_slug`, `store_name`, `whatsapp_number`, `owner_id`
3. Se marcas foram selecionadas — os produtos ja foram copiados pelo trigger `copy_admin_defaults_to_new_user`, entao essa etapa sera apenas informativa/confirmacao
4. Se "Outra marca" foi preenchida — inserir em `brand_requests`
5. Fechar wizard e recarregar dados do dashboard

### Dashboard.tsx

Adicionar no inicio do componente:
```text
useQuery para buscar profiles onde id = user.id
Verificar se store_name, phone, origin_zip estao preenchidos
Se algum estiver vazio: showOnboarding = true
Renderizar <OnboardingWizard open={showOnboarding} onComplete={refetch} />
```
