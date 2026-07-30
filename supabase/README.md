# supabase/ — guia de aplicação

Não existe runner de migration neste projeto: nenhum diretório
`supabase/migrations/`, nenhuma tabela de controle até a Fase 1, nomes de
arquivo sem ordem embutida. Todo arquivo aqui é aplicado à mão, colado no SQL
Editor do Supabase. **O estado real de qualquer banco específico não é
verificável a partir deste repositório.** A lista abaixo é reconstruída a
partir dos comentários de prosa de cada arquivo e do `git log --follow`
(datas de commit, não datas reais de execução no SQL Editor) — é a melhor
reconstrução possível, não uma auditoria contra o banco.

A partir da Fase 1 existe `schema_migrations` (ver §3), criada e
retroalimentada por `migration_fase1_higiene.sql`. Ela também é só
bookkeeping: nada no Postgres impede que alguém rode um arquivo sem
registrá-lo lá.

## 1. Instalação NOVA (banco vazio)

Rode **apenas** `schema.sql`. Ele é o snapshot completo: contém todas as
tabelas, funções, triggers e índices no estado final, incluindo o que hoje
vive em `migration_chapas_armarios.sql`, `migration_colaboradores_csv.sql`,
`migration_fase2_solicitante.sql`, `migration_categorias_produtos.sql`,
`migration_custo_congelado_saida.sql` (só a parte de trigger — o backfill
foi neutralizado, ver §2), `migration_quiz_seguranca.sql`,
`migration_fase0_integridade.sql` e `migration_fase3_analitico.sql`
(`movements.department_id` + trigger de carimbo + índices + os 5 RPCs de
dashboard; `dashboard_stats` já não existe neste arquivo — ver §2, linha 13).
Depois disso, rode só `migration_fase1_higiene.sql` (que cria e popula
`schema_migrations`) e pronto — não rode as migrations históricas listadas
em §2 por cima, elas regridem nada, mas são redundantes e não fazem parte do
caminho de instalação nova.

Gap conhecido, mesmo padrão de `migration_fase0_integridade.sql`: como
`migration_fase3_analitico.sql` não faz parte do caminho oficial de
instalação nova acima, um banco novo nunca ganha a linha correspondente em
`schema_migrations` a menos que alguém rode o arquivo manualmente também
(ele é idempotente — `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE
FUNCTION` — então rodá-lo sobre um `schema.sql` já aplicado é seguro e vira
só bookkeeping, sem repetir nenhum efeito).

Exceção conhecida: `migration_corrige_custo_carimbado.sql` é uma correção
pontual de dado (não de schema) e não tem equivalente em `schema.sql` — não
se aplica a um banco novo, que nunca teve o backfill repudiado de
`migration_custo_congelado_saida.sql` para corrigir.

## 2. Ordem canônica de aplicação (banco já existente / histórico de produção)

Ordem de dependência real (não apenas cronológica — algumas migrations
exigem tabelas de outra anterior). "Status" é extraído dos comentários do
próprio arquivo + `git log`; ver a coluna "Fonte" para o que embasa cada
afirmação.

