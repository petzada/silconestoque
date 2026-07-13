# Módulo Chapas & Armários + Cadastro de Colaboradores — Design

**Data:** 2026-07-13
**Status:** Aprovado pelo usuário (brainstorming concluído)

## Objetivo

Registrar as chapas (números) de roupa dos colaboradores, atrelando cada chapa a um
tamanho (P, M, G, GG, XG, SSG) e a um armário físico. O número do armário é o mesmo
número da chapa. Cada armário tem tamanho fixo e no máximo um ocupante; cada
colaborador ocupa no máximo um armário de uniforme. Inclui um cadastro global de
colaboradores que servirá a toda a aplicação.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Colaboradores | Cadastro completo e **global** (não restrito ao módulo): nome, setor, função, status ativo/desligado |
| Funções | Entidade própria, cadastrável pelo admin (ex.: Motorista, Auxiliar de Operação, Operador de Empilhadeira) |
| Tamanho | Propriedade **fixa do armário** (armário 37 = M para sempre); enum fixo `P, M, G, GG, XG, SSG` |
| Cadastro de armários | Um a um + importação de planilha (CSV/XLSX) |
| Vínculo | 1:1 estrito por tipo de armário; garantido no banco |
| Histórico | Toda ocupação registrada com início/fim (auditável) |
| Modelagem | Modelo genérico de armários com coluna `kind` (`uniforme` \| `vestiario`) |
| Navegação | Nova seção "Pessoal" no sidebar com as páginas Colaboradores e Armários & Chapas |
| Tela principal | Grade visual de armários (cards por número/tamanho/status) |

### Fases futuras (fora deste escopo, mas consideradas no modelo)

- **Fase 2:** trocar o campo texto livre (`entity_name`) das saídas de estoque por um
  seletor da lista de colaboradores.
- **Fase 3:** armários de **vestiário** — mesma lógica, numeração independente, sem
  tamanho. O banco já nasce pronto (`kind = 'vestiario'`); a UI desta fase só cria e
  exibe `kind = 'uniforme'`.

## Modelo de dados (Supabase/Postgres)

Nova migração em `supabase/` seguindo o padrão do projeto (RLS "Allow all", senha
única compartilhada no app).

### `roles`
- `id UUID PK`, `name TEXT UNIQUE NOT NULL`, `created_at`
- Exclusão bloqueada se em uso (`ON DELETE RESTRICT` a partir de `employees`).

### `employees`
- `id UUID PK`
- `full_name TEXT NOT NULL`
- `sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT`
- `role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `created_at`, `updated_at`

### `lockers`
- `id UUID PK`
- `kind TEXT NOT NULL CHECK (kind IN ('uniforme','vestiario'))`
- `number INTEGER NOT NULL`
- `size TEXT CHECK (size IN ('P','M','G','GG','XG','SSG'))` — obrigatório quando
  `kind = 'uniforme'` (CHECK: `kind <> 'uniforme' OR size IS NOT NULL`), nulo para vestiário
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `created_at`
- `UNIQUE (kind, number)` — numeração independente por tipo

### `locker_assignments`
- `id UUID PK`
- `locker_id UUID NOT NULL REFERENCES lockers(id) ON DELETE RESTRICT`
- `employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT`
- `started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `ended_at TIMESTAMPTZ` — nulo = ocupação vigente
- `created_at`
- Índices únicos parciais (garantia no banco, à prova de corrida):
  - `UNIQUE (locker_id) WHERE ended_at IS NULL` — 1 ocupante por armário
  - 1 ocupação ativa por colaborador **por tipo**: coluna denormalizada
    `locker_kind TEXT NOT NULL` em `locker_assignments`, preenchida e validada por
    trigger `BEFORE INSERT` (copia `lockers.kind`), com índice único parcial
    `UNIQUE (employee_id, locker_kind) WHERE ended_at IS NULL`.

### Consultas que o modelo responde
Armários livres por tamanho; ocupante atual do armário N; chapa do colaborador X;
histórico de quem usou o armário N; colaboradores ativos sem armário.

## Regras de negócio

- **Atribuir:** apenas colaboradores ativos e sem armário do mesmo tipo. Violação de
  unicidade (concorrência) exibe erro amigável: "Este armário acabou de ser ocupado".
