
# Correcao do Lead Capture Mobile + Toggle On/Off

## Resumo

Duas alteracoes: (1) corrigir o Drawer mobile do `LeadCaptureSheet` que esta mostrando espaco vazio enorme (os campos de nome e WhatsApp nao sao visiveis), e (2) adicionar uma coluna `lead_capture_enabled` na tabela `store_settings` com um toggle na pagina de Marketing para ativar/desativar a captura de leads.

---

## Problema 1: Drawer Mobile Nao Responsivo

Na imagem enviada, o Drawer no mobile mostra apenas o botao "Garantir Minhas Pecas" e "Continuar sem reservar" com um espaco vazio enorme entre eles. Os campos de input (nome e WhatsApp) nao estao visiveis -- provavelmente estao acima da area visivel ou o Drawer esta a ocupar demasiado espaco sem scroll.

### Correcao em `src/components/catalog/LeadCaptureSheet.tsx`

- No Drawer mobile, o formulario (`LeadForm`) esta dentro de `<div className="px-4 pb-2">` entre o `DrawerHeader` e `DrawerFooter`
- O problema e que o DrawerContent nao tem restricao de altura e o conteudo fica espalhado
- Solucao: garantir que o conteudo do Drawer tenha `max-h-[85dvh]` e `overflow-y-auto` para scroll, e que os campos fiquem visiveis antes do botao

## Problema 2: Toggle para Ativar/Desativar Captura de Leads

### Migracao de Banco de Dados

Adicionar coluna na tabela `store_settings`:
- `lead_capture_enabled` (boolean, DEFAULT true) -- ativo por padrao para nao quebrar lojas existentes

### Alteracoes em `src/pages/StoreCatalog.tsx`

- Buscar `lead_capture_enabled` junto com os outros campos de `store_settings`
- Na funcao `addToCart`, verificar se `lead_capture_enabled` e true antes de mostrar o `LeadCaptureSheet`
- Se desativado, adicionar direto ao carrinho sem pedir nome/WhatsApp

### Alteracoes em `src/pages/Marketing.tsx`

- Adicionar uma secao de configuracao no topo ou abaixo do header da pagina
- Um card simples com um Switch (toggle) "Captura de Leads" com descricao "Solicitar nome e WhatsApp quando visitantes adicionam itens ao carrinho na sua loja"
- O toggle lê e atualiza `store_settings.lead_capture_enabled`
- Query para buscar o estado atual e mutation para atualizar

---

## Detalhes Tecnicos

### Arquivos alterados

1. **`src/components/catalog/LeadCaptureSheet.tsx`**: Corrigir layout do Drawer mobile -- ajustar padding, garantir que campos fiquem visiveis, adicionar scroll se necessario

2. **Nova migracao SQL**: `ALTER TABLE store_settings ADD COLUMN lead_capture_enabled boolean DEFAULT true`

3. **`src/pages/StoreCatalog.tsx`**: 
   - Adicionar `lead_capture_enabled` ao SELECT da query de store_settings
   - Condicionar a abertura do `LeadCaptureSheet` ao valor de `lead_capture_enabled`

4. **`src/pages/Marketing.tsx`**: 
   - Adicionar query para buscar `lead_capture_enabled` de `store_settings`
   - Adicionar mutation para update
   - Renderizar um card com Switch no topo da pagina (visivel em todas as abas)

### Sequencia

1. Criar migracao (nova coluna)
2. Corrigir `LeadCaptureSheet.tsx` (responsividade mobile)
3. Atualizar `StoreCatalog.tsx` (condicionar captura)
4. Atualizar `Marketing.tsx` (toggle de controle)
