-- Silcon Ambiental - Migração: Chapas & Armários + Colaboradores
-- Aditiva e idempotente ao schema.sql. Rodar no SQL Editor do Supabase.

-- =====================
-- ROLES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed inicial de funções
INSERT INTO roles (name) VALUES
  ('Motorista'),
  ('Auxiliar de Operação'),
  ('Operador de Empilhadeira')
ON CONFLICT (name) DO NOTHING;

-- =====================
-- EMPLOYEES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_sector ON employees(sector_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- =====================
-- LOCKERS TABLE
-- =====================
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
-- FUNCTIONS & TRIGGERS
-- =====================

-- 1. Preenche locker_kind a partir do armário e bloqueia armário/colaborador inativo
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

-- 2. updated_at automático em employees
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

-- =====================
-- RLS POLICIES
-- =====================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locker_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON roles;
CREATE POLICY "Allow all" ON roles FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON employees;
CREATE POLICY "Allow all" ON employees FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON lockers;
CREATE POLICY "Allow all" ON lockers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all" ON locker_assignments;
CREATE POLICY "Allow all" ON locker_assignments FOR ALL USING (true);
