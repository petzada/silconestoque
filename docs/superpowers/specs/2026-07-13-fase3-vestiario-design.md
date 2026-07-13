# Fase 3 — Armários do Vestiário — Design

**Data:** 2026-07-13
**Status:** Aprovado pelo usuário (brainstorming concluído)
**Pré-requisito:** módulo Chapas & Armários + Colaboradores implementado
(`docs/superpowers/specs/2026-07-13-chapas-armarios-design.md`). Independente da
fase 2 — as duas podem ser implementadas em qualquer ordem após a fase 1.

## Objetivo

Atrelar a cada colaborador um armário do vestiário (`kind = 'vestiario'`), com
numeração própria e independente da chapa de uniforme, sem tamanho, mantendo as
mesmas garantias (1 ocupante por armário, 1 armário de vestiário por colaborador,
histórico de ocupações).

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Banco | **Nenhuma migração nova** — o modelo genérico da fase 1 (`lockers.kind`, índices parciais por tipo) já cobre tudo |
| UI | Página **separada**: novo item "Vestiário" na seção Pessoal → `/vestiario` |
| Numeração | Independente da chapa de uniforme (sem sugestão de mesmo número) |
| Cadastro | Individual + **criação em lote por faixa** (de N até M); sem importação CSV |
| Página Colaboradores | Duas badges (ex.: `Chapa 12 · M` e `Vest. 40`); desligamento libera **os dois** armários |
| Código | Extrair componentes compartilhados parametrizados por `kind` — sem duplicar página |

## Refatoração (incluída nesta fase)

Extrair da página de uniformes (`app/(dashboard)/lockers/page.tsx`) os blocos
reutilizáveis para `components/lockers/`, todos recebendo `kind: LockerKind`:

| Componente | Responsabilidade |
|---|---|
| `locker-grid.tsx` | Cards de resumo + filtros + grade de armários (variante vestiário oculta filtro e badge de tamanho) |
| `locker-sheet.tsx` | Painel de detalhes: ocupante/atribuir, liberar, transferir, histórico, editar, desativar |
| `locker-form-dialog.tsx` | Novo/editar armário (campo tamanho renderizado apenas para `kind = 'uniforme'`) |

A página `/lockers` passa a consumir esses componentes **sem mudança visível**;
o diálogo de importação CSV permanece exclusivo dela.

## Nova página `/vestiario`

`app/(dashboard)/vestiario/page.tsx`, consumindo os componentes compartilhados com
`kind = 'vestiario'`:

- **Cards de resumo:** Total, Ocupados, Livres, Colaboradores ativos sem armário de
  vestiário.
- **Filtros:** busca por nº ou nome do ocupante; status (todos/ocupado/livre/
  inativo). Sem filtro de tamanho.
- **Grade:** cards com número + ocupante (sem badge de tamanho); mesmos estados
  visuais da página de uniformes (tokens do design system).
- **Ações:** "+ Novo armário" (número apenas) e **"Criar por faixa"**:
  - Diálogo com campos "De" e "Até" (inteiros positivos, faixa máxima de 500 por
    operação para evitar acidentes).
  - Pré-visualização antes de gravar: quantos serão criados e quais números da
    faixa já existem (serão ignorados).
  - Insert em lote apenas dos inexistentes; resumo ao final
    (ex.: "45 criados, 5 ignorados").
- **Sheet de detalhes:** mesmos fluxos da fase 1 (atribuir/liberar/transferir/
  histórico/editar/desativar). O combobox de atribuição lista colaboradores ativos
  **sem armário de vestiário** (ter ou não chapa de uniforme é irrelevante).

## Sidebar

Seção "Pessoal" ganha o item **Vestiário** → `/vestiario` (ícone `DoorClosed`,
lucide-react), abaixo de "Armários & Chapas".

## Página Colaboradores — ajustes

- Coluna Chapa/Armário exibe **duas badges**: uniforme (`Nº 12 · M`) e vestiário
  (`Vest. 40`), cada uma com estado "sem armário" próprio.
- **Desligar colaborador:** encerra **todas** as ocupações ativas (uniforme e
  vestiário); o diálogo de confirmação lista os armários que serão liberados.
  (Na fase 1 a query de desligamento já encerra por `employee_id` sem filtrar
  `kind`; esta fase só ajusta o texto do diálogo e as badges.)

## Tratamento de erros

- Mesmo mapeamento da fase 1 (unicidade → "Este armário acabou de ser ocupado";
  número duplicado no tipo → erro amigável).
- Faixa inválida (De > Até, valores não positivos, faixa > 500) → validação no
  diálogo antes do submit.

## Fora do escopo

- Importação CSV para vestiário.
- Sugestão de número igual ao da chapa.
- Criação por faixa na página de uniformes (lá o tamanho varia por armário;
  permanece individual + CSV).

## Verificação

Criar faixa 1–50 (repetir e conferir ignorados) → atribuir armário → badge dupla em
Colaboradores → transferir e liberar → desligar colaborador com dois armários e
conferir dupla liberação + histórico nos dois → confirmar que a página de uniformes
continua idêntica após a refatoração (regressão) → dark mode.
