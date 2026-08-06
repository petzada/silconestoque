-- Silcon Ambiental Database Schema
-- Run this in Supabase SQL Editor
--
-- SNAPSHOT — este arquivo é o bootstrap de instalação nova E reflete o estado
-- final do banco depois de aplicar, em produção, as migrations históricas de
-- supabase/ (chapas & armários, colaboradores/CSV, categorias de produto,
-- custo congelado na saída, quiz, Fase 0 de integridade, Fase 3 fundação
-- analítica). Ver supabase/README.md para a ordem canônica de cada arquivo,
-- o que já foi absorvido aqui e o que NUNCA deve ser re-executado.
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
-- department_id (migration_fase3_analitico.sql): carimbo do setor do
-- colaborador NO MOMENTO da movimentação (ver trigger
-- stamp_movement_department, abaixo). Existe porque employees.department_id
-- é escalar mutável sem histórico — sem este carimbo, mover uma pessoa de
-- setor reescreveria retroativamente o consumo por setor de todos os meses
-- anteriores. Nullable: linhas sem employee_id (solicitante avulso/nome
-- livre) ficam com department_id NULL e agrupam como "Sem solicitante" nos
-- RPCs de dashboard.
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
  created_by UUID DEFAULT auth.uid(), -- quem lançou (Supabase Auth); NULL em legado pré-auth
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instalação nova a partir deste schema.sql já nasce com a coluna; o
-- ADD COLUMN IF NOT EXISTS é o que torna a re-execução deste arquivo, e a
-- aplicação de migration_fase3_analitico.sql sobre um banco mais antigo,
-- idempotentes.
ALTER TABLE movements ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_employee ON movements(employee_id);
-- migration_fase3_analitico.sql: forma de toda query de replay do ledger de
-- um produto (cobertura em dias, série de consumo) e de consumo por setor
-- com filtro de período. idx_movements_created (só created_at) não atende
-- filtro composto.
CREATE INDEX IF NOT EXISTS idx_movements_product_created ON movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_movements_department_created ON movements(department_id, created_at);

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

-- 1c. Stamp movement department (migration_fase3_analitico.sql, D10 do
-- plano de dashboard). Copia employees.department_id para a movimentação no
-- momento do INSERT, quando há employee_id e department_id ainda não foi
-- informado — mesma lógica de "congelar no momento do fato" que
-- freeze_exit_cost já aplica ao custo (ADR-0002).
--
-- ORDEM DE DISPARO: BEFORE INSERT dispara em ordem alfabética do NOME DO
-- TRIGGER quando há mais de um no mesmo evento. "trigger_freeze_exit_cost"
-- vem antes de "trigger_stamp_movement_department" ('f' < 's'), então
-- freeze_exit_cost roda primeiro — mas isso é irrelevante aqui: este
-- trigger só lê NEW.employee_id (imutável, já veio do INSERT) e
-- NEW.department_id (só grava se ainda NULL), nunca toca unit_value/type,
-- que é tudo que freeze_exit_cost usa. Não há dependência de dado entre os
-- dois em nenhuma ordem; o nome foi escolhido para não insinuar uma.
CREATE OR REPLACE FUNCTION stamp_movement_department()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NOT NULL AND NEW.department_id IS NULL THEN
    SELECT department_id INTO NEW.department_id
    FROM employees
    WHERE id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stamp_movement_department ON movements;
CREATE TRIGGER trigger_stamp_movement_department
  BEFORE INSERT ON movements
  FOR EACH ROW
  EXECUTE FUNCTION stamp_movement_department();

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

-- 4b. Backfill de movements.department_id (migration_fase3_analitico.sql,
-- one-time correction on apply — mesmo padrão do item 4 acima). Só toca
-- linhas com department_id ainda NULL, então é seguro re-executar.
--
-- ASSUNÇÃO REGISTRADA (D10 do plano de dashboard): department_id = setor
-- ATUAL do colaborador, não o setor de quando a saída ocorreu. Isso CONGELA
-- a distorção já existente em vez de perpetuá-la via JOIN ao vivo. Números
-- de consumo por setor para movimentações anteriores a esta migration são
-- APROXIMADOS; a partir dela, o trigger trigger_stamp_movement_department
-- garante que são fiéis.
UPDATE movements m
SET department_id = e.department_id
FROM employees e
WHERE m.employee_id = e.id
  AND m.department_id IS NULL;

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

