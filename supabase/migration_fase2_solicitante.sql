-- Silcon Ambiental - Migração: Fase 2 - Colaborador como Solicitante na Saída
-- Aditiva e idempotente. Rodar no SQL Editor do Supabase.

ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movements_employee ON movements(employee_id);
