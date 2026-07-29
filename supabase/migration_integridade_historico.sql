-- Silcon Ambiental - Migracao: Integridade do historico de movimentacoes
-- Aditiva e idempotente. Rodar no SQL Editor do Supabase.
--
-- Contexto: o dashboard nao mostra valores de meses antigos. Investigando,
-- foram encontrados quatro problemas de integridade de dados historicos,
-- corrigidos nos blocos abaixo. Ver tambem supabase/diagnostico_movimentacoes.sql
-- para as queries de leitura que confirmam cada um destes sintomas.

-- =====================================================================
-- (a) Restaura o trigger trigger_freeze_exit_cost (ADR-0002)
-- =====================================================================
-- O hotfix_fix_saida_duplicada.sql tem um bloco DO $$ que dropa TODOS os
-- triggers existentes em movements e recria apenas tres (update_product_qty,
-- handle_price_change, reverse_movement). O freeze_exit_cost foi esquecido.
-- Sem este trigger, toda saida nova grava unit_value = NULL, e qualquer
-- relatorio que some quantity * unit_value fecha em R$ 0,00 para o periodo.
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
-- (b) price_history.movement_id: ON DELETE CASCADE -> ON DELETE SET NULL
-- =====================================================================
-- Hoje, excluir uma movimentacao de entrada apaga junto (CASCADE) o ponto
-- correspondente em price_history, e o grafico de variacao de precos perde
-- aquele dado para sempre. O historico de preco precisa sobreviver a
-- exclusao da movimentacao que o originou - por isso a FK passa a ser
-- ON DELETE SET NULL (o registro de price_history continua existindo, so
-- perde a referencia para a movimentacao ja excluida).
-- O nome da constraint e descoberto dinamicamente (nao confiar no nome
-- padrao price_history_movement_id_fkey, caso tenha sido renomeada).
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'price_history'
    AND con.contype = 'f'
    AND att.attname = 'movement_id';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE price_history DROP CONSTRAINT IF EXISTS %I;', v_constraint_name);
  END IF;
END;
$$;

ALTER TABLE price_history
  ADD CONSTRAINT price_history_movement_id_fkey
  FOREIGN KEY (movement_id) REFERENCES movements(id) ON DELETE SET NULL;

-- =====================================================================
-- (c) Backfill historicamente correto de movements.unit_value em saidas
-- =====================================================================
-- ATENCAO: esta e a parte mais delicada desta migracao. A migracao anterior
-- (migration_custo_congelado_saida.sql) preenchia saidas antigas com o
-- products.cost_price ATUAL, reescrevendo o passado com o preco de hoje.
-- Aqui fazemos o oposto: para cada saida com unit_value NULL, buscamos o
-- preco que estava REALMENTE vigente na data da movimentacao (created_at),
-- em ordem de confianca decrescente:
--   1) o new_price mais recente em price_history para o produto com
--      created_at <= data da saida (preco vigente naquele momento);
--   2) se nao houver nenhum anterior, o old_price do registro de
--      price_history mais ANTIGO do produto que tenha old_price nao nulo
--      (o preco que vigorava antes da primeira variacao registrada);
--   3) so em ultimo caso, quando o produto nao tem nenhum price_history,
--      products.cost_price atual - aqui sim e apenas uma estimativa
--      assumida, igual a migracao anterior fazia para todos os casos.
-- Importante: esta migracao so atualiza linhas onde unit_value IS NULL.
-- Saidas que a migracao anterior ja preencheu (de forma imprecisa, com o
-- cost_price atual) NAO sao revertidas aqui, pois ja deixaram de ser NULL.
UPDATE movements m
SET unit_value = COALESCE(
      (
        SELECT ph.new_price
        FROM price_history ph
        WHERE ph.product_id = m.product_id
          AND ph.created_at <= m.created_at
        ORDER BY ph.created_at DESC
        LIMIT 1
      ),
      (
        SELECT ph2.old_price
        FROM price_history ph2
        WHERE ph2.product_id = m.product_id
          AND ph2.old_price IS NOT NULL
        ORDER BY ph2.created_at ASC
        LIMIT 1
      ),
      (
        SELECT p.cost_price
        FROM products p
        WHERE p.id = m.product_id
      )
    )
WHERE m.type = 'OUT'
  AND m.unit_value IS NULL;

-- =====================================================================
-- (d) reconcile_product_on_delete: nao zerar cost_price quando nao ha
--     entrada anterior
-- =====================================================================
-- Hoje, ao excluir uma entrada (IN), a funcao busca a entrada anterior mais
-- recente e faz SET cost_price = prev_cost. Se nao existir entrada anterior,
-- prev_cost e NULL e o custo do produto e zerado - a partir dai, toda saida
-- futura congela unit_value = NULL (mesmo com o trigger freeze_exit_cost
-- ativo, pois ele so age quando ha cost_price para copiar). A correcao
-- preserva o ultimo custo conhecido quando nao ha entrada anterior. O
-- recalculo de current_qty permanece identico, sem alteracoes.
CREATE OR REPLACE FUNCTION reconcile_product_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  prev_cost DECIMAL(10, 2);
BEGIN
  UPDATE products
  SET current_qty = COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN m.type = 'IN' THEN m.quantity
              ELSE -m.quantity
            END
          )
          FROM movements m
          WHERE m.product_id = OLD.product_id
            AND m.id != OLD.id
        ),
        0
      ),
      updated_at = NOW()
  WHERE id = OLD.product_id;

  IF OLD.type = 'IN' THEN
    -- If removing an IN movement, restore the most recent previous purchase price.
    SELECT unit_value INTO prev_cost
    FROM movements
    WHERE product_id = OLD.product_id
      AND type = 'IN'
      AND unit_value IS NOT NULL
      AND id != OLD.id
    ORDER BY created_at DESC
    LIMIT 1;

    UPDATE products
    SET cost_price = COALESCE(prev_cost, cost_price),
        updated_at = NOW()
    WHERE id = OLD.product_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
