# Plano de Implementação — Importação de Colaboradores via CSV + Separação de Setores

**Spec:** `docs/superpowers/specs/2026-07-14-import-colaboradores-csv-design.md`
**Pré-requisito:** fases 1–3 (Colaboradores, Chapas & Armários, Vestiário) implementadas.

**Migração destrutiva.** A etapa 1 apaga `employees` e `locker_assignments` (dados
de teste, confirmado com o usuário). Os armários (`lockers`) são preservados.

As etapas 1 e 2 formam uma unidade: entre elas o projeto **não compila** (a coluna
`sector_id` deixa de existir enquanto o código ainda a referencia). Só rodar
`tsc` ao fim da etapa 2.

---

## Etapa 1 — Migração de banco + tipos

**Arquivo novo:** `supabase/migration_colaboradores_csv.sql`
**Arquivo alterado:** `lib/types.ts`

1. `CREATE TABLE IF NOT EXISTS departments` — `id UUID PK DEFAULT uuid_generate_v4()`,
   `name TEXT UNIQUE NOT NULL`, `created_at TIMESTAMPTZ DEFAULT NOW()`. Sem seed.
   RLS habilitada + policy `"Allow all"`, no padrão das outras tabelas.
2. Limpeza dos dados de teste **dentro de um bloco `DO $$`** condicionado à
   existência de `employees.sector_id` em `information_schema.columns`. Dentro,
   nesta ordem: `DELETE FROM locker_assignments;` depois `DELETE FROM employees;`
   (o inverso viola o `ON DELETE RESTRICT` de `locker_assignments.employee_id`).
   O guard é o que mantém o arquivo idempotente — na segunda execução `sector_id`
   já não existe e o bloco inteiro é pulado, preservando dados reais.
3. `ALTER TABLE employees DROP COLUMN IF EXISTS sector_id;` e
   `ADD COLUMN IF NOT EXISTS department_id UUID NOT NULL REFERENCES departments(id)
   ON DELETE RESTRICT;` + `CREATE INDEX idx_employees_department`.
4. `CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_full_name
   ON employees (lower(trim(full_name)));` — garantia de nome único no banco.
5. `lib/types.ts`: novo tipo `Department` (igual a `Sector`); em `Employee`,
   `sector_id` → `department_id` e `sector?: Sector` → `department?: Department`;
   mesma troca em `EmployeeFormData`. **Não** mexer em `Sector` nem em `Product`.

**Verificação:** rodar o SQL no Supabase; rodar **de novo** e confirmar que passa
sem erro e sem apagar nada (idempotência). Conferir que `lockers` continua
populada e que `INSERT` em `employees` sem `department_id` é rejeitado.

---

## Etapa 2 — Portar as telas para `department`

**Arquivos:** `app/(dashboard)/employees/page.tsx`,
`components/lockers/locker-utils.ts`, `components/lockers/locker-sheet.tsx`,
`app/(dashboard)/movements/page.tsx`

1. `employees/page.tsx`: buscar `departments` em vez de `sectors`; renomear estado
   e schema zod (`sector_id` → `department_id`); filtro (l. 452), coluna da tabela
   (l. 479-482), select do formulário e `form.reset` (l. 221). Rótulo visível
   continua **"Setor"** — a troca é só técnica, o usuário não vê "departamento".
2. `locker-utils.ts` (l. 72, 79): joins `employee:employees(... sector:sectors(name) ...)`
   → `department:departments(name)`.
3. `locker-sheet.tsx` (l. 88, 311): `employee.sector?.name` → `employee.department?.name`.
4. `movements/page.tsx` (l. 173): **remover** `sector:sectors(*)` do select de
   `employees` — join morto, nada o consome. O filtro de setor da tela usa
   `movement.product?.sector_id` (l. 305) e não muda.

**Verificação (regressão):** `npx tsc --noEmit` limpo. Cadastrar um departamento
direto no Supabase, criar um colaborador pela tela, atribuir chapa e armário de
vestiário, conferir nome/setor/função no painel do armário, desligar e reativar.
Página de Movimentações: registrar saída com solicitante, conferir que o filtro
de setor (do produto) continua correto.

---

## Etapa 3 — Diálogo de Setores (extraindo o de Funções)

**Arquivo novo:** `components/employees/simple-crud-dialog.tsx`
**Arquivo alterado:** `app/(dashboard)/employees/page.tsx`

1. Extrair o CRUD de Funções que hoje está inline (l. 776-876) para um componente
   genérico de lista de nome único: props `title`, `description`, `table`,
   `placeholder`, `onChanged`. Comportamento preservado: criar, renomear inline,
   excluir com `ConfirmDialog` e mensagem específica de violação de FK
   ("está em uso por colaboradores").
