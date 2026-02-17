
# Wizard de Onboarding para Novos Usuarios

## Visao Geral

Criar um Wizard (Dialog multi-step) que aparece automaticamente no Dashboard quando o usuario logado tem campos essenciais nao preenchidos. Pode ser fechado a qualquer momento, mas reaparecera no proximo acesso.

## Deteccao de Campos Pendentes

O wizard aparece se QUALQUER um destes estiver vazio:
- `store_settings.store_name` nao existe ou esta vazio
- `store_settings.whatsapp_number` vazio
- `profiles.origin_zip` vazio
- `profiles.cpf` vazio
- Zero registros em `custom_payment_methods`
- Zero registros em `suppliers` (marcas)

Ao fechar (X), salva flag em `sessionStorage` para nao reabrir na mesma sessao. No proximo login, se ainda houver pendencias, reaparece.

## Steps do Wizard

### Step 1 - Nome da Revenda
- Campo de texto para o nome
- Ao avancar: gera slug automatico (ex: "Moda Fitness Lu" -> "moda-fitness-lu")
- Salva em `store_settings`: `store_name`, `store_slug`, `page_title`

### Step 2 - WhatsApp
- Campo com mascara (00) 00000-0000
- Salva em `store_settings.whatsapp_number`

### Step 3 - Marcas / Fornecedores (REVISADO)

Interface com duas secoes:

**Marcas Disponiveis (botoes de selecao)**
Exibir botoes/chips clicaveis para as 4 marcas ja cadastradas no admin:
- PWRD BY COFFEE
- BECHOSE
- INMOOV
- YOPP

O usuario clica para selecionar/deselecionar (toggle visual com check). Ao avancar, para cada marca selecionada:
1. Busca o fornecedor do admin por nome
2. Copia o fornecedor e seus produtos (com estoque zerado) para o usuario

**Adicionar outra marca**
Abaixo dos botoes, um formulario colapsavel "Adicionar marca que nao esta na lista":
- Nome da Marca (texto)
- Site B2C (opcional)
- Site B2B (opcional)
- Botao "+ Adicionar"

Cada marca adicionada aparece numa lista com botao de remover. Ao avancar, essas marcas sao inseridas na tabela `brand_requests` (para o admin cadastrar depois) e tambem criadas como fornecedores basicos para o usuario.

### Step 4 - Formas de Pagamento
- Lista para adicionar formas de pagamento
- Campos: Nome, Taxa (%), toggle "A prazo"
- Botao "Adicionar"
- Salva em `custom_payment_methods`

### Step 5 - CEP de Origem e CPF
- CEP com mascara 00000-000
- CPF com mascara 000.000.000-00
- Salva em `profiles.origin_zip` e `profiles.cpf`

## Nota sobre o Trigger Existente

O trigger `on_profile_created_copy_defaults` ja copia TODOS os fornecedores/produtos do admin para novos usuarios no momento do cadastro. No wizard, precisamos verificar se o usuario ja tem esses fornecedores antes de copiar novamente (para evitar duplicatas). Se o trigger ja copiou, o step 3 serve apenas para confirmar quais marcas o usuario quer manter. Se o usuario nao quer uma marca, nao deletamos nada -- simplesmente nao selecionam e os produtos ficam inativos ou com estoque zero.

## Banco de Dados

### Nova tabela: `brand_requests`

```
id uuid PK
user_id uuid NOT NULL
brand_name text NOT NULL
b2c_url text (nullable)
b2b_url text (nullable)
status text DEFAULT 'pending'
created_at timestamptz DEFAULT now()
```

RLS:
- Usuarios podem inserir e ver as proprias solicitacoes
- Admins podem ver e atualizar todas

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/onboarding/OnboardingWizard.tsx` | Criar - Componente principal (Dialog com 5 steps) |
| `src/hooks/useOnboardingStatus.tsx` | Criar - Hook que verifica pendencias e controla exibicao |
| `src/pages/Dashboard.tsx` | Modificar - Importar e renderizar OnboardingWizard |
| Migracao SQL | Criar tabela `brand_requests` com RLS |

## Detalhes Tecnicos

### Constantes das Marcas Disponiveis
```typescript
const AVAILABLE_BRANDS = [
  { name: "PWRD BY COFFEE", displayName: "PWRD BY COFFEE" },
  { name: "BECHOSE", displayName: "BECHOSE" },
  { name: "INMOOV", displayName: "INMOOV" },
  { name: "YOPP", displayName: "YOPP" },
];
```

### Slug Generation
```typescript
const generateSlug = (name: string) =>
  name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
```

### Busca e Copia de Marca do Admin
```typescript
const ADMIN_ID = "9cd05136-6005-4e16-85a9-02539aaa12c1";

// Verifica se usuario ja tem o fornecedor (evita duplicata do trigger)
const { data: existing } = await supabase
  .from("suppliers")
  .select("id")
  .eq("owner_id", user.id)
  .ilike("name", `%${brandName}%`)
  .maybeSingle();

if (!existing) {
  // Busca fornecedor do admin
  const { data: adminSupplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("owner_id", ADMIN_ID)
    .ilike("name", `%${brandName}%`)
    .maybeSingle();
  
  if (adminSupplier) {
    // Copia fornecedor
    // Copia produtos com estoque 0
  }
}
```

### Hook useOnboardingStatus
```typescript
// Retorna { showWizard, dismiss, refetch }
// Verifica: store_settings, profiles, custom_payment_methods, suppliers
// dismiss() -> sessionStorage.setItem("onboarding_dismissed", "true")
```

### Tabela brand_requests (SQL)
```sql
CREATE TABLE public.brand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_name text NOT NULL,
  b2c_url text,
  b2b_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own brand requests"
  ON public.brand_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own brand requests"
  ON public.brand_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all brand requests"
  ON public.brand_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update brand requests"
  ON public.brand_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));
```
