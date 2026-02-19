
# Problema: Tela Piscando/Movendo Durante Captura de Lead no Mobile

## O que foi identificado no vídeo

Confirmei o problema. Existem **três causas simultâneas** fazendo a tela se mover e piscar enquanto o usuário tenta preencher os dados:

---

## Causa 1 — `shouldScaleBackground = true` no Drawer (vaul)

O componente `Drawer` em `src/components/ui/drawer.tsx` é configurado com `shouldScaleBackground = true` por padrão. Isso faz o vaul aplicar um efeito visual de **zoom/scale na página de fundo** quando o drawer abre — produzindo exatamente o efeito de "tela se movendo" que aparece no vídeo.

Em `LeadCaptureSheet`, o Drawer é chamado sem sobrescrever este padrão:
```tsx
<Drawer open={open} onOpenChange={onOpenChange}>
```

**Correção:** Passar `shouldScaleBackground={false}` explicitamente para o Drawer do LeadCaptureSheet.

---

## Causa 2 — `useVisualViewportHeight` causando re-layout contínuo

Em `LeadCaptureSheet.tsx`, existe um hook que escuta o evento `resize` do `visualViewport` e, a cada alteração de altura (que ocorre quando o teclado virtual do celular abre), modifica diretamente o estilo inline `maxHeight` do `DrawerContent`. 

Isso causa um **re-layout forçado** a cada pixel que o teclado aparece/desaparece, criando o efeito de "tela pulando". Este mecanismo de `ref + style inline` em conjunto com as animações do vaul gera o conflito visual.

**Correção:** Remover o hook `useVisualViewportHeight` e o `useEffect` associado que modifica o `style.maxHeight`. Em vez disso, usar apenas CSS moderno (`max-h-[--visual-viewport-height]` ou altura fixa conservadora) que não cause re-layout contínuo durante a abertura do teclado.

---

## Causa 3 — `shouldScaleBackground` afeta todos os Drawers da loja

O mesmo problema pode ocorrer em outros componentes que usam `<Drawer>` na loja, como `VipAreaDrawer`. A configuração padrão global em `src/components/ui/drawer.tsx` é a raiz do problema.

---

## Solução Proposta

### Arquivo 1: `src/components/catalog/LeadCaptureSheet.tsx`

- Remover o hook `useVisualViewportHeight` e seu `useEffect` associado (que causam re-layout)
- Remover `contentRef` (não mais necessário)
- Adicionar `shouldScaleBackground={false}` no `<Drawer>`
- Usar altura CSS fixa e confiável para o Drawer: `max-h-[90dvh]` (dinamic viewport height — já suportado nos browsers modernos do iOS/Android)
- Adicionar `noBodyStyles` no Drawer para evitar que o vaul modifique o `body` durante abertura

### Arquivo 2: `src/components/ui/drawer.tsx`

- Alterar o padrão de `shouldScaleBackground = true` para `shouldScaleBackground = false` globalmente, pois o efeito de zoom na página de fundo prejudica a experiência em toda a aplicação

---

## O que NÃO muda

- A lógica de captura de lead continua funcionando igual
- O formulário e validação continuam iguais
- A aparência visual do drawer continua igual
- Em desktop, o Dialog continua sendo usado (sem mudança)

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/catalog/LeadCaptureSheet.tsx` | Remove hook de viewport, adiciona `shouldScaleBackground={false}` e `noBodyStyles` |
| `src/components/ui/drawer.tsx` | Muda padrão global de `shouldScaleBackground` para `false` |
