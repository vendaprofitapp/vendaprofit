# Refatoracao do Menu Lateral (Sidebar) - Navegacao Estrategica

## Visao Geral

Reestruturar completamente a Sidebar para ter um botao de Vendas em destaque no topo, seguido do Dashboard, e depois os links agrupados por categorias com subtitulos visuais.

## Estrutura Final do Menu

```text
+----------------------------+
| [Logo] Venda PROFIT        |
+----------------------------+
| [$$$ VENDAS $$$]           |  <-- Botao CTA grande, cor primaria, pulse
+----------------------------+
| Dashboard                  |
+----------------------------+
| ESTRATEGIAS                |
|   Bolsa Consignada         |
|   Consorcios               |
|   Bazar VIP                |
+----------------------------+
| MARKETING                  |
|   Clientes                 |
|   Marketing                |
|   Fidelidade               |
+----------------------------+
| ESTOQUE                    |
|   Controle                 |
|   Categorias               |
|   Fornecedores             |
|   Pedidos B2B              |
|   Encomendas               |
+----------------------------+
| PARCERIAS                  |
|   Socias / Parceiras       |
|   Solicitacoes             |
+----------------------------+
| GESTAO                     |
|   Financeiro               |
|   Relatorios               |
|   Rel. Sociedades          |
+----------------------------+
| SISTEMA                    |
|   Minha Loja               |
|   Configuracoes            |
|   Tutorial                 |
+----------------------------+
| (Admin only)               |
|   Admin Usuarios           |
|   Editor Landing Page      |
+----------------------------+
```

## Alteracoes Tecnicas

### Arquivo: `src/components/layout/Sidebar.tsx`

1. **Botao de Vendas CTA** — No topo, logo abaixo do logo, renderizar um `Link` para `/sales` estilizado como botao primario chamativo:
  - Classes: `bg-primary text-white font-bold py-3.5 rounded-xl shadow-glow text-base`
  - Adicionar animacao `animate-pulse` sutil no icone (DollarSign ou ShoppingCart)
  - Quando ativo (rota `/sales`), manter destaque mas sem pulse
2. **Dashboard** — Link simples logo abaixo do botao CTA
3. **Grupos com subtitulos** — Substituir a lista flat `navItems` por uma estrutura de grupos:
  ```typescript
   interface NavGroup {
     label: string;
     items: NavItem[];
   }
  ```
   Cada grupo renderiza um subtitulo com classes `text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-4 pt-4 pb-1`
4. **Links individuais** — Manter o estilo atual dos links (mesmas classes de hover/active), apenas reorganizar a ordem
5. **Links admin** — Manter no final, dentro de um grupo "ADMIN" que so aparece quando `isAdmin === true`

### Arquivo: `src/components/layout/MainLayout.tsx`

Nenhuma alteracao estrutural necessaria. O mobile ja usa `Sheet` com `Sidebar` dentro. O botao CTA ficara no topo do menu mobile naturalmente pois e renderizado primeiro na sidebar. O `overflow-y-auto` ja existente garante rolagem.

## Nota sobre "Rel. Parcerias"

O menu atual tem apenas "Rel. Sociedades" (`/partner-reports`). Nao existe uma rota separada para "Rel. Parcerias". Vou incluir apenas "Rel. Sociedades" no grupo GESTAO, conforme as rotas existentes. Se futuramente uma pagina de Relatorios de Parcerias for criada, basta adicionar ao grupo.

## Resumo


| Arquivo                             | Alteracao                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/components/layout/Sidebar.tsx` | Reescrita completa: botao CTA de vendas, dashboard separado, links agrupados com subtitulos, admin no final |
