
# Corrigir 3 Problemas do Wizard de Configuração Inicial

## Resumo dos Problemas

### Problema 1 — Aparece para quem já tem dados
A condição `showOnboarding` no `Dashboard.tsx` está incorreta. Ela usa `!!profile && (!profile.store_name || !profile.phone || !profile.origin_zip)`, mas o `profile` começa como `undefined` durante o carregamento. Além disso, usuários com `store_settings` já criado (que passaram pelo wizard antes) continuam vendo o modal porque a lógica não verifica se já completaram a configuração.

**Solução:** Adicionar `store_settings` à verificação. Se o usuário já tem `store_settings` criado, o wizard não deve aparecer. Também adicionar estado `dismissed` para fechar manualmente.

### Problema 2 — Não pode ser fechado
O Dialog tem `onOpenChange={() => {}}` (função vazia que não faz nada), e bloqueia clique fora (`onPointerDownOutside`) e ESC (`onEscapeKeyDown`). Não há botão "X" funcional nem botão "Pular por agora".

**Solução:** 
- Permitir fechar via botão X nativo do Dialog (remover os bloqueios)
- Adicionar um botão "Preencher depois" no rodapé do Step 1
- Passar uma prop `onDismiss` que o Dashboard usa para marcar o wizard como dispensado (usando `localStorage` para não reabrir na mesma sessão)

### Problema 3 — Campos aparecem vazios mesmo com dados existentes
O wizard usa `useState("")` para todos os campos, ignorando os dados que o usuário já tem no perfil. Por exemplo, se o usuário já tem `phone` e `origin_zip` mas falta apenas `store_name`, todos os campos aparecem em branco.

**Solução:** O `OnboardingWizard` receberá os dados do perfil via props e usará `useState` inicializado com esses valores. Os campos que já estão preenchidos aparecerão com o valor existente. A máscara será aplicada ao valor inicial usando as funções de formatação já existentes.

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/Dashboard.tsx` | Buscar `store_settings` + lógica de `dismissed` + passar `profile` como prop |
| `src/components/onboarding/OnboardingWizard.tsx` | Props de dados existentes + fechar + pré-preencher campos |

---

## Detalhes Técnicos

### Dashboard.tsx

**Mudança na query:** Buscar também `store_settings` para verificar se o usuário já completou o onboarding:

```typescript
// Query que verifica se precisa de onboarding
const { data: profile } = useQuery({
  queryKey: ['onboarding-profile', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('profiles')
      .select('store_name, phone, origin_zip, cpf')
      .eq('id', user?.id).single();
    return data;
  },
  enabled: !!user?.id,
});

const { data: storeSettings } = useQuery({
  queryKey: ['onboarding-store', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('id')
      .eq('owner_id', user?.id)
      .maybeSingle();
    return data;
  },
  enabled: !!user?.id,
});
```

**Nova lógica de exibição:**
```typescript
// Dispensado manualmente nesta sessão
const [dismissed, setDismissed] = useState(
  () => localStorage.getItem(`onboarding_dismissed_${user?.id}`) === 'true'
);

// Só mostra se: perfil carregado + algum campo faltando + não dispensado
const needsOnboarding = !!profile && (
  !profile.store_name || !profile.phone || !profile.origin_zip
);
const showOnboarding = needsOnboarding && !dismissed && !storeSettings;
```

**Passar dados para o wizard:**
```tsx
<OnboardingWizard
  open={showOnboarding}
  existingProfile={profile}
  onComplete={() => { refetchProfile(); }}
  onDismiss={() => {
    localStorage.setItem(`onboarding_dismissed_${user?.id}`, 'true');
    setDismissed(true);
  }}
/>
```

### OnboardingWizard.tsx

**Novas props:**
```typescript
interface OnboardingWizardProps {
  open: boolean;
  existingProfile?: {
    store_name?: string | null;
    phone?: string | null;
    origin_zip?: string | null;
    cpf?: string | null;
  } | null;
  onComplete: () => void;
  onDismiss: () => void;
}
```

**Inicializar campos com dados existentes:**
```typescript
// Pré-preencher com dados existentes, aplicando máscaras nos valores numéricos
const [storeName, setStoreName] = useState(existingProfile?.store_name || "");
const [phone, setPhone] = useState(
  existingProfile?.phone ? maskPhone(existingProfile.phone) : ""
);
const [originZip, setOriginZip] = useState(
  existingProfile?.origin_zip ? maskCEP(existingProfile.origin_zip) : ""
);
const [cpf, setCpf] = useState(
  existingProfile?.cpf ? maskCPF(existingProfile.cpf) : ""
);
```

**Remover bloqueios de fechamento + adicionar botão "Preencher depois":**
```tsx
// Dialog agora pode fechar
<Dialog open={open} onOpenChange={(open) => { if (!open) onDismiss(); }}>
  <DialogContent className="sm:max-w-lg">
    {/* ... conteúdo ... */}
    
    {/* Rodapé com opção de dispensar */}
    <div className="flex justify-between pt-2">
      {step > 1 ? (
        <Button variant="outline" onClick={() => setStep(step - 1)}>
          <ArrowLeft /> Anterior
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground text-xs">
          Preencher depois
        </Button>
      )}
      {/* botão próximo/finalizar */}
    </div>
  </DialogContent>
</Dialog>
```

**Validação do Step 1 revisada:** Se o usuário já tinha `phone` e `origin_zip`, o botão "Próximo" ficará habilitado mesmo que ele não reedite esses campos, pois os campos já estarão com valor válido.

---

## Comportamento Resultante

- **Usuário com todos os dados preenchidos:** Wizard não aparece
- **Usuário com dados parciais:** Wizard aparece com campos já preenchidos, em branco apenas os que faltam
- **Usuário que fecha o wizard:** Wizard não reaparece na mesma sessão (localStorage), volta na próxima sessão se os dados ainda estiverem incompletos
- **Usuário que completa o wizard:** Wizard não reaparece (tem `store_settings` agora)
