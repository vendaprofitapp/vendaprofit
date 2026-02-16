
# Mover Configuracoes de Marketing para Paginas Independentes

## Resumo

Retirar 3 secoes de configuracao da pagina "Minha Loja" (StoreSettings.tsx) e criar paginas independentes acessiveis pelo menu lateral no grupo MARKETING. Cada pagina tera seu proprio toggle de ativacao/desativacao. A pagina de Fidelidade (LoyaltyAdmin) tambem ganhara um toggle de ativacao no topo.

## Novas Paginas

### 1. `src/pages/PurchaseIncentivesSettings.tsx` (Incentivos de Compra)
- Rota: `/marketing/incentivos`
- Toggle de ativacao no topo (campo `purchase_incentives_config.enabled` em `store_settings`)
- Contem toda a configuracao de parcelamento, PIX, faixas de beneficios e mensagens (linhas 1664-1960 do StoreSettings atual)
- Busca e salva dados diretamente em `store_settings` do usuario logado

### 2. `src/pages/SecretAreaSettings.tsx` (Area Secreta)
- Rota: `/marketing/area-secreta`
- Toggle de ativacao no topo (campo `secret_area_active` em `store_settings`)
- Contem nome do botao, senha de acesso, previa do botao e dicas (linhas 1547-1662 do StoreSettings atual, sem o toggle de fidelidade que sera movido)
- Busca e salva dados diretamente em `store_settings`

### 3. `src/pages/SalesVideoSettings.tsx` (Video Vendedor)
- Rota: `/marketing/video-vendedor`
- Toggle de ativacao no topo — **requer nova coluna** `bio_video_enabled` (boolean, default false) na tabela `store_settings`
- A bolinha flutuante no catalogo so aparecera se `bio_video_enabled === true` E os videos estiverem configurados
- Contem os uploaders de video preview e video completo (linhas 1962-2001 do StoreSettings atual)

### 4. Atualizar `src/pages/LoyaltyAdmin.tsx` (Fidelidade)
- Adicionar toggle de ativacao no topo da pagina (campo `loyalty_enabled` em `store_settings`)
- Buscar e salvar o campo `loyalty_enabled` diretamente, sem precisar ir em "Minha Loja"

## Alteracoes no Menu Lateral

**Arquivo: `src/components/layout/Sidebar.tsx`**

Adicionar 3 novos itens no grupo MARKETING:

| Item | Icone | Rota |
|------|-------|------|
| Clientes | UserCheck | /customers |
| Marketing | Megaphone | /marketing |
| Fidelidade | Award | /admin/fidelidade |
| Incentivos | CreditCard | /marketing/incentivos |
| Area Secreta | Lock | /marketing/area-secreta |
| Video Vendedor | Video | /marketing/video-vendedor |

## Rotas no App.tsx

Adicionar 3 novas rotas protegidas:
- `/marketing/incentivos` -> PurchaseIncentivesSettings
- `/marketing/area-secreta` -> SecretAreaSettings
- `/marketing/video-vendedor` -> SalesVideoSettings

## Banco de Dados

Nova coluna na tabela `store_settings`:
- `bio_video_enabled` (boolean, default false) — controla se o video vendedor esta ativo

## Remocao do StoreSettings.tsx

Remover completamente os 3 Cards:
- Card "Area Secreta / VIP" (linhas 1547-1662), incluindo o toggle de fidelidade que estava ali
- Card "Incentivos de Compra" (linhas 1664-1960)
- Card "Video Vendedor" (linhas 1962-2001)

Os campos correspondentes no `formData`, `useEffect` de inicializacao e `saveMutation` tambem serao limpos (remover `secret_area_active`, `secret_area_name`, `secret_area_password`, `loyalty_enabled`, `purchase_incentives_config`, `bioVideoPreview`, `bioVideoFull`).

## Condicional no Catalogo (StoreCatalog.tsx)

Atualizar a condicao da bolinha flutuante de video vendedor para tambem verificar `bio_video_enabled === true` do `store_settings`.

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/...` | Nova coluna `bio_video_enabled` |
| `src/pages/PurchaseIncentivesSettings.tsx` | Criar (pagina com toggle + config incentivos) |
| `src/pages/SecretAreaSettings.tsx` | Criar (pagina com toggle + config area secreta) |
| `src/pages/SalesVideoSettings.tsx` | Criar (pagina com toggle + config video) |
| `src/pages/LoyaltyAdmin.tsx` | Adicionar toggle de ativacao no topo |
| `src/pages/StoreSettings.tsx` | Remover 3 cards e campos relacionados |
| `src/components/layout/Sidebar.tsx` | Adicionar 3 links no grupo Marketing |
| `src/App.tsx` | Adicionar 3 rotas protegidas |
| `src/pages/StoreCatalog.tsx` | Condicional `bio_video_enabled` para bolinha |
