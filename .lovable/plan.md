

# Adicionar Botao "Minha Loja" na Sidebar

## Objetivo

Adicionar um botao dourado (gold) logo abaixo do link "Dashboard" na barra lateral, oferecendo acesso rapido a pagina "Minha Loja" (`/my-store`).

## Detalhes Tecnicos

### Arquivo: `src/components/layout/Sidebar.tsx`

Inserir um `<Link>` estilizado com cor dourada entre o link do Dashboard e o primeiro grupo de navegacao ("Estrategias").

**Estilo do botao:**
- Fundo dourado (`bg-yellow-500`) com hover (`hover:bg-yellow-600`)
- Texto escuro para contraste (`text-gray-900`)
- Icone `Store` (ja importado)
- Bordas arredondadas, fonte bold, similar ao CTA de "Registrar Venda"
- Margem inferior para separar dos grupos seguintes

**Posicao na sidebar:**
```
[Registrar Venda]  (CTA primario)
[Dashboard]
[Minha Loja]       << NOVO botao gold
--- Estrategias ---
...
```

### Mudanca especifica

Adicionar o seguinte bloco logo apos o `<Link to="/">Dashboard</Link>` (aproximadamente linha 136):

```tsx
<Link
  to="/my-store"
  onClick={handleNavClick}
  className={cn(
    "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 mb-1",
    location.pathname === "/my-store"
      ? "bg-yellow-500 text-gray-900 shadow-md"
      : "bg-yellow-500/90 text-gray-900 hover:bg-yellow-500 hover:shadow-md"
  )}
>
  <Store className="h-5 w-5" />
  Minha Loja
</Link>
```

## Arquivo Afetado

| Arquivo | Acao |
|---------|------|
| `src/components/layout/Sidebar.tsx` | Adicionar botao gold "Minha Loja" abaixo do Dashboard |

