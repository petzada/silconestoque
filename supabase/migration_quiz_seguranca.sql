-- Silcon Ambiental - Migração: Quiz de Segurança do Trabalho
-- Aditiva e idempotente ao schema.sql. Rodar no SQL Editor do Supabase.

-- =====================
-- QUIZ RESPOSTAS TABLE
-- =====================
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
-- RLS POLICIES
-- =====================
-- Página pública: colaboradores inserem sem login; gestor lê tudo (gate por senha no app).
ALTER TABLE quiz_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON quiz_respostas;
CREATE POLICY "Allow all" ON quiz_respostas FOR ALL USING (true) WITH CHECK (true);