- **Liberar:** define `ended_at = NOW()` na ocupação vigente.
- **Transferir:** libera a ocupação atual e cria a nova em uma operação.
- **Desligar colaborador:** confirmação explícita informando qual armário será
  liberado; encerra a ocupação ativa automaticamente. Reativar **não** devolve o
  armário antigo — colaborador volta como "sem armário".
- **Editar armário:** número/tamanho editáveis; número valida duplicidade por tipo.
- **Desativar armário:** somente se livre; some da atribuição, mantém histórico.
- **Excluir armário:** apenas se nunca teve ocupações; caso contrário, só desativar.
- **Excluir função:** bloqueado se em uso; sugerir reatribuição.
- **Importação de planilha (armários):** arquivo CSV com colunas `numero, tamanho`; pré-visualização
  com validação (tamanho fora do enum, duplicado no arquivo, número já existente);
  importa apenas linhas válidas e apresenta relatório das ignoradas.

## UI/UX (admin)

### Navegação
Nova seção **"Pessoal"** no sidebar (`components/sidebar.tsx`), entre "Cadastro" e
"Controle":
- 👥 **Colaboradores** → `/employees`
- 🔒 **Armários & Chapas** → `/lockers`

### Página Colaboradores (`app/(dashboard)/employees/page.tsx`)
- Tabela CRUD no padrão de Produtos/Setores: Nome, Setor, Função, Chapa/Armário
  (badge "Nº 01 · M" ou "sem armário"), Status, Ações (Editar · Desligar / Reativar).
- Busca por nome; filtros por setor, função e status.
- Botão "⚙ Funções" abre Dialog de CRUD de funções.
- Formulário de colaborador em Dialog (nome, setor, função).
- Desligados aparecem esmaecidos com ação "Reativar".

### Página Armários & Chapas (`app/(dashboard)/lockers/page.tsx`)
- **Cards de resumo:** Total, Ocupados, Livres, Colaboradores sem armário.
- **Filtros:** busca (colaborador ou nº), tamanho, status; botões "+ Novo armário"
  e "Importar planilha".
- **Grade visual:** um card por armário com número, tamanho e ocupante;
  verde/preenchido = ocupado, tracejado = livre, esmaecido = inativo.
  Cores via tokens do design system (nunca hardcoded), com suporte a dark mode.
- **Painel lateral (Sheet)** ao clicar em um armário:
  - *Ocupado:* ocupante atual (nome, setor, função, desde), ações "Liberar" e
    "Transferir para outro colaborador", histórico de ocupações.
  - *Livre:* busca de colaborador ativo sem armário + "Confirmar atribuição",
    histórico, ações "Editar" e "Desativar armário".

## Arquitetura / arquivos

| Item | Local |
|---|---|
| Migração SQL | `supabase/` (novo arquivo, aditivo ao `schema.sql`) |
| Types | `lib/types.ts` (`Role`, `Employee`, `Locker`, `LockerAssignment`, form types) |
| Página Colaboradores | `app/(dashboard)/employees/page.tsx` |
| Página Armários | `app/(dashboard)/lockers/page.tsx` |
| Sidebar | `components/sidebar.tsx` (seção "Pessoal") |
| Componentes | shadcn/ui existentes: Sheet, Dialog, Table, Select, Badge, Command |

Sem novas dependências: a importação aceita **CSV** (parse nativo no cliente).
Suporte a XLSX fica fora deste escopo; se o usuário tiver Excel, salva como CSV.

## Tratamento de erros

- Erros de unicidade do banco mapeados para mensagens amigáveis em pt-BR (toast via
  sonner, padrão do app).
- Ações destrutivas (desligar, liberar, desativar) com diálogo de confirmação
  descrevendo a consequência.
- Importação nunca grava parcialmente sem informar: mostra pré-visualização, importa
  válidas e lista ignoradas com motivo.

## Verificação

Fluxo manual completo: criar funções → colaboradores → armários (individual +
planilha) → atribuir → transferir → desligar colaborador (conferir liberação
automática + histórico) → reativar (conferir "sem armário") → validar bloqueios de
duplicidade (número repetido, segundo armário para o mesmo colaborador) → conferir
dark mode e responsividade da grade.
