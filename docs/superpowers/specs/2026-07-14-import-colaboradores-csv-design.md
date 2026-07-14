# Importação de colaboradores via CSV + separação de setores

**Data:** 2026-07-14
**Status:** Aprovado

## Problema

Dois problemas acoplados.

**1. Setor de pessoa e setor de material são a mesma tabela.** Hoje `employees.sector_id` referencia `sectors`, exatamente a mesma tabela que `products.sector_id` usa (`migration_chapas_armarios.sql:26`). Os setores cadastrados — Copa e Limpeza, EPIs, Manutenção Elétrica, Pintura e Predial — são categorias de material do almoxarifado, não departamentos de pessoas. Cadastrar um departamento real como "Administrativo" polui a lista de categorias de produto, e "EPIs" aparece como opção de setor ao cadastrar um colaborador.

**2. Não há importação em massa de colaboradores.** O quadro de funcionários é cadastrado um a um. Existe uma planilha com nome, setor e função de todos.

## Decisões

| Questão | Decisão |
|---|---|
| Como separar os setores | Nova tabela `departments`, só para pessoas. `sectors` fica intocada para produtos. |
| Setor/função inexistente no CSV | Rejeita a linha. Nada é criado automaticamente. |
| Seed de `departments` | Nasce vazia. `employees` hoje só tem dados de teste, que são apagados. |
| Nome já cadastrado | Rejeita a linha. |
| Onde cadastrar departamentos | Diálogo na página Colaboradores, ao lado do de Funções. |

O cadastro é controlado de propósito: um typo na planilha ("Manutensao") não pode virar departamento fantasma. O custo é que setores e funções precisam existir antes da importação, e a prévia foi desenhada para tornar isso barato.

## Modelo de dados

```
sectors      → products.sector_id       (material: EPIs, Copa e Limpeza…)   sem mudança
departments  → employees.department_id  (gente: Produção, Administrativo…)  novo
roles        → employees.role_id        (função)                            sem mudança
```

### Migração — `supabase/migration_colaboradores_csv.sql`

Aditiva e idempotente, no padrão das migrações anteriores.

1. `CREATE TABLE IF NOT EXISTS departments` — mesma forma de `sectors`: `id UUID PK`, `name TEXT UNIQUE NOT NULL`, `created_at TIMESTAMPTZ`. RLS habilitada com policy "Allow all", igual às demais tabelas.
2. **Limpeza dos dados de teste, guardada para rodar só na primeira execução.** Envolver num bloco `DO $$ ... $$` condicionado à existência da coluna `employees.sector_id` em `information_schema.columns`. Dentro do bloco, nesta ordem: `DELETE FROM locker_assignments;` depois `DELETE FROM employees;`. A ordem importa porque `locker_assignments.employee_id` é `ON DELETE RESTRICT` — o inverso falha. Os armários (`lockers`) **não** são apagados.
3. `ALTER TABLE employees DROP COLUMN IF EXISTS sector_id;` e `ADD COLUMN IF NOT EXISTS department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT;` + `idx_employees_department`.
4. `CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_full_name ON employees (lower(trim(full_name)));`

O guard do passo 2 é obrigatório. Sem ele o arquivo não seria idempotente de verdade: uma segunda execução no SQL Editor apagaria os colaboradores já importados de produção. A presença de `sector_id` é o sinal confiável de "banco ainda no estado antigo", porque o passo 3 a remove — logo, na segunda execução o bloco inteiro é pulado.

O passo 4 é o que faz o banco garantir a regra de nome único. Sem ele, uma reimportação rápida ou dois cliques em Importar ainda duplicariam. O front apenas antecipa a mensagem amigável; o banco é a última linha de defesa.

### Impacto no código existente

Cinco arquivos, todos mecânicos. Nenhuma tela de produto, pedido de compra, fila de reposição, variação de preço ou dashboard é tocada — todas leem `sectors` através do produto.

| Arquivo | Mudança |
|---|---|
| `lib/types.ts` | Novo tipo `Department`. Em `Employee`: `sector_id` → `department_id`, `sector?: Sector` → `department?: Department`. Idem em `EmployeeFormData`. |
| `app/(dashboard)/employees/page.tsx` | Filtro (l. 452), coluna da tabela (l. 479-482), select do formulário, reset do form (l. 221). |
| `components/lockers/locker-utils.ts` | Joins `sector:sectors(name)` → `department:departments(name)` (l. 72, 79). |
| `components/lockers/locker-sheet.tsx` | Exibição `employee.sector?.name` → `employee.department?.name` (l. 88, 311). |
| `app/(dashboard)/movements/page.tsx` | A l. 173 traz `sector:sectors(*)` no join de employees, mas nada consome — o filtro de setor da tela usa o setor do *produto* (l. 305). Remover o join morto em vez de portá-lo. |

