-- Silcon Ambiental - Migração: Setores de Colaborador (departments) + Importação CSV
-- Aditiva e idempotente. Rodar no SQL Editor do Supabase.
--
-- ATENÇÃO: na PRIMEIRA execução esta migração apaga employees e locker_assignments
-- (dados de teste). Os armários (lockers) são preservados.

-- =====================
-- DEPARTMENTS TABLE
-- =====================
-- Setor do COLABORADOR. Não confundir com `sectors`, que é a categoria de
-- material do almoxarifado e continua exclusiva de products.
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sem seed: os setores de colaborador são cadastrados pela tela antes da importação.

-- =====================
-- LIMPEZA DOS DADOS DE TESTE (somente na primeira execução)
-- =====================
-- Guardado pela presença de employees.sector_id, que o ALTER abaixo remove. Numa
-- segunda execução a coluna já não existe e o bloco inteiro é pulado, preservando
-- os colaboradores reais já importados.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'sector_id'
  ) THEN
    -- Ordem obrigatória: locker_assignments.employee_id é ON DELETE RESTRICT.
    DELETE FROM locker_assignments;
    DELETE FROM employees;
  END IF;
END;
$$;

-- =====================
-- EMPLOYEES: sector_id -> department_id
-- =====================
ALTER TABLE employees DROP COLUMN IF EXISTS sector_id;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);

-- Nome único entre colaboradores: última linha de defesa contra reimportação
-- duplicada. O front antecipa a mensagem amigável; o banco garante.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_full_name
  ON employees (lower(trim(full_name)));

-- =====================
-- RLS POLICIES
-- =====================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON departments;
CREATE POLICY "Allow all" ON departments FOR ALL USING (true);
