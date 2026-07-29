-- Silcon Ambiental Database Schema
-- Run this in Supabase SQL Editor
--
-- SNAPSHOT — este arquivo é o bootstrap de instalação nova E reflete o estado
-- final do banco depois de aplicar, em produção, as migrations históricas de
-- supabase/ (chapas & armários, colaboradores/CSV, categorias de produto,
-- custo congelado na saída, quiz, Fase 0 de integridade). Ver
-- supabase/README.md para a ordem canônica de cada arquivo, o que já foi
-- absorvido aqui e o que NUNCA deve ser re-executado.
--
-- Uma instalação NOVA só precisa rodar este arquivo. As migrations
-- históricas (migration_*.sql, hotfix_*.sql) documentam como a produção
-- chegou neste estado incremental por incremental — não são um segundo
-- passo de bootstrap e não devem ser aplicadas depois deste arquivo numa
-- instalação nova.
--
-- Este arquivo é seguro para RE-EXECUTAR numa instalação já existente e já
-- corrigida: toda função usa CREATE OR REPLACE com a lógica final (não a
-- antiga), toda tabela/índice usa IF NOT EXISTS, e os UPDATEs de
-- reconciliação no fim são idempotentes (só tocam o que ainda diverge).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- SECTORS TABLE
-- =====================
-- LEGADO: esta tabela não é mais referenciada pelo app. O setor do colaborador
-- vive em `departments` (migration_colaboradores_csv.sql) e a classificação do
-- produto em `categories` (ver ADR-0003). Mantida apenas para instalações
-- existentes; não usar em código novo. Fora de escopo remover (ver
-- supabase/README.md).
CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- CATEGORIES TABLE
-- =====================
-- Classificação do produto por tipo de material (EPIs, Copa e Limpeza, ...).
-- Distinta de `sectors` (departamento real, de colaborador) — ver ADR-0003.
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-seed categories (mesmo conjunto original de sectors, agora exclusivo de produto)
INSERT INTO categories (name) VALUES
  ('Copa e Limpeza'),
  ('EPIs'),
  ('Logística'),
  ('Manutenção Elétrica'),
  ('Manutenção Mecânica'),
  ('Manutenção Predial'),
  ('Pintura e Predial'),
  ('Produção')
ON CONFLICT (name) DO NOTHING;

-- Índice único case-insensitive (migration_fase0_integridade.sql secao 5):
-- sem ele, um CSV de produtos com "EPIs" e "epis" cria duas categorias
-- distintas e quebra o agrupamento por nome no dashboard. Instalação nova
-- nunca tem duplicata para consolidar antes de criar o índice.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_categories_name_ci
  ON categories (lower(trim(name)));

-- =====================
-- PRODUCTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('unidade', 'caixa', 'pacote')),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  current_qty INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- CHECK (max_stock >= min_stock) — migration_fase0_integridade.sql secao 3.
-- Sem esta trava, Máximo < Mínimo (ambos nascem 0/0) produz déficit e
-- sugestão de compra negativos em Sugestões de Compra e na Fila de
-- Reposição. Adicionado via DO $$ (não direto no CREATE TABLE) para que a
-- re-execução deste arquivo num banco existente não falhe: ALTER TABLE ...
-- ADD CONSTRAINT não tem IF NOT EXISTS nativo antes do DROP.
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_max_stock_gte_min_stock;
ALTER TABLE products
  ADD CONSTRAINT chk_products_max_stock_gte_min_stock CHECK (max_stock >= min_stock);

-- =====================
-- DEPARTMENTS TABLE (setor do COLABORADOR)
-- =====================
-- migration_colaboradores_csv.sql. Não confundir com `sectors`/`categories`,
-- exclusivos de produto — ver comentário acima e ADR-0003.
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sem seed: os setores de colaborador são cadastrados pela tela antes da importação.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_departments_name_ci
  ON departments (lower(trim(name)));

-- =====================
-- ROLES TABLE
-- =====================
-- migration_chapas_armarios.sql.
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name) VALUES
  ('Motorista'),
  ('Auxiliar de Operação'),
  ('Operador de Empilhadeira')
ON CONFLICT (name) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_roles_name_ci
  ON roles (lower(trim(name)));

