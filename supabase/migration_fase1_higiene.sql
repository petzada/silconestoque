-- Silcon Ambiental - Migração Fase 1: Higiene de SQL / migration
-- Ver docs/superpowers/plans/2026-07-29-dashboard-home-plan.md, secao 3.
--
-- Aditiva e idempotente: cada bloco só age sobre o que ainda falta corrigir
-- (DROP FUNCTION IF EXISTS, índice único com dedupe defensivo, tabela de
-- controle com INSERT ... ON CONFLICT DO NOTHING). Segura para re-executar.
--
-- Rodar no SQL Editor do Supabase, na ordem em que aparece neste arquivo.
-- Pressupõe que migration_fase0_integridade.sql já foi aplicada (este
-- arquivo não repete o CHECK de max_stock, o índice CI de categories nem a
-- correção de reconcile_product_on_delete — isso já está lá).

-- =====================================================================
-- 1. Remover a função morta reverse_movement_on_delete()
-- =====================================================================
-- schema.sql (antes desta correção) definia reverse_movement_on_delete(),
-- que nunca esteve anexada a nenhum trigger — o CREATE TRIGGER sempre
-- apontou para reconcile_product_on_delete. Ela reverte o estoque por
-- DELTA (current_qty ± OLD.quantity) em vez de recalcular a soma completa
-- das movimentações restantes: exatamente a lógica que causou o bug de
-- débito duplicado corrigido por hotfix_fix_saida_duplicada.sql. Uma função
-- carregada, sem uso — qualquer um que a anexe a um trigger no futuro
-- reintroduz o bug. Removida daqui e de schema.sql (que agora só define a
-- versão canônica, reconcile_product_on_delete).
DROP FUNCTION IF EXISTS reverse_movement_on_delete();

-- =====================================================================
-- 2. config: tornar o seed idempotente de verdade
-- =====================================================================
-- INSERT INTO config ... ON CONFLICT DO NOTHING (schema.sql) nunca teve
-- alvo de conflito porque não havia índice único na tabela. Cada
-- re-execução do schema.sql acrescentava outra linha. Com duas ou mais
-- linhas, o `.single()` de app/login/page.tsx:30-33 passa a devolver erro
-- PGRST116, e o login degrada silenciosamente para o caminho de senha de
-- fallback (NEXT_PUBLIC_FALLBACK_PASSWORD).
--
-- ATENÇÃO — este bloco NÃO apaga nada. Ele aborta a migração se houver
-- duplicata, e a resolução é manual, de propósito.
--
-- `config.access_password` é a senha de acesso ao sistema e a tabela não tem
-- coluna de data. Não há critério confiável — nem para uma pessoa, nem para
-- um script — que diga qual linha guarda a senha real e qual é re-seed do
-- padrão. Escolher por heurística e apagar a outra é irreversível: se errar,
-- a senha em uso desaparece e o login cai no fallback por env var. O custo de
-- abortar é o usuário rodar um SELECT; o custo de errar é perder a senha.
--
-- Se a migração parar aqui, rode:
--   SELECT id, access_password, company_name FROM config;
-- decida qual linha fica, apague as outras explicitamente por id:
--   DELETE FROM config WHERE id <> '<id-que-fica>';
-- e rode esta migração de novo.
DO $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM config;

  IF v_row_count > 1 THEN
    RAISE EXCEPTION
      'config tem % linhas e precisa ter no maximo 1. Resolva a mao antes de continuar: SELECT id, access_password, company_name FROM config; e depois DELETE FROM config WHERE id <> ''<id-que-fica>'';',
      v_row_count;
  END IF;
END;
$$;

-- Singleton: nenhuma segunda linha volta a ser inserida por acidente. O
-- INSERT ... ON CONFLICT DO NOTHING existente em schema.sql passa a ter um
-- alvo de conflito real.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_config_singleton ON config ((true));

-- =====================================================================
-- 3. Tabela de controle schema_migrations
-- =====================================================================
-- Não existe runner de migration neste projeto: sem esta tabela, não há
-- como saber pelo repositório o que já foi aplicado a um banco específico.
-- "Aplicada em produção" só existia como comentário em prosa dentro de cada
-- arquivo. Esta tabela não substitui isso automaticamente — os INSERTs
-- abaixo são um backfill de melhor esforço, escrito a partir dos
-- comentários de cada arquivo e do `git log --follow`, NÃO uma auditoria
-- verificada contra o banco real (que eu não tenho acesso para consultar).
-- Ver supabase/README.md para o detalhe de cada linha e a ordem canônica.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill de melhor esforço: migrations que os comentários/histórico do
-- repositório indicam como já aplicadas em produção antes desta fase.
-- applied_at aqui é a data do commit que introduziu ou alterou o arquivo
-- pela última vez (aproximação; não é o instante real em que rodou no SQL
-- Editor). CONFIRA e ajuste manualmente se souber a data real — é só
-- bookkeeping, não há nada que dependa de precisão aqui além da leitura
-- humana.
INSERT INTO schema_migrations (filename, applied_at) VALUES
  ('hotfix_fix_saida_duplicada.sql', TIMESTAMPTZ '2026-02-19 12:19:46-03'),
  ('migration_chapas_armarios.sql', TIMESTAMPTZ '2026-07-13 00:00:00-03'),
  ('migration_fase2_solicitante.sql', TIMESTAMPTZ '2026-07-13 00:00:00-03'),
  ('migration_colaboradores_csv.sql', TIMESTAMPTZ '2026-07-14 00:00:00-03'),
  ('migration_categorias_produtos.sql', TIMESTAMPTZ '2026-07-17 00:00:00-03'),
  ('migration_custo_congelado_saida.sql', TIMESTAMPTZ '2026-07-17 00:00:00-03'),
  ('migration_quiz_seguranca.sql', TIMESTAMPTZ '2026-07-23 00:00:00-03'),
  ('migration_integridade_historico.sql', TIMESTAMPTZ '2026-07-29 08:55:46-03'),
  ('migration_corrige_custo_carimbado.sql', TIMESTAMPTZ '2026-07-29 08:55:46-03')
ON CONFLICT (filename) DO NOTHING;

-- migration_fase0_integridade.sql NÃO entra neste backfill: ela é desta
-- mesma leva e ainda não foi aplicada a nenhum banco. Ela se registra
-- sozinha ao final do próprio arquivo. Se `schema_migrations` não listar a
-- fase 0 depois de você rodar as duas, é porque a fase 0 não rodou — e as
-- funções transfer_locker_assignment/deactivate_employee não existem, o que
-- quebra a transferência de armário e o desligamento de colaborador na UI.

-- Esta própria migração se registra ao final (convenção para as próximas
-- — ver supabase/README.md, secao "Como registrar uma migration nova").
INSERT INTO schema_migrations (filename) VALUES ('migration_fase1_higiene.sql')
ON CONFLICT (filename) DO NOTHING;