## Importação

### Formato

Separado por `;`, UTF-8 com fallback automático para windows-1252 (o que o Excel brasileiro gera). Mesmo decoder já usado em `products/page.tsx:324-331`.

```
nome;setor;funcao
João da Silva;Produção;Motorista
Maria Souza;Logística;Auxiliar de Operação
```

Cabeçalho comparado sem acento e sem caixa: `Nome;Setor;Função` e `nome;setor;funcao` são equivalentes. Faltando qualquer uma das três colunas, o arquivo é recusado inteiro antes de validar linhas.

Os valores de `setor` e `funcao` casam com o cadastro **por nome, ignorando acento e caixa** — "produção", "PRODUÇÃO" e "Producao" resolvem para o mesmo departamento. Sem isso, o cadastro controlado viraria uma caça a acento.

### Validação

Cada linha é avaliada em ordem; o primeiro problema encontrado a manda para o relatório de erros:

1. Nome vazio → `Nome vazio`
2. Setor não cadastrado → `Setor "X" não existe`
3. Função não cadastrada → `Função "Y" não existe`
4. Nome já existe no banco → `Já cadastrado`
5. Nome repetido dentro do próprio arquivo → `Nome duplicado no arquivo (linha N)`

A regra 5 não foi pedida, mas é necessária: sem ela, um nome repetido na planilha passa a validação, a primeira linha entra e a segunda estoura no índice único, derrubando a importação inteira com erro técnico do Postgres. Com ela, vira um erro legível na prévia.

### Prévia

Nada é gravado até o usuário confirmar. O resumo agrupa os desconhecidos por **valor distinto**, não por linha — é a diferença entre "cadastre estes 3 setores" e rolar 44 erros idênticos.

```
✓ 30 colaboradores prontos para importar
✗ 14 linhas com erro

Setores não cadastrados          Funções não cadastradas
  • Administrativo   (8 linhas)    • Soldador     (3 linhas)
  • Manutensao       (1 linha)
                          [Cadastrar setores]  [Cadastrar funções]

Erros por linha                              [Exportar PDF]
  linha  5   Ana Lima      Setor "Administrativo" não existe
  linha 12   (vazio)       Nome vazio
  …
              [Cancelar]   [Importar 30 colaboradores]
```

Os botões "Cadastrar setores/funções" apenas **abrem o diálogo de cadastro** — não criam nada sozinhos. Após salvar, a prévia revalida o arquivo já carregado em memória, sem exigir novo upload.

**Importação parcial é permitida**, como no import de Produtos: grava os 30 válidos e reporta os 14. O usuário cadastra o que faltou e reimporta a mesma planilha — os 30 voltam como "Já cadastrado" e só os 14 restantes entram. O fluxo converge sem exigir editar o CSV.

A gravação é um único `supabase.from('employees').insert([...])` com o array inteiro: ou entram todos os válidos, ou nenhum.

O PDF de erros reusa `jsPDF` + `autoTable` no mesmo formato de `products/page.tsx:390-428`.

## UI e organização do código

Barra de ações da página Colaboradores: `[Setores] [Funções] [Importar CSV] [+ Novo colaborador]`.

O CRUD de Funções hoje está inline em `employees/page.tsx`, que já tem ~950 linhas. O de Setores é idêntico em comportamento (listar, criar, renomear, excluir com proteção de FK). Em vez de duplicar ~120 linhas, extrair um componente e usá-lo nos dois.

Arquivos novos:

- `lib/employee-import.ts` — parsing e validação como funções puras, sem React. Testável isoladamente.
- `components/employees/simple-crud-dialog.tsx` — diálogo genérico de lista nome-única, usado por Setores e Funções.
- `components/employees/import-dialog.tsx` — upload, prévia, confirmação.

Sem isso, `employees/page.tsx` passaria de 1200 linhas.

## Fora de escopo

- Coluna de matrícula/CPF no CSV. O nome é a chave, com unicidade garantida no banco. Homônimo real é cadastrado à mão pela tela.
- Atualizar colaborador existente via CSV (upsert). Importação só insere.
- Exportar colaboradores para CSV.
