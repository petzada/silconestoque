-- Silcon Ambiental - Migração: dropar coluna morta follow_up_solicitations.status
-- Ver docs/superpowers/plans/2026-07-30-backlog-correcoes-plan.md, §4 (Etapa 2, G3).
--
-- O QUE FAZ: remove follow_up_solicitations.status. Nenhuma tabela nova,
-- nenhum RPC — só um DROP COLUMN.
--
-- POR QUE: a coluna era escrita (INSERT com 'pendente', UPDATE em syncStatus)
-- e NUNCA lida por nenhuma tela, RPC ou outro arquivo do repositório — o
-- único "leitor" era o próprio syncStatus (app/(dashboard)/follow-up/
-- page.tsx, agora removido), comparando solData.status !== newStatus só para
-- decidir se reescrevia a si mesmo. O status exibido na UI (statusBadge) já
-- vinha de computeStatus(), derivado ao vivo dos pedidos/recebimentos
-- carregados — nunca desta coluna.
--
-- Existiam, na prática, TRÊS derivações da mesma regra "está recebido":
-- computeStatus() em TypeScript (uma por solicitação, via every() nos
-- pedidos), syncStatus() em TypeScript (uma por contagem, via receivedCount
-- >= poIds.length) e o CTE de atraso do RPC dashboard_operacao em SQL (uma
-- por pedido, via LEFT JOIN follow_up_receipts + r.id IS NULL). Só a terceira
-- sobrevive a esta migration, e ela nunca leu esta coluna — deriva dos
-- recebimentos direto, que é o que a coluna tentava resumir. A divergência
-- entre as duas regras em
-- TypeScript era LATENTE, não um bug observado: receivedCount >=
-- poIds.length só destoa de every(pedido → tem recebimento) se algum pedido
-- tiver 2+ recebimentos — cenário que o UNIQUE em
-- follow_up_receipts.purchase_order_id (schema.sql, tabela follow_up_
-- receipts) torna impossível hoje. Ou seja: nem sequer chegou a produzir
-- dado inconsistente, só custo de manutenção (~40 linhas de sync + 2
-- round-trips de rede por ação) sem benefício correspondente.
--
-- IDEMPOTENTE / SEGURA PARA REEXECUTAR: DROP COLUMN IF EXISTS não falha se a
-- coluna já não existir (rodar duas vezes é um no-op na segunda vez).
--
-- NÃO É REVERSÍVEL no sentido estrito: os valores de `status` que existiam no
-- banco somem, sem coluna sombra nem backup. Como a coluna nunca era lida por
-- nada, essa perda é factualmente inconsequente — o status sempre foi derivado
-- ao vivo dos pedidos/recebimentos.
--
-- EFEITO COLATERAL CONHECIDO E ACEITO — `updated_at` fica órfão: o syncStatus
-- removido era o ÚNICO ponto do código que dava UPDATE nesta tabela, e não
-- existe trigger de updated_at nela (o único do schema é
-- trigger_employees_updated_at, específico de `employees`). A partir daqui
-- `follow_up_solicitations.updated_at` nunca muda depois do INSERT e é, de
-- fato, sinônimo de `created_at`. Nenhuma tela lê essa coluna hoje, então não
-- há defeito visível; mas o nome promete uma semântica que o código não
-- cumpre mais. Registrado no backlog (§9 do plano de 2026-07-29) em vez de
-- consertado aqui: dropar a coluna ou criar o trigger são escopos que
-- ninguém decidiu, e esta migration não deve decidir por conta própria.
--
-- AVISO DE ORDEM (obrigatório) — CÓDIGO PRIMEIRO, MIGRATION DEPOIS: o
-- deploy do código que para de escrever nesta coluna (remoção de
-- syncStatus e do `status: 'pendente'` no insert, em app/(dashboard)/
-- follow-up/page.tsx) tem de estar em produção ANTES desta migration rodar.
-- Se a coluna cair primeiro, qualquer PATCH/INSERT do código antigo que
-- ainda referencie `status` recebe erro 400 do PostgREST na hora de criar
-- solicitação/pedido/recebimento.
--
-- AVISO ADICIONAL (obrigatório) — DEPENDÊNCIA DE ORDEM COM A LEVA ANTERIOR:
-- supabase/README.md §2 lista migration_fase0_integridade.sql (#11),
-- migration_fase1_higiene.sql (#12) e migration_fase3_analitico.sql (#13)
-- como PENDENTES — nenhum banco as tem ainda no momento em que este arquivo
-- foi escrito. Esta migration (#14) NÃO deve ser aplicada antes daquelas
-- três. Nenhuma dependência de schema entre elas (#14 só mexe em
-- follow_up_solicitations), mas a ordem de aplicação desta leva de trabalho
-- é sequencial por decisão do plano — não empilhar migration nova em cima de
-- uma pilha ainda não confirmada no banco-alvo.
ALTER TABLE follow_up_solicitations DROP COLUMN IF EXISTS status;

-- =====================================================================
-- Registro em schema_migrations
-- =====================================================================
-- Convenção introduzida por migration_fase1_higiene.sql (ver
-- supabase/README.md §4): toda migration se registra ao final. Tabela criada
-- aqui de forma idempotente (mesmo padrão de migration_fase3_analitico.sql),
-- para não depender de qual migration desta leva roda primeiro.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('migration_dropa_status_followup.sql')
ON CONFLICT (filename) DO NOTHING;
