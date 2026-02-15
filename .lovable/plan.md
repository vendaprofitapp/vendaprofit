# Renomear Nomenclatura e Personalizar Descricoes nos Relatorios

## Resumo

Duas mudancas principais:

1. Renomear "Parceria 1-1" para "Sociedade 1-1" e "Grupos" para "Parcerias" em toda a interface
2. Substituir termos genericos como "Meus Ganhos" e "Devo aos Donos" por nomes reais das parceiras (ex: "Ganhos de Camila Nogueira", "Devo a Isabelle Santos")

## Mudanca 1: Renomear Nomenclatura

### Mapeamento de termos:

- "Parceria 1-1" / "Parcerias 1-1" / "Parcerias Diretas" -> "Sociedade 1-1" / "Sociedades 1-1" / "Sociedades Diretas"
- "Grupos" / "Grupo" / "Grupos de Parceria" -> "Parcerias" / "Parceria"
- "Parceira" (no contexto de grupos) -> "Membro" (mantem quando faz sentido no contexto 1-1)

### Arquivos afetados:

`**src/components/layout/Sidebar.tsx**`

- "Parcerias" -> "Socias / Parceiras" (label do menu, pois a pagina gerencia ambos)
- "Rel. Sócias" -> Relatórios somente das Sociedades 1-1 
- "Rel. Parcerias -> Relatórios somente das Parcerias

`**src/pages/Partnerships.tsx**`

- Titulo da pagina: "Parcerias" -> "Sociedades e Parcerias"
- Tab "Parcerias Diretas" -> "Sociedades 1-1"
- Tab "Grupos" -> "Parcerias"
- "Grupos de Parceria" -> "Parcerias em Grupo"
- Dialogs e toasts com termos atualizados

`**src/components/partnerships/DirectPartnerships.tsx**`

- "Parcerias Diretas (1-1)" -> "Sociedades Diretas (1-1)"

`**src/pages/PartnerReports.tsx**`

- Titulo: "Relatorio de Parcerias e Grupos" -> "Relatorio de Sociedades e Parcerias"
- Tab "Parcerias 1-1" -> "Sociedades 1-1"
- Tab "Grupos" -> "Parcerias"
- "Regra de Parceria 1-1" -> "Regra de Sociedade 1-1"
- "Regra de Grupo" -> "Regra de Parceria"
- groupName: "Parceria 1-1" -> "Sociedade 1-1", "Grupo" -> "Parceria"
- WhatsApp export: "PARCERIAS 1-1" -> "SOCIEDADES 1-1", "GRUPOS" -> "PARCERIAS"

`**src/components/layout/MainLayout.tsx**`

- pageTitles: atualizar labels correspondentes

## Mudanca 2: Personalizar Descricoes com Nomes Reais

No arquivo `**src/pages/PartnerReports.tsx**`, substituir termos genericos por nomes reais do usuario logado e suas parceiras:

- **"Meus Ganhos (Vendas)"** -> **"Ganhos de [Nome do Usuario]"** (ex: "Ganhos de Camila Nogueira")
- **"Devo aos Donos"** / **"Devo as Parceiras"** -> **"Devo a [Nome da Parceira]"** (ex: "Devo a Isabelle Santos") quando ha apenas 1 parceira, senao "Devo as Socias/Parceiras"
- **"Meus ganhos pendentes"** -> **"Ganhos pendentes de [Nome]"**
- **"Devo aos donos (pendente)"** -> **"Devo a [Nome] (pendente)"**
- **"Ganho Dela"/"Ganho Dele"** -> **"Ganho de [Nome]"** usando o nome real da parceira da linha
- Colunas de tabela: usar `profiles.find(p => p.id === user?.id)?.full_name` para o nome do usuario logado

O mesmo principio se aplica ao texto de exportacao WhatsApp.

## Detalhes Tecnicos

### Arquivos a modificar (6 arquivos):

1. `**src/components/layout/Sidebar.tsx**` - Labels do menu lateral
2. `**src/components/layout/MainLayout.tsx**` - Titulos das paginas no header mobile
3. `**src/pages/Partnerships.tsx**` - Toda a pagina de gestao de parcerias
4. `**src/components/partnerships/DirectPartnerships.tsx**` - Secao de sociedades diretas
5. `**src/pages/PartnerReports.tsx**` - Relatorio completo (nomenclatura + nomes personalizados)
6. `**src/components/reports/AccountSettlement.tsx**` - "Meus Ganhos" -> nome real

### Logica para nomes personalizados (PartnerReports.tsx):

```text
// Obter nome do usuario logado
const currentUserName = profiles.find(p => p.id === user?.id)?.full_name || "Voce";

// Nos cards de resumo:
// "Meus Ganhos (Vendas)" -> `Ganhos de ${currentUserName}`
// "Devo aos Donos" -> quando 1 parceira: `Devo a ${partners[0].full_name}`, senao "Devo aos Socios"

// Nas colunas de tabela (Partner Sales):
// "Ganho Dele/Dela" -> `Ganho de ${summary.partnerName}` (ja tem o nome no summary)
// Header generico -> nome da parceira quando ha apenas uma
```