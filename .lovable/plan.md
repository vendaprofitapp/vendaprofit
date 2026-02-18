
# Fix: Impressão do QR Code abrindo janela dedicada

## Diagnóstico

O problema é estrutural: o `Dialog` do Radix UI usa um **Portal** — ele renderiza o conteúdo do modal em um nó DOM separado, fora da hierarquia normal da página. Quando o CSS `@media print` tenta ocultar tudo e mostrar apenas o QR, os seletores não atingem corretamente o conteúdo do Portal, resultando em uma página de impressão em branco.

## Solução: `window.open()` + `printWindow.print()`

Em vez de tentar controlar o `@media print` da página atual, o botão "Imprimir" vai:

1. Abrir uma **nova janela minimalista** (`window.open('')`)
2. Escrever nela um HTML completo e auto-suficiente com:
   - O QR Code em SVG (serializado do componente React usando `document.querySelector`)
   - O nome do ponto parceiro
   - O subtítulo "Escaneie para ver o catálogo"
   - A URL do catálogo
   - CSS de impressão inline
3. Chamar `printWindow.print()` nessa janela
4. Fechar a janela automaticamente após a impressão

Isso garante que o print preview mostrará **exatamente** o conteúdo do QR, sem interferência do DOM principal.

## Implementação técnica

```tsx
const handlePrint = () => {
  const svgEl = document.querySelector('#qr-print-area svg');
  const svgHtml = svgEl ? svgEl.outerHTML : '';
  const printWindow = window.open('', '_blank', 'width=600,height=700');
  if (!printWindow) return;
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>QR Code - ${partner.name}</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 40px; }
          h2 { margin-bottom: 4px; }
          p { color: #666; margin-bottom: 24px; }
          .url { font-size: 11px; color: #999; margin-top: 16px; word-break: break-all; }
          svg { display: block; margin: 0 auto; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h2>${partner.name}</h2>
        <p>Escaneie para ver o catálogo</p>
        ${svgHtml}
        <div class="url">${catalogUrl}</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
```

O `<div id="qr-print-area">` envolverá o `<QRCodeSVG>` no Dialog para facilitar o `querySelector`.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/PartnerPointDetail.tsx` | Substitui lógica `window.print()` + `@media print` pela abordagem de janela dedicada |

Nenhuma migration, nenhuma dependência nova.
