-- Silcon Ambiental - Migração: Custo congelado no momento da Saída (ADR-0002)
-- Aditiva e idempotente. Rodar no SQL Editor do Supabase.
--
-- Saídas passam a gravar o custo unitário vigente do produto na própria
-- movimentação, no momento do registro (unit_value), em vez de reavaliar o
-- histórico com o cost_price atual do produto no momento da exibição.

-- 1. Congela o custo da Saída no INSERT, quando não informado explicitamente.
CREATE OR REPLACE FUNCTION freeze_exit_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'OUT' AND NEW.unit_value IS NULL THEN
    SELECT cost_price INTO NEW.unit_value
    FROM products
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_freeze_exit_cost ON movements;
CREATE TRIGGER trigger_freeze_exit_cost
  BEFORE INSERT ON movements
  FOR EACH ROW
  EXECUTE FUNCTION freeze_exit_cost();

-- =====================================================================
-- 2. BACKFILL REPUDIADO — NÃO REEXECUTAR. NEUTRALIZADO EM
--    migration_fase1_higiene.sql (ver histórico abaixo).
-- =====================================================================
-- O QUE ESTE BLOCO FAZIA: preenchia toda Saída histórica com unit_value
-- NULL usando o products.cost_price ATUAL — ou seja, carimbava o preço de
-- HOJE (o dia em que esta migração rodasse) em movimentações de meses
-- anteriores, reescrevendo o passado com o presente.
--
-- POR QUE ISSO É ERRADO: um custo congelado no momento da saída (ADR-0002)
-- deveria acompanhar as variações de preço reais da época. Um valor
-- idêntico atravessando múltiplas mudanças de preço registradas em
-- price_history só pode ter sido carimbado de uma vez por este backfill.
-- Os desvios medidos em produção, documentados em
-- migration_corrige_custo_carimbado.sql:20-38, foram grandes e nos DOIS
-- sentidos:
--   CLORO LIQUIDO 5L      subavaliado em 58%  (carimbado 8,43  | real 19,90)
--   VASSOURAO NYLON 40MM  superavaliado em 182% (carimbado 71,90 | real 25,49)
--
-- SEM CORTE DE DATA: ao contrário de migration_corrige_custo_carimbado.sql
-- (que só alcança saídas anteriores a 2026-07-29), este UPDATE nunca teve
-- filtro de created_at. Continua re-executável tal como escrito
-- originalmente e continuaria destrutivo: rodar de novo hoje carimbaria o
-- cost_price ATUAL de novo sobre qualquer saída que voltasse a ficar com
-- unit_value NULL por qualquer motivo, sem nenhuma garantia de coincidir
-- com o preço real da época.
--
-- CORRIGIDO POR:
--   - migration_integridade_historico.sql item (c) — backfill correto,
--     usando o preço vigente em price_history na data de cada saída, e só
--     tocando linhas que ainda estivessem com unit_value NULL.
--   - migration_corrige_custo_carimbado.sql — corrigiu retroativamente as
--     saídas que este backfill já tinha carimbado de forma imprecisa,
--     reversível via tabela de backup, com corte de data.
--
-- O bloco original fica abaixo, comentado, como registro histórico legível
-- do que rodou em produção. Não remova o comentário `--`: isso impediria a
-- reexecução acidental deste UPDATE se o arquivo inteiro for colado de
-- volta no SQL Editor.
--
-- UPDATE movements m
-- SET unit_value = p.cost_price
-- FROM products p
-- WHERE m.product_id = p.id
--   AND m.type = 'OUT'
--   AND m.unit_value IS NULL
--   AND p.cost_price IS NOT NULL;