-- =====================
-- EMPLOYEES TABLE
-- =====================
-- Forma final: já nasce com department_id (migration_colaboradores_csv.sql
-- substituiu o antigo sector_id de migration_chapas_armarios.sql). Uma
-- instalação nova não passa pela coluna sector_id intermediária.
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- Nome único entre colaboradores: última linha de defesa contra reimportação
-- duplicada. O front antecipa a mensagem amigável; o banco garante.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_full_name
  ON employees (lower(trim(full_name)));

-- =====================
-- LOCKERS TABLE
-- =====================
-- migration_chapas_armarios.sql.
CREATE TABLE IF NOT EXISTS lockers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL CHECK (kind IN ('uniforme', 'vestiario')),
  number INTEGER NOT NULL CHECK (number > 0),
  size TEXT CHECK (size IN ('P', 'M', 'G', 'GG', 'XG', 'SSG')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_lockers_uniforme_size CHECK (kind <> 'uniforme' OR size IS NOT NULL),
  CONSTRAINT uniq_lockers_kind_number UNIQUE (kind, number)
);

-- =====================
-- LOCKER ASSIGNMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS locker_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  locker_id UUID NOT NULL REFERENCES lockers(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  locker_kind TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locker_assignments_locker ON locker_assignments(locker_id);
CREATE INDEX IF NOT EXISTS idx_locker_assignments_employee ON locker_assignments(employee_id);

-- Garante no máximo um ocupante ativo por armário
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_assignment_per_locker
  ON locker_assignments (locker_id) WHERE ended_at IS NULL;

-- Garante no máximo uma ocupação ativa por colaborador, por tipo de armário
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_assignment_per_employee_kind
  ON locker_assignments (employee_id, locker_kind) WHERE ended_at IS NULL;

-- =====================
-- MOVEMENTS TABLE
-- =====================
-- employee_id (migration_fase2_solicitante.sql): colaborador solicitante na
-- Saída. Nullable — nem toda saída tem colaborador atrelado.
CREATE TABLE IF NOT EXISTS movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  quantity INTEGER NOT NULL,
  entity_name TEXT, -- Fornecedor ou Solicitante
  unit_value DECIMAL(10, 2), -- Valor unitário na entrada / custo congelado na saída
  invoice_number TEXT, -- Nota fiscal
  is_initial_import BOOLEAN DEFAULT false,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_employee ON movements(employee_id);

-- =====================
-- PRICE HISTORY TABLE
-- =====================
-- movement_id: ON DELETE SET NULL (migration_integridade_historico.sql item
-- b). Era CASCADE — excluir uma Entrada apagava junto o ponto de
-- price_history correspondente, destruindo permanentemente um dado do
-- gráfico de variação de preços (ver supabase/diagnostico_movimentacoes.sql,
-- query 6). O registro de preço deve sobreviver à exclusão da movimentação
-- que o originou.
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_id UUID REFERENCES movements(id) ON DELETE SET NULL, -- SET NULL preserva o histórico de preço
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2) NOT NULL,
  invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_movement ON price_history(movement_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created ON price_history(created_at DESC);

-- Numa instalação já existente cuja FK ainda seja CASCADE (schema.sql antigo
-- rodado antes desta correção), corrige a regra sem depender do nome padrão
-- da constraint, que pode ter sido renomeada.
DO $$
DECLARE
  v_constraint_name TEXT;
  v_delete_rule TEXT;
BEGIN
  SELECT con.conname, rc.delete_rule
  INTO v_constraint_name, v_delete_rule
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  JOIN information_schema.referential_constraints rc ON rc.constraint_name = con.conname
  WHERE rel.relname = 'price_history'
    AND con.contype = 'f'
    AND att.attname = 'movement_id';

  IF v_constraint_name IS NOT NULL AND v_delete_rule = 'CASCADE' THEN
    EXECUTE format('ALTER TABLE price_history DROP CONSTRAINT IF EXISTS %I;', v_constraint_name);
    ALTER TABLE price_history
      ADD CONSTRAINT price_history_movement_id_fkey
      FOREIGN KEY (movement_id) REFERENCES movements(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- =====================
-- CONFIG TABLE
-- =====================
CREATE TABLE IF NOT EXISTS config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  access_password TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'Silcon Ambiental'
);

-- Singleton: garante que só possa existir uma linha (migration_fase1_higiene.sql).
-- Sem este índice, `INSERT ... ON CONFLICT DO NOTHING` abaixo não tem contra o
-- que conflitar — cada re-execução deste arquivo acrescenta outra linha, e a
-- partir da segunda o `.single()` de app/login/page.tsx passa a devolver erro
-- PGRST116, degradando o login para o caminho de senha de fallback.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_config_singleton ON config ((true));

INSERT INTO config (access_password, company_name)
VALUES ('silcon2024', 'Silcon Ambiental')
ON CONFLICT DO NOTHING;

-- =====================
-- QUIZ RESPOSTAS TABLE
-- =====================
-- migration_quiz_seguranca.sql.
CREATE TABLE IF NOT EXISTS quiz_respostas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_respostas_created ON quiz_respostas(created_at DESC);

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

-- 1. Update Product Quantity
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

-- Remove any legacy movement trigger to keep a single source of truth for stock.
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

DROP TRIGGER IF EXISTS trigger_update_product_qty ON movements;
CREATE TRIGGER trigger_update_product_qty
  AFTER INSERT ON movements
  FOR EACH ROW
  EXECUTE FUNCTION update_product_quantity();

-- 1b. Freeze Exit Cost (ADR-0002)
-- Saídas gravam o cost_price vigente do produto na própria movimentação, no
-- momento do registro, para que relatórios de consumo em R$ nunca reavaliem
-- o histórico quando o preço do produto muda.
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

-- 3. Canonical stock reversion on movement delete.
--
-- NOTA HISTÓRICA: existiu uma função irmã, `reverse_movement_on_delete()`,
-- definida neste arquivo mas NUNCA anexada a nenhum trigger (o trigger
-- sempre apontou para `reconcile_product_on_delete`, abaixo). Ela reverta o
-- estoque por DELTA (`current_qty ± OLD.quantity`) em vez de recalcular a
-- soma completa das movimentações restantes — exatamente a lógica que
-- causou o bug de débito duplicado corrigido por
-- supabase/hotfix_fix_saida_duplicada.sql. Foi removida por
-- migration_fase1_higiene.sql (`DROP FUNCTION IF EXISTS
-- reverse_movement_on_delete()`) para que ninguém a reanexe a um trigger por
-- engano e reintroduza o bug. Não recriar esta função.
--
-- `reconcile_product_on_delete` também exige `invoice_number IS NOT NULL` na
-- Entrada anterior usada para restaurar `cost_price`
-- (migration_fase0_integridade.sql secao 4 — CONTEXT.md: só Entrada com NF +
-- valor unitário é fonte válida de Custo Cadastrado) e preserva
-- `COALESCE(prev_cost, cost_price)` em vez de `SET cost_price = prev_cost`
-- (migration_integridade_historico.sql item d — não zerar o custo quando não
-- há Entrada anterior).
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
    -- Cadastrado. Sem o AND invoice_number IS NOT NULL, esta função podia
    -- restaurar o custo a partir de uma entrada informal.
    SELECT unit_value INTO prev_cost
    FROM movements
    WHERE product_id = OLD.product_id
      AND type = 'IN'
      AND unit_value IS NOT NULL
      AND invoice_number IS NOT NULL
      AND id != OLD.id
    ORDER BY created_at DESC
    LIMIT 1;

    -- COALESCE preserva o último custo conhecido quando não há Entrada
    -- anterior com NF (nunca zera cost_price).
    UPDATE products
    SET cost_price = COALESCE(prev_cost, cost_price),
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
  EXECUTE FUNCTION reconcile_product_on_delete();

-- 4. Reconcile current stock with movement history (one-time correction on apply).
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

-- 5. Locker assignment: preenche locker_kind e bloqueia armário/colaborador inativo.
CREATE OR REPLACE FUNCTION set_locker_assignment_kind()
RETURNS TRIGGER AS $$
DECLARE
  v_locker_active BOOLEAN;
  v_locker_kind TEXT;
  v_employee_active BOOLEAN;
BEGIN
  SELECT is_active, kind INTO v_locker_active, v_locker_kind
  FROM lockers
  WHERE id = NEW.locker_id;

  IF v_locker_kind IS NULL THEN
    RAISE EXCEPTION 'Armário não encontrado';
  END IF;

  IF NOT v_locker_active THEN
    RAISE EXCEPTION 'Armário está inativo';
  END IF;

  SELECT is_active INTO v_employee_active
  FROM employees
  WHERE id = NEW.employee_id;

  IF v_employee_active IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;

  IF NOT v_employee_active THEN
    RAISE EXCEPTION 'Colaborador está desligado';
  END IF;

  NEW.locker_kind := v_locker_kind;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_locker_assignment_kind ON locker_assignments;
CREATE TRIGGER trigger_set_locker_assignment_kind
  BEFORE INSERT ON locker_assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_locker_assignment_kind();

-- 6. updated_at automático em employees
CREATE OR REPLACE FUNCTION set_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_employees_updated_at ON employees;
CREATE TRIGGER trigger_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION set_employees_updated_at();

-- 7. RPC transfer_locker_assignment — transferência de armário atômica
-- (migration_fase0_integridade.sql secao 1). Antes, o front-end fazia duas
-- escritas separadas: encerrar a ocupação atual e, na sequência, inserir a
-- nova. Se o INSERT falhasse, o ocupante original já tinha perdido o
-- armário, que ficava vazio sem ninguém. Uma função PL/pgSQL executa como
-- uma única transação implícita: se o INSERT levantar exceção, o UPDATE
-- anterior é revertido junto.
CREATE OR REPLACE FUNCTION transfer_locker_assignment(
  p_assignment_id UUID,
  p_locker_id UUID,
  p_employee_id UUID
)
RETURNS locker_assignments
SECURITY INVOKER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_assignment locker_assignments;
BEGIN
  UPDATE locker_assignments
  SET ended_at = NOW()
  WHERE id = p_assignment_id
    AND ended_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ocupação não encontrada ou já encerrada';
  END IF;

  INSERT INTO locker_assignments (locker_id, employee_id)
  VALUES (p_locker_id, p_employee_id)
  RETURNING * INTO v_new_assignment;

  RETURN v_new_assignment;
END;
$$;

GRANT EXECUTE ON FUNCTION transfer_locker_assignment(UUID, UUID, UUID) TO anon;

-- 8. RPC deactivate_employee — desligamento atômico
-- (migration_fase0_integridade.sql secao 2). Mesmo padrão de defeito do
-- item 7: duas escritas separadas (is_active=false, depois encerrar
-- ocupações) deixavam o colaborador desligado segurando o armário se a
-- segunda falhasse — e o armário deixava de ser liberável por qualquer
-- tela, já que o colaborador sai de `activeEmployees`.
CREATE OR REPLACE FUNCTION deactivate_employee(p_employee_id UUID)
RETURNS employees
SECURITY INVOKER
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee employees;
BEGIN
  UPDATE employees
  SET is_active = false
  WHERE id = p_employee_id
  RETURNING * INTO v_employee;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;

  UPDATE locker_assignments
  SET ended_at = NOW()
  WHERE employee_id = p_employee_id
    AND ended_at IS NULL;

  RETURN v_employee;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_employee(UUID) TO anon;

-- =====================
-- RLS POLICIES
-- =====================
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON sectors;
CREATE POLICY "Allow all" ON sectors FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON categories;
CREATE POLICY "Allow all" ON categories FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON products;
CREATE POLICY "Allow all" ON products FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON movements;
CREATE POLICY "Allow all" ON movements FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON config;
CREATE POLICY "Allow all" ON config FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON price_history;
CREATE POLICY "Allow all" ON price_history FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON departments;
CREATE POLICY "Allow all" ON departments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON roles;
CREATE POLICY "Allow all" ON roles FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON employees;
CREATE POLICY "Allow all" ON employees FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON lockers;
CREATE POLICY "Allow all" ON lockers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON locker_assignments;
CREATE POLICY "Allow all" ON locker_assignments FOR ALL USING (true);

-- Página pública: colaboradores inserem sem login; gestor lê tudo (gate por senha no app).
DROP POLICY IF EXISTS "Allow all" ON quiz_respostas;
CREATE POLICY "Allow all" ON quiz_respostas FOR ALL USING (true) WITH CHECK (true);

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
-- LEGADO: view morta, nenhum código lê `dashboard_stats` (será substituída
-- pelos RPCs da Fase 3 do plano de dashboard). Ainda conta produtos
-- inativos — não usar como referência para "crítico"/"zerado" em código
-- novo. Fora de escopo desta fase mexer nela.
DROP VIEW IF EXISTS dashboard_stats;
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM products WHERE current_qty < min_stock AND current_qty > 0) as critical_products,
  (SELECT COUNT(*) FROM products WHERE current_qty = 0) as zero_stock,
  (SELECT COALESCE(SUM(current_qty * COALESCE(cost_price, 0)), 0) FROM products) as total_inventory_cost;
