# Plano de Implementação — Fase 3: Armários do Vestiário

**Spec:** `docs/superpowers/specs/2026-07-13-fase3-vestiario-design.md`
**Pré-requisito:** fase 1 (Chapas & Armários + Colaboradores) implementada.
Independente da fase 2. **Nenhuma migração de banco** — o modelo da fase 1 já
suporta `kind = 'vestiario'`.

---

## Etapa 1 — Refatoração: extrair componentes compartilhados

**Arquivos novos:** `components/lockers/locker-grid.tsx`,
`components/lockers/locker-sheet.tsx`, `components/lockers/locker-form-dialog.tsx`
**Arquivo alterado:** `app/(dashboard)/lockers/page.tsx`

1. Mover da página de uniformes para os componentes, todos recebendo
   `kind: LockerKind` como prop:
   - `locker-grid`: cards de resumo, filtros (busca, status; filtro/badge de
     tamanho renderizados só quando `kind === 'uniforme'`) e grade de cards.
   - `locker-sheet`: painel de detalhes com atribuir/liberar/transferir,
     histórico, editar e desativar. Combobox de atribuição: colaboradores ativos
     sem ocupação ativa do MESMO `kind`.
   - `locker-form-dialog`: novo/editar armário; campo tamanho só para uniforme.
2. A página `/lockers` passa a compor esses componentes com `kind="uniforme"`;
   o diálogo de importação CSV permanece na página (não vai para o compartilhado).
3. Queries parametrizadas por `kind` (fetch de armários, resumo, elegíveis).

**Verificação (regressão):** repetir o fluxo completo da fase 1 na página de
uniformes — criar, importar CSV, atribuir, transferir, liberar, desativar,
histórico — comportamento idêntico ao anterior. `npx tsc --noEmit` limpo.

---

## Etapa 2 — Página `/vestiario` + sidebar

**Arquivo novo:** `app/(dashboard)/vestiario/page.tsx`
**Arquivo alterado:** `components/sidebar.tsx`

1. Página compõe `locker-grid` + `locker-sheet` + `locker-form-dialog` com
   `kind="vestiario"` (sem CSV; botão "Criar por faixa" entra na Etapa 3).
2. Sidebar: item **Vestiário** → `/vestiario` na seção "Pessoal", abaixo de
   "Armários & Chapas", ícone `DoorClosed` (lucide-react).

**Verificação:** criar armário individual no vestiário; atribuir/liberar/
transferir; conferir que números repetidos entre uniforme e vestiário são
permitidos, e repetidos dentro do vestiário são bloqueados; cards de resumo
corretos.

---

## Etapa 3 — Diálogo "Criar por faixa"

**Arquivo novo:** `components/lockers/locker-range-dialog.tsx`
(usado apenas pela página `/vestiario`)

1. Campos "De" e "Até" (inteiros ≥ 1, De ≤ Até, máximo 500 números por operação);
   validação inline antes de habilitar o botão.
2. Pré-visualização ao confirmar a faixa: consulta números existentes do `kind`
   na faixa e mostra "X serão criados · Y já existem (ignorados: 3, 7, 12…)".
3. Gravação: um único insert em lote dos números inexistentes
   (`kind='vestiario'`, `size=null`); toast de resumo "45 criados, 5 ignorados".
4. Erro de corrida (número criado por outro admin entre preview e insert):
   capturar violação de unicidade, informar e refazer o preview.

**Verificação:** criar faixa 1–50; repetir a mesma faixa → 0 criados, 50
ignorados; faixa parcialmente sobreposta → só os novos; faixa inválida
(De > Até, 0, > 500) bloqueada no diálogo.

---

## Etapa 4 — Página Colaboradores: badges duplas + desligamento

**Arquivo:** `app/(dashboard)/employees/page.tsx`

1. Query da listagem: buscar TODAS as ocupações ativas do colaborador (uniforme e
   vestiário) com os dados do armário.
2. Coluna Chapa/Armário: duas badges — `Nº 12 · M` (uniforme) e `Vest. 40` —
   cada uma com seu estado "sem armário" (visual discreto para não poluir).
3. Diálogo de desligamento: listar os armários que serão liberados (0, 1 ou 2);
   a ação encerra todas as ocupações ativas do colaborador
   (`UPDATE locker_assignments SET ended_at = NOW() WHERE employee_id = X AND
   ended_at IS NULL` — sem filtro de `kind`).

**Verificação:** colaborador com os dois armários → desligar libera ambos
(conferir nas duas páginas de armários + histórico); com apenas um → libera o
que existe; reativar volta "sem armário" nos dois.

---

## Etapa 5 — Verificação final

1. `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos.
2. Roteiro manual da spec (seção Verificação), incluindo a regressão completa da
   página de uniformes e dark mode.
3. Commits: `refactor(lockers)`, `feat(vestiario)`, `feat(employees)`.