GRANT EXECUTE ON FUNCTION transfer_locker_assignment(UUID, UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION transfer_locker_assignment(UUID, UUID, UUID) FROM anon;

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

GRANT EXECUTE ON FUNCTION deactivate_employee(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION deactivate_employee(UUID) FROM anon;

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

-- Auth real (migration_auth_rls.sql): só role authenticated. Anon key sem
-- JWT não lê nem escreve. Quiz permanece desativado na app.
DROP POLICY IF EXISTS "Allow all" ON sectors;
DROP POLICY IF EXISTS "Authenticated" ON sectors;
CREATE POLICY "Authenticated" ON sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON categories;
DROP POLICY IF EXISTS "Authenticated" ON categories;
CREATE POLICY "Authenticated" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON products;
DROP POLICY IF EXISTS "Authenticated" ON products;
CREATE POLICY "Authenticated" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON movements;
DROP POLICY IF EXISTS "Authenticated" ON movements;
CREATE POLICY "Authenticated" ON movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON config;
DROP POLICY IF EXISTS "Authenticated" ON config;
CREATE POLICY "Authenticated" ON config FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON price_history;
DROP POLICY IF EXISTS "Authenticated" ON price_history;
CREATE POLICY "Authenticated" ON price_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON departments;
DROP POLICY IF EXISTS "Authenticated" ON departments;
CREATE POLICY "Authenticated" ON departments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON roles;
DROP POLICY IF EXISTS "Authenticated" ON roles;
CREATE POLICY "Authenticated" ON roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON employees;
DROP POLICY IF EXISTS "Authenticated" ON employees;
CREATE POLICY "Authenticated" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON lockers;
DROP POLICY IF EXISTS "Authenticated" ON lockers;
CREATE POLICY "Authenticated" ON lockers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON locker_assignments;
DROP POLICY IF EXISTS "Authenticated" ON locker_assignments;
CREATE POLICY "Authenticated" ON locker_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON quiz_respostas;
DROP POLICY IF EXISTS "Authenticated" ON quiz_respostas;
CREATE POLICY "Authenticated" ON quiz_respostas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================
-- FOLLOW-UP TABLES
-- =====================

-- Solicitações de compra
-- `status` REMOVIDO por migration_dropa_status_followup.sql: coluna morta,
-- só escrita (nunca lida) pelo front-end — o status exibido na UI é sempre
-- derivado ao vivo por computeStatus() em app/(dashboard)/follow-up/page.tsx.
CREATE TABLE IF NOT EXISTS follow_up_solicitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number TEXT NOT NULL,
  request_date DATE NOT NULL,
  description TEXT NOT NULL,
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
DROP POLICY IF EXISTS "Authenticated" ON follow_up_solicitations;
CREATE POLICY "Authenticated" ON follow_up_solicitations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON follow_up_purchase_orders;
DROP POLICY IF EXISTS "Authenticated" ON follow_up_purchase_orders;
CREATE POLICY "Authenticated" ON follow_up_purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON follow_up_receipts;
DROP POLICY IF EXISTS "Authenticated" ON follow_up_receipts;
CREATE POLICY "Authenticated" ON follow_up_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================
-- VIEWS
-- =====================
-- REMOVIDA em migration_fase3_analitico.sql: `dashboard_stats` era view
-- morta (nenhum código a lia), contava produtos INATIVOS (sem
-- `is_active = true`) e divergia tanto das telas quanto das definições
-- normativas de CONTEXT.md para Zerado/Item Crítico. Substituída pelos RPCs
-- abaixo — dashboard_operacao cobre zerados/críticos/estáveis com a
-- definição correta, sempre sobre produtos ativos. Ver supabase/README.md.
DROP VIEW IF EXISTS dashboard_stats;

-- =====================
-- RPCs ANALÍTICOS (migration_fase3_analitico.sql — Fase 3 do plano de
-- dashboard, docs/superpowers/plans/2026-07-29-dashboard-home-plan.md §5)
-- =====================
-- SECURITY INVOKER, STABLE, GRANT EXECUTE TO authenticated. Parâmetros com prefixo
-- p_. Formato de retorno documentado no comentário de cada função — ver
-- migration_fase3_analitico.sql para a justificativa completa de cada
-- decisão de modelagem (is_active nas agregações históricas, filtro de
-- p_department_id, ordem dos destaques etc.), reproduzida aqui de forma
-- resumida.

-- 9. dashboard_operacao — foto instantânea (ignora período), devolve JSONB:
-- { zerados, criticos, estaveis, total_ativos, cobertura_abaixo_15_dias,
--   top_urgencia: [...], cobertura_criticos: [...], pedidos_atraso: [...] }
CREATE OR REPLACE FUNCTION dashboard_operacao(p_category_id UUID DEFAULT NULL)
RETURNS JSONB
SECURITY INVOKER
LANGUAGE sql
STABLE
AS $$
  WITH produtos_filtrados AS (
    SELECT p.*
    FROM products p
    WHERE p.is_active = true
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
  ),
  consumo_90d AS (
    SELECT m.product_id, SUM(m.quantity)::numeric AS qty_90d
    FROM movements m
    WHERE m.type = 'OUT'
      AND m.created_at >= (NOW() - INTERVAL '90 days')
    GROUP BY m.product_id
  ),
  cobertura AS (
    SELECT
      pf.id AS product_id,
      pf.name AS product_name,
      pf.sku_code,
      pf.current_qty,
      CASE
        WHEN COALESCE(c.qty_90d, 0) = 0 THEN NULL -- sem consumo => cobertura infinita
        ELSE pf.current_qty / (c.qty_90d / 90.0)
      END AS cobertura_dias
    FROM produtos_filtrados pf
    LEFT JOIN consumo_90d c ON c.product_id = pf.id
  ),
  contagens AS (
    SELECT
      COUNT(*) FILTER (WHERE current_qty = 0) AS zerados,
      COUNT(*) FILTER (WHERE current_qty < min_stock AND current_qty > 0) AS criticos,
      -- Faixas mutuamente exclusivas: CONTEXT.md define Zerado como "uma
      -- faixa propria". Sem o `current_qty > 0`, um produto com min_stock = 0
      -- e current_qty = 0 contaria em zerados E em estaveis, e a soma passaria
      -- de total_ativos, quebrando o "% do catalogo em risco".
      COUNT(*) FILTER (WHERE current_qty >= min_stock AND current_qty > 0) AS estaveis,
      COUNT(*) AS total_ativos
    FROM produtos_filtrados
  ),
  urgencia AS (
    SELECT
      pf.id AS product_id,
      pf.name AS product_name,
      pf.sku_code,
      pf.current_qty,
      pf.min_stock,
      CASE WHEN pf.current_qty = 0 THEN 'zerado' ELSE 'critico' END AS faixa,
      CASE
        WHEN pf.current_qty = 0 THEN NULL
        ELSE (pf.min_stock - pf.current_qty)::numeric / NULLIF(pf.min_stock, 0)
      END AS deficit_relativo
    FROM produtos_filtrados pf
    WHERE pf.current_qty = 0 OR (pf.current_qty < pf.min_stock AND pf.current_qty > 0)
  ),
  top_urgencia AS (
    SELECT * FROM urgencia
    ORDER BY (current_qty = 0) DESC, deficit_relativo DESC NULLS LAST, product_name ASC
    LIMIT 10
  ),
  top_cobertura AS (
    SELECT * FROM cobertura
    WHERE cobertura_dias IS NOT NULL
    ORDER BY cobertura_dias ASC, product_name ASC
    LIMIT 15
  ),
  pedidos_atraso AS (
    SELECT
      po.id AS po_id,
      po.po_number,
      po.supplier_name,
      po.estimated_delivery,
      (CURRENT_DATE - po.estimated_delivery) AS dias_atraso
    FROM follow_up_purchase_orders po
    LEFT JOIN follow_up_receipts r ON r.purchase_order_id = po.id
    WHERE po.estimated_delivery IS NOT NULL
      AND po.estimated_delivery < CURRENT_DATE
      AND r.id IS NULL
  )
  SELECT jsonb_build_object(
    'zerados', contagens.zerados,
    'criticos', contagens.criticos,
    'estaveis', contagens.estaveis,
    'total_ativos', contagens.total_ativos,
    'cobertura_abaixo_15_dias',
      (SELECT COUNT(*) FROM cobertura WHERE cobertura_dias IS NOT NULL AND cobertura_dias < 15),
    'top_urgencia',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY (t.current_qty = 0) DESC, t.deficit_relativo DESC NULLS LAST, t.product_name ASC)
         FROM top_urgencia t),
        '[]'::jsonb
      ),
    'cobertura_criticos',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.cobertura_dias ASC, t.product_name ASC) FROM top_cobertura t),
        '[]'::jsonb
      ),
    'pedidos_atraso',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.dias_atraso DESC) FROM pedidos_atraso t),
        '[]'::jsonb
      )
  )
  FROM contagens;
