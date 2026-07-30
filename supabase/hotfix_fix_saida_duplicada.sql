-- Hotfix: corrige baixa duplicada em movimentos de saida
-- Execute este script no Supabase SQL Editor (ambiente afetado)
--
-- SINCRONIZADO em migration_fase1_higiene.sql: a copia de
-- reconcile_product_on_delete abaixo tinha regredido para a logica antiga
-- (SET cost_price = prev_cost, sem exigir NF na entrada restaurada), a
-- mesma regressao encontrada em schema.sql:317-320. Corrigida para bater
-- com a versao final (COALESCE(prev_cost, cost_price) +
-- invoice_number IS NOT NULL), ver migration_integridade_historico.sql item
-- d e migration_fase0_integridade.sql secao 4. Se este hotfix for
-- reexecutado hoje, ele PRECISA gravar a mesma logica que ja esta em
-- producao — nao a antiga.

CREATE OR REPLACE FUNCTION update_product_quantity()
RETURNS TRIGGER AS $$
DECLARE
  available_qty INTEGER;
BEGIN
  SELECT current_qty INTO available_qty
  FROM products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF NEW.type = 'OUT' AND available_qty < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for this product';
  END IF;

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
          WHERE m.product_id = NEW.product_id
        ),
        0
      ),
      updated_at = NOW()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
    -- Só uma Entrada com NF + valor unitário é fonte válida de Custo
    -- Cadastrado (CONTEXT.md). Sem invoice_number IS NOT NULL, restaurava o
    -- custo a partir de uma entrada informal.
    SELECT unit_value INTO prev_cost
    FROM movements
    WHERE product_id = OLD.product_id
      AND type = 'IN'
      AND unit_value IS NOT NULL
      AND invoice_number IS NOT NULL
      AND id != OLD.id
    ORDER BY created_at DESC
    LIMIT 1;

    -- COALESCE preserva o último custo conhecido; nunca zera cost_price
    -- quando não há entrada anterior com NF.
    UPDATE products
    SET cost_price = COALESCE(prev_cost, cost_price),
        updated_at = NOW()
    WHERE id = OLD.product_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  trigger_name TEXT;
BEGIN
  FOR trigger_name IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'movements'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON movements;', trigger_name);
  END LOOP;
END;
$$;

CREATE TRIGGER trigger_update_product_qty
  AFTER INSERT ON movements
  FOR EACH ROW
  EXECUTE FUNCTION update_product_quantity();

-- Recria tambem o freeze_exit_cost (ADR-0002): o bloco DO $$ acima dropa
-- TODOS os triggers de movements, e sem recria-lo aqui rodar este hotfix de
-- novo volta a derrubar o congelamento de custo da saida (unit_value fica
-- NULL em toda saida nova, ver migration_integridade_historico.sql).
CREATE TRIGGER trigger_freeze_exit_cost
  BEFORE INSERT ON movements
  FOR EACH ROW
  EXECUTE FUNCTION freeze_exit_cost();

CREATE TRIGGER trigger_handle_price_change
  AFTER INSERT ON movements
  FOR EACH ROW
  EXECUTE FUNCTION handle_price_change();

CREATE TRIGGER trigger_reverse_movement
  BEFORE DELETE ON movements
  FOR EACH ROW
  EXECUTE FUNCTION reconcile_product_on_delete();

-- Corrige saldos ja afetados
UPDATE products p
SET current_qty = COALESCE(calc.qty, 0),
    updated_at = NOW()
FROM (
  SELECT
    product_id,
    SUM(
      CASE
        WHEN type = 'IN' THEN quantity
        ELSE -quantity
      END
    ) AS qty
  FROM movements
  GROUP BY product_id
) calc
WHERE p.id = calc.product_id;

UPDATE products p
SET current_qty = 0,
    updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM movements m
  WHERE m.product_id = p.id
)
AND p.current_qty <> 0;
