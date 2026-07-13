# Plano de Implementação — Módulo Chapas & Armários + Colaboradores

**Spec:** `docs/superpowers/specs/2026-07-13-chapas-armarios-design.md`
**Data:** 2026-07-13

Cada etapa é pequena, independente e termina com verificação. Ordem pensada para o
app continuar funcional após cada commit.

---

## Etapa 1 — Migração SQL

**Arquivo novo:** `supabase/migration_chapas_armarios.sql` (aditivo, idempotente,
no padrão do `schema.sql`: `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`,
DO-blocks para constraints).

1. `roles`: `id UUID PK DEFAULT uuid_generate_v4()`, `name TEXT UNIQUE NOT NULL`,
   `created_at TIMESTAMPTZ DEFAULT NOW()`. Seed inicial:
   `Motorista`, `Auxiliar de Operação`, `Operador de Empilhadeira`
   (`ON CONFLICT (name) DO NOTHING`).
2. `employees`: `id`, `full_name TEXT NOT NULL`,
   `sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT`,
   `role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT`,
   `is_active BOOLEAN NOT NULL DEFAULT true`, `created_at`, `updated_at`.
   Índices nas FKs: `idx_employees_sector`, `idx_employees_role` e
   `idx_employees_active ON employees(is_active)`.
3. `lockers`: `id`, `kind TEXT NOT NULL CHECK (kind IN ('uniforme','vestiario'))`,
   `number INTEGER NOT NULL CHECK (number > 0)`,
   `size TEXT CHECK (size IN ('P','M','G','GG','XG','SSG'))`,
   `CHECK (kind <> 'uniforme' OR size IS NOT NULL)`,
   `is_active BOOLEAN NOT NULL DEFAULT true`, `created_at`,
   `UNIQUE (kind, number)`.
4. `locker_assignments`: `id`,
   `locker_id UUID NOT NULL REFERENCES lockers(id) ON DELETE RESTRICT`,
   `employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT`,
   `locker_kind TEXT NOT NULL`,
   `started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `ended_at TIMESTAMPTZ`,
   `created_at`. Índices: FKs (`locker_id`, `employee_id`) + parciais únicos:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_assignment_per_locker
     ON locker_assignments (locker_id) WHERE ended_at IS NULL;
   CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_assignment_per_employee_kind
     ON locker_assignments (employee_id, locker_kind) WHERE ended_at IS NULL;
   ```
5. Trigger `BEFORE INSERT` em `locker_assignments`: preenche `NEW.locker_kind`
   a partir de `lockers.kind` (e rejeita se o armário estiver `is_active = false`
   ou o colaborador `is_active = false`).
6. Função + trigger de `updated_at` em `employees` (`BEFORE UPDATE SET NOW()`).
7. RLS: habilitar nas 4 tabelas + política `"Allow all" FOR ALL USING (true)`
   (padrão do projeto).

**Verificação:** rodar no SQL Editor do Supabase; testar à mão:
- inserir 2 ocupações ativas no mesmo armário → 2ª falha;
- inserir 2ª ocupação de uniforme para o mesmo colaborador → falha;
- inserir armário uniforme sem `size` → falha;
- número repetido no mesmo `kind` → falha; mesmo número em `kind` diferente → passa.

---

## Etapa 2 — Types

**Arquivo:** `lib/types.ts`

- `LockerKind = 'uniforme' | 'vestiario'`;
  `LockerSize = 'P' | 'M' | 'G' | 'GG' | 'XG' | 'SSG'`;
  constante `LOCKER_SIZES: LockerSize[]` para selects/validação.
- `Role`, `Employee` (com `sector?: Sector`, `role?: Role`), `Locker`,
  `LockerAssignment` (com `employee?`, `locker?`).
- Form types: `EmployeeFormData` (full_name, sector_id, role_id),
  `LockerFormData` (number, size), `RoleFormData` (name).

**Verificação:** `npx tsc --noEmit` sem erros.

---

## Etapa 3 — Sidebar

**Arquivo:** `components/sidebar.tsx`

- Nova seção `{ label: 'Pessoal', items: [...] }` entre "Cadastro" e "Controle":
  - `Colaboradores` → `/employees`, ícone `Users`;
  - `Armários & Chapas` → `/lockers`, ícone `Lock` (lucide-react).

**Verificação:** app roda, itens aparecem, rotas 404 por enquanto (páginas vêm nas
etapas 4–5) — aceitável dentro do mesmo PR; commits das etapas 3+4+5 podem ser
agrupados se preferir não expor rota quebrada.

---

## Etapa 4 — Página Colaboradores

