-- Silcon Ambiental - Migração: Categoria de Produto separada de Setor (ADR-0003)
-- Aditiva e idempotente. Rodar no SQL Editor do Supabase.
--
-- Hoje `products.sector_id` aponta para `sectors`, tabela que também é usada
-- (via UI legada) para representar o setor do produto. Esta migração cria uma
-- tabela própria `categories` para a classificação de material do produto
-- (EPIs, Copa e Limpeza, ...), reclassifica os produtos existentes e remove
-- `products.sector_id`. A tabela `sectors` não é alterada nem removida aqui.

-- =====================
-- CATEGORIES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON categories;
CREATE POLICY "Allow all" ON categories FOR ALL USING (true);

-- =====================
-- PRODUCTS: sector_id -> category_id
-- =====================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE RESTRICT;

-- Seed + backfill dependem de products.sector_id, que esta migração remove no
-- final — por isso ficam guardados pela existência da coluna, garantindo que a
-- segunda execução pule o bloco em vez de quebrar (PL/pgSQL só resolve as
-- referências de coluna quando o statement executa).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'sector_id'
  ) THEN
    -- Popular com os nomes de todos os setores atualmente referenciados por
    -- pelo menos um produto (a lista seed de `sectors` mistura os dois
    -- conceitos; só entram aqui os que de fato classificam produtos hoje).
    INSERT INTO categories (name)
    SELECT DISTINCT s.name
    FROM sectors s
    JOIN products p ON p.sector_id = s.id
    ON CONFLICT (name) DO NOTHING;

    -- Backfill: cada produto recebe a categoria de mesmo nome do seu setor atual.
    UPDATE products p
    SET category_id = c.id
    FROM sectors s
    JOIN categories c ON c.name = s.name
    WHERE p.sector_id = s.id
      AND p.category_id IS NULL;
  END IF;
END;
$$;

-- Só torna NOT NULL depois do backfill, e só se ainda não for (idempotente).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'category_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE products ALTER COLUMN category_id SET NOT NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Remove a coluna legada. O deploy do código acompanha esta migração.
DROP INDEX IF EXISTS idx_products_sector;
ALTER TABLE products DROP COLUMN IF EXISTS sector_id;
