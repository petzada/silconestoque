# Plano de Implementação — Fase 2: Colaborador como Solicitante na Saída

**Spec:** `docs/superpowers/specs/2026-07-13-fase2-solicitante-saida-design.md`
**Pré-requisito:** fase 1 (Chapas & Armários + Colaboradores) implementada.
**Data:** 2026-07-13

---

## Etapa 1 — Migração SQL

**Arquivo novo:** `supabase/migration_fase2_solicitante.sql`

```sql
ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movements_employee ON movements(employee_id);
```

Sem mudanças em triggers. Nenhum backfill.

**Verificação:** rodar no SQL Editor; inserir movimentação com `employee_id`
válido → passa; com UUID inexistente → falha de FK; deletar movimentação vinculada
→ estorno de estoque funciona como antes.

---

## Etapa 2 — Types

**Arquivo:** `lib/types.ts`

- `Movement`: + `employee_id: string | null`, `employee?: Employee`.
- `MovementFormData`: + `employee_id?: string`.
- `MovementFilters`: + `employeeId: string` (valor `'all'` = sem filtro).

**Verificação:** `npx tsc --noEmit` limpo.

---

## Etapa 3 — Combobox de solicitante no formulário de saída

**Arquivo:** `app/(dashboard)/movements/page.tsx`

1. Fetch de colaboradores ativos (id + nome) junto ao fetch de produtos existente.
2. No schema zod do formulário: + `employee_id: z.string().optional()`.
3. Quando `movementType === 'OUT'`, substituir o `Input` do campo `entity_name`
   por combobox `Popover` + `Command` (padrão do projeto):
   - busca filtra colaboradores ativos por nome (client-side);
   - selecionar item → `setValue('employee_id', id)` e
     `setValue('entity_name', full_name)`;
   - item "Usar '<texto>'" (sempre visível quando há texto digitado sem match
     exato) → `entity_name = texto`, `employee_id = undefined`;
   - opção de limpar o campo (opcional permanece).
4. Quando `movementType === 'IN'`: Input atual intocado; garantir
   `employee_id: null` no payload.
5. No submit (`movementData`): incluir `employee_id: values.employee_id || null`
   somente para OUT.

**Verificação:** criar saída com colaborador da lista (conferir no Supabase
`employee_id` + `entity_name`), com texto livre (`employee_id` nulo) e sem
solicitante; criar entrada e conferir payload sem `employee_id`.

---

## Etapa 4 — Filtro por colaborador + indicador na tabela

**Arquivo:** `app/(dashboard)/movements/page.tsx`

1. Query da listagem: incluir `employee:employees(id, full_name)` no select.
2. Novo Select "Colaborador" junto aos filtros atuais: opções = todos os
   colaboradores ordenados por nome, desligados ao final com sufixo
   "(desligado)"; filtra por `movement.employee_id === filters.employeeId`.
3. Coluna "Envolvido": quando `employee_id` preenchido, exibir ícone `UserCheck`
   (lucide) ao lado do nome com `title="Colaborador cadastrado"`.

**Verificação:** filtro retorna somente saídas vinculadas ao colaborador escolhido
(homônimo em texto livre NÃO aparece); ícone aparece apenas nas vinculadas.

---

## Etapa 5 — Sheet "Retiradas" na página Colaboradores

**Arquivo:** `app/(dashboard)/employees/page.tsx`

1. Nova ação "Retiradas" por linha (ícone `History` ou item no menu de ações).
2. Sheet com: nome do colaborador no título; lista de `movements` com
   `type = 'OUT'` e `employee_id = X`, join `products(name)`; colunas Data
   (dd/MM/yyyy HH:mm), Produto, Qtd; ordenação `created_at DESC`; estado vazio
   "Nenhuma retirada registrada".
3. Query executada ao abrir o Sheet (lazy), não no load da página.

**Verificação:** abrir retiradas de colaborador com e sem histórico; conferir que
desligado mantém o histórico acessível.

---

## Etapa 6 — Verificação final

1. `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos.
2. Roteiro manual da spec (seção Verificação) completo, incluindo dark mode.
3. Commits: `feat(db)`, `feat(movements)`, `feat(employees)`.
