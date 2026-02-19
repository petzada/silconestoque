-- Silcon Ambiental Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- SECTORS TABLE
-- =====================
-- =====================
-- SECTORS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-seed sectors
INSERT INTO sectors (name) VALUES
  ('Copa e Limpeza'),
  ('EPIs'),
  ('Logística'),
  ('Manutenção Elétrica'),
  ('Manutenção Mecânica'),
  ('Manutenção Predial'),
  ('Pintura e Predial'),
  ('Produção')
ON CONFLICT (name) DO NOTHING;

-- =====================
-- PRODUCTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('unidade', 'caixa', 'pacote')),
  sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  current_qty INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sector ON products(sector_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- =====================
-- MOVEMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  quantity INTEGER NOT NULL,
  entity_name TEXT, -- Fornecedor ou Solicitante
  unit_value DECIMAL(10, 2), -- Valor unitário na entrada
  invoice_number TEXT, -- Nota fiscal
  is_initial_import BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);

-- =====================
-- PRICE HISTORY TABLE
-- =====================
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_id UUID REFERENCES movements(id) ON DELETE CASCADE, -- Link to movement for auto-cleanup
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2) NOT NULL,
  invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_movement ON price_history(movement_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created ON price_history(created_at DESC);

-- =====================
-- CONFIG TABLE
-- =====================
CREATE TABLE IF NOT EXISTS config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  access_password TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'Silcon Ambiental'
);

INSERT INTO config (access_password, company_name)
VALUES ('silcon2024', 'Silcon Ambiental')
ON CONFLICT DO NOTHING;

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

-- 1. Update Product Quantity
CREATE OR REPLACE FUNCTION update_product_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'IN' THEN
    UPDATE products
    SET current_qty = current_qty + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  ELSIF NEW.type = 'OUT' THEN
    IF (SELECT current_qty FROM products WHERE id = NEW.product_id) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for this product';
    END IF;

    UPDATE products
    SET current_qty = current_qty - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_qty ON movements;
CREATE TRIGGER trigger_update_product_qty
  AFTER INSERT ON movements
  FOR EACH ROW
  EXECUTE FUNCTION update_product_quantity();

-- 2. Handle Price Change
CREATE OR REPLACE FUNCTION handle_price_change()
RETURNS TRIGGER AS $$
DECLARE
  old_cost DECIMAL(10, 2);
BEGIN
  IF NEW.type = 'IN' AND NEW.unit_value IS NOT NULL AND NEW.invoice_number IS NOT NULL THEN
    SELECT cost_price INTO old_cost FROM products WHERE id = NEW.product_id;
    IF old_cost IS NULL OR old_cost != NEW.unit_value THEN
      INSERT INTO price_history (product_id, movement_id, old_price, new_price, invoice_number)
      VALUES (NEW.product_id, NEW.id, old_cost, NEW.unit_value, NEW.invoice_number);

      UPDATE products
      SET cost_price = NEW.unit_value,
          updated_at = NOW()
      WHERE id = NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_price_change ON movements;
CREATE TRIGGER trigger_handle_price_change
  AFTER INSERT ON movements
  FOR EACH ROW
  EXECUTE FUNCTION handle_price_change();

-- 3. Reverse Movement on Delete
CREATE OR REPLACE FUNCTION reverse_movement_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  prev_cost DECIMAL(10, 2);
BEGIN
  -- Reverter estoque
  IF OLD.type = 'IN' THEN
    UPDATE products
    SET current_qty = current_qty - OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.product_id;

    -- Se removendo entrada, verificar se precisa reverter preço
    -- Busca a Última entrada válida que NÃO seja a que está sendo deletada (embora OLD já esteja "sendo removido",
    -- em um trigger BEFORE ou AFTER DELETE, o state pode variar. No BEFORE, o registro ainda existe.
    -- Vamos buscar a mais recente excluindo a atual.
    
    SELECT unit_value INTO prev_cost
    FROM movements
    WHERE product_id = OLD.product_id 
      AND type = 'IN' 
      AND unit_value IS NOT NULL
      AND id != OLD.id -- Garante que não pega a própria
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se achou um preço anterior, atualiza. Se não, define null (ou mantém se quiser, mas null é mais correto se não tem histórico)
    UPDATE products
    SET cost_price = prev_cost,
        updated_at = NOW()
    WHERE id = OLD.product_id;

  ELSIF OLD.type = 'OUT' THEN
    UPDATE products
    SET current_qty = current_qty + OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reverse_movement ON movements;
CREATE TRIGGER trigger_reverse_movement
  BEFORE DELETE ON movements
  FOR EACH ROW
  EXECUTE FUNCTION reverse_movement_on_delete();

-- =====================
-- RLS POLICIES
-- =====================
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON sectors;
CREATE POLICY "Allow all" ON sectors FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON products;
CREATE POLICY "Allow all" ON products FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON movements;
CREATE POLICY "Allow all" ON movements FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON config;
CREATE POLICY "Allow all" ON config FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON price_history;
CREATE POLICY "Allow all" ON price_history FOR ALL USING (true);

-- =====================
-- VIEWS
-- =====================
-- =====================
-- FOLLOW-UP TABLES
-- =====================

-- Solicitações de compra
CREATE TABLE IF NOT EXISTS follow_up_solicitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number TEXT NOT NULL,
  request_date DATE NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'recebido')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos de compra vinculados a solicitações
CREATE TABLE IF NOT EXISTS follow_up_purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  solicitation_id UUID NOT NULL REFERENCES follow_up_solicitations(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  estimated_delivery DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_po_solicitation ON follow_up_purchase_orders(solicitation_id);

-- Recebimentos vinculados a pedidos de compra (0 ou 1 por pedido)
CREATE TABLE IF NOT EXISTS follow_up_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL UNIQUE REFERENCES follow_up_purchase_orders(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  invoice_value DECIMAL(12, 2),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_receipts_po ON follow_up_receipts(purchase_order_id);

-- RLS for follow-up tables
ALTER TABLE follow_up_solicitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON follow_up_solicitations;
CREATE POLICY "Allow all" ON follow_up_solicitations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON follow_up_purchase_orders;
CREATE POLICY "Allow all" ON follow_up_purchase_orders FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON follow_up_receipts;
CREATE POLICY "Allow all" ON follow_up_receipts FOR ALL USING (true);

-- =====================
-- VIEWS
-- =====================
DROP VIEW IF EXISTS dashboard_stats;
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM products WHERE current_qty < min_stock) as critical_products,
  (SELECT COUNT(*) FROM products WHERE current_qty = 0) as zero_stock,
  (SELECT COALESCE(SUM(current_qty * COALESCE(cost_price, 0)), 0) FROM products) as total_inventory_cost;
