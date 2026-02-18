
# Botão "Gerar QR Code Imprimível" na Tela do Ponto Parceiro

## O que será adicionado

Na tela `/partner-points/:id`, na linha de botões de ação do card de informações (ao lado de "Copiar Link QR", "WhatsApp" e "Contrato"), será adicionado um botão **"QR Code"** que abre um modal de impressão contendo:

- O QR Code gerado a partir da URL `/p/:token` do ponto
- O nome do ponto parceiro como título
- Um subtítulo "Escaneie para ver o catálogo"
- Botão de **imprimir** (abre o diálogo de impressão do navegador)

## Como funciona tecnicamente

O QR Code será gerado 100% no frontend, sem dependências externas, usando a API pública do Google Charts (`https://chart.googleapis.com/chart?cht=qr&...`) ou a biblioteca `qrcode.react` (já é pequena e sem chaves de API). Como o projeto ainda não tem essa biblioteca, será usada a API do Google Charts via simples `<img>` tag — zero dependências novas.

### URL do QR Code (Google Charts API)

```
https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=<URL_ENCODED_CATALOG_URL>&choe=UTF-8
```

Isso gera uma imagem PNG do QR Code direto no `<img>`, sem instalar nada.

## Modal de impressão

Um `Dialog` simples com:

```
┌─────────────────────────────────┐
│  🏷️ UAIROX Hybrid RUN           │
│     Escaneie para ver o catálogo │
│                                  │
│    ┌──────────────────────┐      │
│    │   [QR CODE 300x300]  │      │
│    └──────────────────────┘      │
│                                  │
│    vendaprofit.lovable.app/p/    │
│    <token>                       │
│                                  │
│  [ Imprimir ]  [ Fechar ]        │
└─────────────────────────────────┘
```

O botão "Imprimir" chama `window.print()`. O modal terá estilo CSS de impressão para mostrar apenas o conteúdo do QR (ocultando o restante da página via `@media print`).

## Arquivos alterados

| Arquivo | Tipo |
|---|---|
| `src/pages/PartnerPointDetail.tsx` | Edição — adiciona botão "QR Code" + Dialog de impressão |

Nenhuma migration, nenhuma dependência nova.

## Localização do botão

O botão será inserido na linha de botões existente (linhas 231–253 da tela atual):

```
[ Copiar Link QR ]  [ WhatsApp ]  [ Contrato ]  [ QR Code ]  ← novo
```