2. Usar o componente **duas vezes**: Funções (`roles`) e Setores (`departments`).
   Botão "Setores" ao lado de "Funções" na barra de ações.
3. Mensagem de FK do diálogo de Setores: "Este setor está em uso por
   colaboradores. Reatribua-os antes de excluir."

**Verificação:** criar/renomear/excluir setor e função pelos dois diálogos;
tentar excluir um setor em uso → erro amigável, nada apagado; a lista do select
de colaborador reflete as mudanças sem recarregar a página.

---

## Etapa 4 — Parsing e validação (puro, sem React)

**Arquivo novo:** `lib/employee-import.ts`

1. `parseEmployeeCsv(text)`: split por `;`, cabeçalho normalizado sem acento/caixa
   (NFD + strip diacríticos, reusando a técnica de `slugifySectorName` em
   `products/page.tsx:121`). Exige `nome`, `setor`, `funcao`; faltando qualquer
   uma, retorna erro de arquivo (não de linha).
2. `validateEmployeeRows(rows, { departments, roles, existingNames })`: aplica as
   regras **em ordem**, primeiro problema encerra a linha:
   1. Nome vazio → `Nome vazio`
   2. Setor não cadastrado → `Setor "X" não existe`
   3. Função não cadastrada → `Função "Y" não existe`
   4. Nome já existe no banco → `Já cadastrado`
   5. Nome repetido no próprio arquivo → `Nome duplicado no arquivo (linha N)`
   Casamento de setor/função e detecção de duplicata: por nome **sem acento e sem
   caixa**, com `trim`.
3. Retorno: `{ valid: [{ full_name, department_id, role_id }], errors: [{ line,
   name, reason }], missingDepartments: [{ name, count }], missingRoles: [{ name,
   count }] }` — os `missing*` agrupados por valor distinto, com contagem de linhas.
4. Decode do arquivo (UTF-8 com fallback windows-1252) fica aqui também, reusando
   o bloco de `products/page.tsx:324-331`.

**Verificação:** exercitar as funções com CSVs de fixture cobrindo cada uma das 5
regras, acento divergente ("PRODUCAO" casando com "Produção"), cabeçalho fora de
ordem, cabeçalho com coluna faltando, arquivo só com cabeçalho, e linha com
`;` sobrando. Sem UI ainda.

---

## Etapa 5 — Diálogo de importação

**Arquivo novo:** `components/employees/import-dialog.tsx`
**Arquivo alterado:** `app/(dashboard)/employees/page.tsx`

1. Upload (`accept=".csv"`), guardando o **texto do arquivo em memória** para
   permitir revalidar sem novo upload.
2. Prévia: contadores (válidos / com erro); blocos "Setores não cadastrados" e
   "Funções não cadastradas" agrupados por valor distinto com contagem de linhas,
   cada um com botão que **abre o diálogo de cadastro correspondente** (não cria
   nada sozinho); tabela de erros por linha; "Exportar PDF" reusando o formato de
   `products/page.tsx:390-428`.
3. Ao fechar o diálogo de cadastro, **revalidar o texto em memória** contra os
   setores/funções recarregados — os blocos de faltantes encolhem sem novo upload.
4. Gravação: um único `supabase.from('employees').insert([...])` com todos os
   válidos. Importação parcial é permitida (grava os válidos, reporta os erros).
   Botão desabilitado quando `valid.length === 0`.
5. Erro de unicidade vindo do banco (corrida): capturar, informar
   "Alguns nomes já foram cadastrados. Revalide o arquivo." e revalidar.
6. Ao concluir: toast com o resumo, fechar diálogo, `fetchData()`.

**Verificação (fluxo real):** planilha com ~40 linhas incluindo setor inexistente,
função inexistente, nome vazio, nome repetido no arquivo e nome já cadastrado.
Conferir: nada gravado antes de confirmar; cadastrar o setor faltante pelo botão
da prévia e ver o bloco encolher sem reupload; importar parcial; **reimportar a
mesma planilha** → 0 novos e todos como "Já cadastrado" (é a prova de que a
unicidade funciona ponta a ponta); PDF de erros abre e lista as linhas certas.

---

## Etapa 6 — Verificação final

1. `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos.
2. Regressão das telas que tocam colaborador: Armários & Chapas, Vestiário,
   Movimentações (saída com solicitante), Colaboradores.
3. Confirmar que Produtos, Setores (produto), Pedidos, Reposição, Variação de
   Preço e Dashboard seguem intactos — nenhum deles foi tocado.
4. Dark mode nos diálogos novos (usar tokens, nunca cor hardcoded).
5. Commits sugeridos: `feat(db)` migração + tipos · `refactor(employees)` port para
   department · `feat(employees)` diálogo de setores · `feat(employees)` importação CSV.