| # | Arquivo | O que faz | Status declarado | Fonte |
|---|---|---|---|---|
| 1 | `schema.sql` | Bootstrap: sectors, categories, products, movements, price_history, config, RLS, follow_up_*. Desde esta fase, também absorve todo o resto da tabela abaixo (ver §1). Tinha a view `dashboard_stats`, removida por #13, e a coluna `follow_up_solicitations.status`, removida por #14. | Base — sempre "aplicado" em qualquer instalação existente | commits `be02c33`…`c5747b8` |
| 2 | `hotfix_fix_saida_duplicada.sql` | Corrige débito duplicado em saídas; normaliza triggers de `movements` para uma única fonte de verdade. | Aplicado (ambiente afetado, Fev/2026) | commit `8bca315`, 2026-02-19 |
| 3 | `migration_chapas_armarios.sql` | Cria `roles`, `employees` (com `sector_id`, depois trocado — ver #5), `lockers`, `locker_assignments` + triggers de guarda. | Aplicado | commit `1e90ab1`, 2026-07-13 |
| 4 | `migration_fase2_solicitante.sql` | Adiciona `movements.employee_id`. Depende de `employees` (#3). | Aplicado | commit `10e9413`, 2026-07-13 |
| 5 | `migration_colaboradores_csv.sql` | Cria `departments`; troca `employees.sector_id` por `employees.department_id`; índices CI em `departments`/`roles`; nome único de colaborador. **Apaga `employees`/`locker_assignments` de teste na primeira execução.** | Aplicado | commits `a1a1a39`, `0f3bc96`, 2026-07-14 |
| 6 | `migration_categorias_produtos.sql` | Cria `categories`, migra `products.sector_id` → `products.category_id`. | Aplicado (schema.sql já reflete o resultado desde `c5747b8`) | commit `c5747b8`, 2026-07-17 |
| 7 | `migration_custo_congelado_saida.sql` | Cria o trigger `freeze_exit_cost` (ADR-0002). **A seção 2 (backfill) foi neutralizada — ver aviso no próprio arquivo. NUNCA reexecutar essa seção.** | Trigger aplicado; backfill repudiado, corrigido por #9 e #10 | commit `c5747b8`, 2026-07-17 |
| 8 | `migration_quiz_seguranca.sql` | Cria `quiz_respostas` + RLS pública. | Aplicado | commit `fa529d9`, 2026-07-23 |
| 9 | `migration_integridade_historico.sql` | Restaura `trigger_freeze_exit_cost` (esquecido pelo hotfix #2); troca FK `price_history.movement_id` de CASCADE para SET NULL; backfill correto de `unit_value` histórico via `price_history`; corrige `reconcile_product_on_delete` para não zerar `cost_price`. | Aplicado (mesma leva de trabalho que #10 e #11) | commit `db1d87a`, 2026-07-29 |
| 10 | `migration_corrige_custo_carimbado.sql` | Corrige retroativamente as saídas que o backfill de #7 carimbou de forma imprecisa. Reversível (tabela de backup). Tem corte de data (`< 2026-07-29`). | **Declarado explicitamente "APLICADA EM PRODUCAO EM 2026-07-29" no próprio arquivo.** | commits `db1d87a`, `2757135`, `215013c` |
| 11 | `migration_fase0_integridade.sql` | RPCs `transfer_locker_assignment`/`deactivate_employee`; `CHECK (max_stock >= min_stock)`; `reconcile_product_on_delete` exigindo NF na entrada restaurada; índice único case-insensitive em `categories` (com consolidação de duplicatas). | **PENDENTE — ainda não aplicada.** Registra-se sozinha em `schema_migrations` ao final. Enquanto não rodar, os RPCs não existem e a transferência de armário e o desligamento de colaborador **quebram na UI**, porque o front-end desta leva já chama `.rpc(...)`. | commit `9cb9ab4`, 2026-07-29 |
| 12 | `migration_fase1_higiene.sql` | Remove `reverse_movement_on_delete` morta; torna o seed de `config` idempotente (**aborta se houver duplicata — resolução manual, ver o aviso no arquivo**); cria e popula `schema_migrations`. | **PENDENTE — ainda não aplicada.** | — |
| 13 | `migration_fase3_analitico.sql` | Carimba `movements.department_id` (trigger `stamp_movement_department` + backfill com o setor atual do colaborador, ver aviso de aproximação no próprio arquivo); índices `(product_id, created_at)` e `(department_id, created_at)`; remove a view morta `dashboard_stats`; cria os 5 RPCs de dashboard (`dashboard_operacao`, `dashboard_analise_kpis`, `dashboard_serie`, `dashboard_dimensao`, `dashboard_destaques`). | **PENDENTE — ainda não aplicada.** Registra-se sozinha em `schema_migrations` ao final. Enquanto não rodar num banco existente, os RPCs não existem — qualquer tela que passe a chamá-los (Fase 4) quebra. | commit desta leva, 2026-07-29 |
| 14 | `migration_dropa_status_followup.sql` | Remove a coluna morta `follow_up_solicitations.status` (`DROP COLUMN IF EXISTS`) — só escrita, nunca lida; o status exibido na UI já é derivado ao vivo por `computeStatus()`. | **PENDENTE — ainda não aplicada.** Depende de #11/#12/#13 já aplicadas antes dela (ver aviso de ordem no próprio arquivo). Registra-se sozinha em `schema_migrations` ao final. | commit desta leva, 2026-07-30 |

> **As quatro pendentes (#11, #12, #13 e #14) são desta mesma leva de trabalho e nenhum banco as tem ainda.** A ordem entre #11/#12/#13 não importa entre si (ambas #11 e #12 criam `schema_migrations` com `CREATE TABLE IF NOT EXISTS` e se registram sozinhas); #13 depende apenas de #11 (Fase 0) e da Fase 1 já estarem no banco — não de #12 especificamente, já que ela também cria `schema_migrations` de forma idempotente. #14 é diferente: por decisão do plano que a introduziu, só deve rodar depois de #11, #12 e #13 confirmadas no banco-alvo (não há dependência de schema entre elas, é ordem de leva de trabalho). Se `schema_migrations` não listar a fase 0/1/3/14 depois de rodar as quatro, é porque a respectiva migration não rodou.

`diagnostico_movimentacoes.sql` não está na tabela acima: é somente leitura
(nenhum UPDATE/DELETE), usado para investigar, não uma migration. Não se
registra em `schema_migrations`.

## 3. NUNCA reexecutar

- **`migration_custo_congelado_saida.sql`, seção 2 (backfill de
  `unit_value`)** — já neutralizada no arquivo (bloco inteiro comentado),
  mas se alguém reconstituir o `UPDATE` a partir do comentário histórico e
  rodar de novo, volta a carimbar o `cost_price` de hoje sobre saídas
  antigas. Sem corte de data. Ver o aviso em maiúsculas dentro do próprio
  arquivo.
- **`reverse_movement_on_delete()`** — função removida (não um arquivo,
  mas vale o mesmo aviso): não recriar nem anexar a nenhum trigger. Contém a
  lógica de delta que causou o débito duplicado corrigido pelo hotfix.
- **`migration_colaboradores_csv.sql`**, no ambiente onde já rodou uma vez:
  a limpeza de dados de teste (`DELETE FROM employees`/`locker_assignments`)
  só executa se `employees.sector_id` ainda existir — já é guardada, mas não
  existe mais motivo para rodá-la de novo num banco com colaboradores reais.
- **`migration_corrige_custo_carimbado.sql`** é seguro para reexecutar (tem
  corte de data e o backup usa `ON CONFLICT DO NOTHING`), mas não há motivo
  para fazê-lo — vira no-op.

## 4. schema_migrations

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
```

Criada e retroalimentada por `migration_fase1_higiene.sql` (backfill de
melhor esforço, ver tabela do §2). **Toda migration nova deve terminar
registrando-se nela.** Snippet exato para copiar no fim de qualquer arquivo
novo:

```sql
INSERT INTO schema_migrations (filename) VALUES ('NNNN_nome_da_migration.sql')
ON CONFLICT (filename) DO NOTHING;
```

Antes de aplicar uma migration num banco específico, confira o que já rodou
nele:

```sql
SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at;
```

Isso não substitui um runner de verdade — é só o mínimo para parar de
depender de memória/comentário de prosa para saber o que já foi aplicado a
um banco específico.

## 5. Convenção de nome para migrations FUTURAS

A partir de agora (esta fase em diante), toda migration nova segue:

```
supabase/NNNN_descricao_curta.sql
```

- `NNNN`: numeração sequencial de 4 dígitos, zero-padded (`0001`, `0002`, …),
  contínua a partir da próxima migration criada depois desta fase. Não
  renumera nada existente.
- `descricao_curta`: snake_case, em português, resumindo o que a migration
  faz (ex.: `0001_carimbo_setor_movimentacoes.sql`).
- Toda migration nova termina com o `INSERT INTO schema_migrations` do §4.
- Os arquivos `migration_*.sql`, `hotfix_*.sql` e `schema.sql` já existentes
  **não são renomeados nem movidos** por esta convenção — mudar nomes de
  arquivo já aplicados manualmente quebraria o mapa mental de quem opera o
  banco e o histórico do git. A numeração `NNNN` vale só para o que for
  criado daqui para frente.