**Arquivo novo:** `app/(dashboard)/employees/page.tsx` (client component, padrão
das páginas existentes: PageContainer + Card + Table + Dialog + sonner).

1. **Listagem:** query Supabase `employees` com join `sectors`, `roles` e a
   ocupação ativa (`locker_assignments` com `ended_at IS NULL` → `lockers`), em
   uma única consulta (evitar N+1). Colunas: Nome, Setor, Função, Chapa/Armário
   (Badge `Nº 01 · M` ou "sem armário"), Status, Ações.
2. **Busca e filtros:** busca por nome (client-side), Selects de setor, função e
   status. Desligados esmaecidos (`opacity`), ordenação: ativos primeiro, nome asc.
3. **Dialog Novo/Editar colaborador:** nome, setor (Select), função (Select).
4. **Dialog "Funções":** lista + criar/renomear/excluir; excluir função em uso →
   toast de erro amigável (mapear violação de FK RESTRICT).
5. **Desligar:** Dialog de confirmação; texto informa o armário que será liberado
   (se houver). Ação: `UPDATE employees SET is_active = false` + `UPDATE
   locker_assignments SET ended_at = NOW()` da ocupação ativa (nessa ordem, e
   exibir erro se qualquer passo falhar).
6. **Reativar:** volta `is_active = true`, sem armário.

**Verificação:** criar/editar/desligar/reativar colaboradores reais no app;
conferir filtros, dark mode e toasts.

---

## Etapa 5 — Página Armários & Chapas

**Arquivo novo:** `app/(dashboard)/lockers/page.tsx`
(se crescer demais, extrair `components/lockers/` — painel e diálogos).

1. **Data fetch:** `lockers` com `kind = 'uniforme'` + ocupação ativa + colaborador,
   em uma única query; lista de colaboradores ativos sem armário para o combobox.
2. **Cards de resumo:** Total, Ocupados, Livres, Colaboradores ativos sem armário
   (derivados do fetch, sem queries extras).
3. **Filtros/ações:** busca por nº ou nome do ocupante; Select tamanho; Select
   status (todos/ocupado/livre/inativo); botões "+ Novo armário" e "Importar CSV".
4. **Grade:** grid responsivo (`grid-cols` adaptativo) de cards: número grande,
   badge tamanho, nome curto do ocupante ou "livre". Estados com tokens do design
   system: ocupado = accent verde, livre = borda tracejada, inativo = esmaecido.
5. **Sheet de detalhes** (componente `ui/sheet` existente):
   - Ocupado: dados do ocupante + desde; botões "Liberar" (confirmação) e
     "Transferir" (combobox de colaboradores elegíveis); histórico (lista de
     ocupações ordenada desc, nome + período).
   - Livre: combobox "Atribuir a colaborador" (ativos sem armário de uniforme) +
     confirmar; histórico; ações "Editar" (número/tamanho) e "Desativar".
   - Erros de unicidade (corrida entre admins) → toast "Este armário acabou de
     ser ocupado" + refetch.
6. **Dialog Novo armário:** número + tamanho; erro amigável para número duplicado.
7. **Dialog Importar CSV:** input file; parse client-side (split por linha/vírgula
   ou ponto-e-vírgula, sem dependência); tabela de pré-visualização com linhas
   válidas/inválidas e motivo (tamanho inválido, duplicado no arquivo, número já
   existente); botão importa apenas as válidas (insert em lote único) e mostra
   resumo do resultado.
8. **Transferir/Liberar/Atribuir:** operações via Supabase:
   liberar = `UPDATE ... SET ended_at = NOW()`;
   atribuir = `INSERT locker_assignments (locker_id, employee_id)`;
   transferir = liberar + atribuir em sequência com tratamento de erro em cada
   passo (constraints do banco garantem consistência mesmo em corrida).

**Verificação:** fluxo completo no app — criar armários (um a um + CSV com linhas
inválidas de propósito), atribuir, transferir, liberar, desativar, desligar
colaborador na outra página e conferir liberação automática + histórico no Sheet.

---

## Etapa 6 — Verificação final e commit

1. `npx tsc --noEmit` e `npm run lint` limpos.
2. `npm run build` sem erros.
3. Roteiro manual da spec (seção Verificação) completo, incluindo dark mode e
   grade responsiva em janela estreita.
4. Commits por etapa (`feat(db)`, `feat(employees)`, `feat(lockers)` etc.).

## Fora do escopo (fases futuras)

- Fase 2: seletor de colaborador nas saídas de estoque (substituir `entity_name`).
- Fase 3: armários de vestiário (`kind = 'vestiario'`) — banco já pronto; UI ganha
  alternância de tipo na página de armários.
