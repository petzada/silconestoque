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

-- 2. Backfill: Saídas existentes sem unit_value recebem o cost_price atual
-- do produto como estimativa (mesmo número que os relatórios já exibiam,
-- então nada muda visualmente no momento da migração).
UPDATE movements m
SET unit_value = p.cost_price
FROM products p
WHERE m.product_id = p.id
  AND m.type = 'OUT'
  AND m.unit_value IS NULL
  AND p.cost_price IS NOT NULL;