$$;

GRANT EXECUTE ON FUNCTION dashboard_operacao(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION dashboard_operacao(UUID) FROM anon;

-- 10. dashboard_analise_kpis — TABLE de 1 linha: consumo/compras/nº de
-- movimentações do período e do período anterior equivalente, lado a lado,
-- mais valor_imobilizado (snapshot, sem par anterior). Bucketização de dia
-- sempre via (created_at AT TIME ZONE 'America/Sao_Paulo')::date.
CREATE OR REPLACE FUNCTION dashboard_analise_kpis(
  p_from DATE,
  p_to DATE,
  p_category_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  consumo_atual NUMERIC,
  consumo_anterior NUMERIC,
  compras_atual NUMERIC,
  compras_anterior NUMERIC,
  movimentacoes_atual BIGINT,
  movimentacoes_anterior BIGINT,
  valor_imobilizado NUMERIC
)
SECURITY INVOKER
LANGUAGE sql
STABLE
AS $$
  WITH periodo AS (
    SELECT
      p_from AS from_atual,
      p_to AS to_atual,
      p_from - (p_to - p_from + 1) AS from_anterior,
      p_from - 1 AS to_anterior
  ),
  movimentos_filtrados AS (
    SELECT
      m.type,
      m.quantity,
      m.unit_value,
      m.invoice_number,
      COALESCE(m.is_initial_import, false) AS is_initial_import,
      (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia_local
    FROM movements m
    JOIN products p ON p.id = m.product_id
    WHERE (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_department_id IS NULL OR m.department_id = p_department_id)
  ),
  atual AS (
    SELECT
      COALESCE(SUM(quantity * unit_value) FILTER (WHERE type = 'OUT' AND NOT is_initial_import), 0) AS consumo,
      COALESCE(SUM(quantity * unit_value) FILTER (WHERE type = 'IN' AND NOT is_initial_import AND invoice_number IS NOT NULL), 0) AS compras,
      COUNT(*) AS movs
    FROM movimentos_filtrados, periodo
    WHERE dia_local BETWEEN periodo.from_atual AND periodo.to_atual
  ),
  anterior AS (
    SELECT
      COALESCE(SUM(quantity * unit_value) FILTER (WHERE type = 'OUT' AND NOT is_initial_import), 0) AS consumo,
      COALESCE(SUM(quantity * unit_value) FILTER (WHERE type = 'IN' AND NOT is_initial_import AND invoice_number IS NOT NULL), 0) AS compras,
      COUNT(*) AS movs
    FROM movimentos_filtrados, periodo
    WHERE dia_local BETWEEN periodo.from_anterior AND periodo.to_anterior
  ),
  imobilizado AS (
    SELECT COALESCE(SUM(current_qty * cost_price), 0) AS valor
    FROM products
    WHERE is_active = true
      AND (p_category_id IS NULL OR category_id = p_category_id)
  )
  SELECT
    atual.consumo,
    anterior.consumo,
    -- NULL, nao 0, quando ha filtro de setor: Entradas nunca carregam
    -- department_id, entao "compras deste setor" e uma pergunta que nao
    -- existe, nao uma compra de valor zero. Zero viraria KPI mentiroso.
    CASE WHEN p_department_id IS NULL THEN atual.compras END,
    CASE WHEN p_department_id IS NULL THEN anterior.compras END,
    atual.movs,
    anterior.movs,
    imobilizado.valor
  FROM atual, anterior, imobilizado;
$$;

GRANT EXECUTE ON FUNCTION dashboard_analise_kpis(DATE, DATE, UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION dashboard_analise_kpis(DATE, DATE, UUID, UUID) FROM anon;

-- 11. dashboard_serie — buckets DIÁRIOS de consumo/compras via
-- generate_series (dia sem movimento vem com 0, nunca some).
CREATE OR REPLACE FUNCTION dashboard_serie(
  p_from DATE,
  p_to DATE,
  p_category_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  dia DATE,
  consumo NUMERIC,
  compras NUMERIC
)
SECURITY INVOKER
LANGUAGE sql
STABLE
AS $$
  WITH dias AS (
    SELECT generate_series(p_from, p_to, INTERVAL '1 day')::date AS dia
  ),
  movimentos AS (
    SELECT
      (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia_local,
      m.type,
      m.quantity,
      m.unit_value,
      m.invoice_number,
      COALESCE(m.is_initial_import, false) AS is_initial_import
    FROM movements m
    JOIN products p ON p.id = m.product_id
    WHERE (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_department_id IS NULL OR m.department_id = p_department_id)
      AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
  )
  SELECT
    dias.dia,
    COALESCE(SUM(movimentos.quantity * movimentos.unit_value) FILTER (
      WHERE movimentos.type = 'OUT' AND NOT movimentos.is_initial_import
    ), 0) AS consumo,
    COALESCE(SUM(movimentos.quantity * movimentos.unit_value) FILTER (
      WHERE movimentos.type = 'IN' AND NOT movimentos.is_initial_import AND movimentos.invoice_number IS NOT NULL
    ), 0) AS compras
  FROM dias
  LEFT JOIN movimentos ON movimentos.dia_local = dias.dia
  GROUP BY dias.dia
  ORDER BY dias.dia;
$$;

GRANT EXECUTE ON FUNCTION dashboard_serie(DATE, DATE, UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION dashboard_serie(DATE, DATE, UUID, UUID) FROM anon;

-- 12. dashboard_dimensao — consumo (só OUT) por 'categoria'|'setor'|'produto',
-- com valor do período anterior, ordenado desc, limitado a p_limit. 'setor'
-- NULL agrupa como 'Sem solicitante'. p_dim inválido levanta RAISE
-- EXCEPTION em português.
CREATE OR REPLACE FUNCTION dashboard_dimensao(
  p_from DATE,
  p_to DATE,
  p_dim TEXT,
  p_category_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  dim_id UUID,
  dim_label TEXT,
  consumo_atual NUMERIC,
  consumo_anterior NUMERIC
)
SECURITY INVOKER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_from_anterior DATE;
  v_to_anterior DATE;
BEGIN
  IF p_dim NOT IN ('categoria', 'setor', 'produto') THEN
    RAISE EXCEPTION 'Dimensão inválida: %. Use ''categoria'', ''setor'' ou ''produto''.', p_dim;
  END IF;

  v_to_anterior := p_from - 1;
  v_from_anterior := p_from - (p_to - p_from + 1);

  IF p_dim = 'categoria' THEN
    RETURN QUERY
    WITH movimentos AS (
      SELECT
        c.id AS d_id,
        c.name AS d_label,
        m.quantity,
        m.unit_value,
        (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia_local
      FROM movements m
      JOIN products p ON p.id = m.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE m.type = 'OUT'
        AND NOT COALESCE(m.is_initial_import, false)
        AND (p_category_id IS NULL OR p.category_id = p_category_id)
        AND (p_department_id IS NULL OR m.department_id = p_department_id)
        AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_from_anterior AND p_to
    )
    SELECT
      mv.d_id,
      mv.d_label,
      COALESCE(SUM(mv.quantity * mv.unit_value) FILTER (WHERE mv.dia_local BETWEEN p_from AND p_to), 0),
      COALESCE(SUM(mv.quantity * mv.unit_value) FILTER (WHERE mv.dia_local BETWEEN v_from_anterior AND v_to_anterior), 0)
    FROM movimentos mv
    GROUP BY mv.d_id, mv.d_label
    ORDER BY 3 DESC
    LIMIT p_limit;

  ELSIF p_dim = 'setor' THEN
    RETURN QUERY
    WITH movimentos AS (
      SELECT
        d.id AS d_id,
        COALESCE(d.name, 'Sem solicitante') AS d_label,
        m.quantity,
        m.unit_value,
        (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia_local
      FROM movements m
      JOIN products p ON p.id = m.product_id
      LEFT JOIN departments d ON d.id = m.department_id
      WHERE m.type = 'OUT'
        AND NOT COALESCE(m.is_initial_import, false)
        AND (p_category_id IS NULL OR p.category_id = p_category_id)
        AND (p_department_id IS NULL OR m.department_id = p_department_id)
        AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_from_anterior AND p_to
    )
    SELECT
      mv.d_id,
      mv.d_label,
      COALESCE(SUM(mv.quantity * mv.unit_value) FILTER (WHERE mv.dia_local BETWEEN p_from AND p_to), 0),
      COALESCE(SUM(mv.quantity * mv.unit_value) FILTER (WHERE mv.dia_local BETWEEN v_from_anterior AND v_to_anterior), 0)
    FROM movimentos mv
    GROUP BY mv.d_id, mv.d_label
    ORDER BY 3 DESC
    LIMIT p_limit;

  ELSE -- 'produto'
    RETURN QUERY
    WITH movimentos AS (
      SELECT
        p.id AS d_id,
        p.name AS d_label,
        m.quantity,
        m.unit_value,
        (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia_local
      FROM movements m
      JOIN products p ON p.id = m.product_id
      WHERE m.type = 'OUT'
        AND NOT COALESCE(m.is_initial_import, false)
        AND (p_category_id IS NULL OR p.category_id = p_category_id)
        AND (p_department_id IS NULL OR m.department_id = p_department_id)
        AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_from_anterior AND p_to
    )
    SELECT
      mv.d_id,
      mv.d_label,
      COALESCE(SUM(mv.quantity * mv.unit_value) FILTER (WHERE mv.dia_local BETWEEN p_from AND p_to), 0),
      COALESCE(SUM(mv.quantity * mv.unit_value) FILTER (WHERE mv.dia_local BETWEEN v_from_anterior AND v_to_anterior), 0)
    FROM movimentos mv
    GROUP BY mv.d_id, mv.d_label
    ORDER BY 3 DESC
    LIMIT p_limit;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION dashboard_dimensao(DATE, DATE, TEXT, UUID, UUID, INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION dashboard_dimensao(DATE, DATE, TEXT, UUID, UUID, INT) FROM anon;

-- 13. dashboard_destaques — TABLE(tipo, texto, valor), 0 a 4 linhas na ordem
-- fixa: maior_alta_custo, setor_acima_media, categoria_maior_share (todos
-- omitidos se não houver dado qualificado no período), encalhe (sempre
-- presente, mesmo com valor 0).
CREATE OR REPLACE FUNCTION dashboard_destaques(
  p_from DATE,
  p_to DATE,
  p_category_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  tipo TEXT,
  texto TEXT,
  valor NUMERIC
)
SECURITY INVOKER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_baseline_from DATE;
  v_baseline_to DATE;
  v_dias_periodo INT;
BEGIN
  v_dias_periodo := (p_to - p_from + 1);
  v_baseline_to := p_from - 1;
  v_baseline_from := (p_from - INTERVAL '3 months')::date;

  -- 1. Maior alta percentual de custo (price_history)
  RETURN QUERY
  SELECT
    'maior_alta_custo'::text,
    format('%s teve alta de %s%% no custo no período', pr.name, round(pct.variacao * 100, 1)),
    round(pct.variacao * 100, 1)
  FROM (
    SELECT ph.product_id, (ph.new_price - ph.old_price) / ph.old_price AS variacao
    FROM price_history ph
    JOIN products p ON p.id = ph.product_id
    WHERE ph.old_price IS NOT NULL
      AND ph.old_price > 0
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (ph.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
    ORDER BY (ph.new_price - ph.old_price) / ph.old_price DESC, ph.created_at DESC, ph.id
    LIMIT 1
  ) pct
  JOIN products pr ON pr.id = pct.product_id;

  -- 2. Setor com consumo mais acima da própria média dos 3 meses anteriores
  RETURN QUERY
  WITH consumo_atual_setor AS (
    SELECT
      m.department_id,
      SUM(m.quantity * m.unit_value) AS consumo
    FROM movements m
    JOIN products p ON p.id = m.product_id
    WHERE m.type = 'OUT'
      AND NOT COALESCE(m.is_initial_import, false)
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_department_id IS NULL OR m.department_id = p_department_id)
      AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
    GROUP BY m.department_id
  ),
  consumo_baseline_setor AS (
    SELECT
      m.department_id,
      SUM(m.quantity * m.unit_value) / 90.0 AS consumo_medio_dia
    FROM movements m
    JOIN products p ON p.id = m.product_id
    WHERE m.type = 'OUT'
      AND NOT COALESCE(m.is_initial_import, false)
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_department_id IS NULL OR m.department_id = p_department_id)
      AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_baseline_from AND v_baseline_to
    GROUP BY m.department_id
  ),
  comparativo AS (
    SELECT
      ca.department_id,
      (ca.consumo - (cb.consumo_medio_dia * v_dias_periodo))
        / NULLIF(cb.consumo_medio_dia * v_dias_periodo, 0) AS variacao
    FROM consumo_atual_setor ca
    JOIN consumo_baseline_setor cb ON cb.department_id IS NOT DISTINCT FROM ca.department_id
    WHERE cb.consumo_medio_dia > 0
    ORDER BY variacao DESC, ca.department_id NULLS LAST
    LIMIT 1
  )
  SELECT
    'setor_acima_media'::text,
    format('%s consumiu %s%% acima da própria média dos últimos 3 meses', COALESCE(d.name, 'Sem solicitante'), round(c.variacao * 100, 1)),
    round(c.variacao * 100, 1)
  FROM comparativo c
  LEFT JOIN departments d ON d.id = c.department_id
  WHERE c.variacao > 0;

  -- 3. Categoria com maior share do consumo do período
  RETURN QUERY
  WITH consumo_categoria AS (
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      SUM(m.quantity * m.unit_value) AS consumo
    FROM movements m
    JOIN products p ON p.id = m.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE m.type = 'OUT'
      AND NOT COALESCE(m.is_initial_import, false)
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_department_id IS NULL OR m.department_id = p_department_id)
      AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
    GROUP BY c.id, c.name
  ),
  total AS (
    SELECT SUM(consumo) AS total_consumo FROM consumo_categoria
  )
  SELECT
    'categoria_maior_share'::text,
    format('%s concentra %s%% do consumo do período', cc.category_name, round((cc.consumo / NULLIF(t.total_consumo, 0)) * 100, 1)),
    round((cc.consumo / NULLIF(t.total_consumo, 0)) * 100, 1)
  FROM consumo_categoria cc
  CROSS JOIN total t
  WHERE t.total_consumo > 0
  ORDER BY cc.consumo DESC, cc.category_id
  LIMIT 1;

  -- 4. Encalhe: produtos ativos sem movimento há 90+ dias (referência: p_to)
  RETURN QUERY
  SELECT
    'encalhe'::text,
    format('%s produto(s) ativo(s) sem movimentação há mais de 90 dias', COUNT(*)),
    COUNT(*)::numeric
  FROM products p
  WHERE p.is_active = true
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    AND NOT EXISTS (
      SELECT 1 FROM movements m
      WHERE m.product_id = p.id
        AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date > (p_to - 90)
        AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_to
    );
END;
$$;

GRANT EXECUTE ON FUNCTION dashboard_destaques(DATE, DATE, UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION dashboard_destaques(DATE, DATE, UUID, UUID) FROM anon;
