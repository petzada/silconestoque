-- =============================================================================
-- migration_auth_rls.sql
-- Autenticação real: RLS exige role authenticated + created_by em movements
-- + GRANT EXECUTE dos RPCs para authenticated (quando existirem).
--
-- Aplicar à mão no SQL Editor do Supabase DEPOIS de criar os usuários no
-- painel Auth (Authentication → Users). Sem usuários, o app autentica mas
-- ninguém consegue entrar.
--
-- Ordem sugerida relativa às pendentes (#11–#14): independente de schema
-- delas; pode rodar antes ou depois. GRANTs de RPC são condicionais — se a
-- função ainda não existe (Fase 0/3 pendente), o bloco é no-op e deve ser
-- reaplicado (ou os GRANTs feitos) depois que #11/#13 rodarem.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rastreabilidade: quem lançou a movimentação
-- -----------------------------------------------------------------------------
ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();

COMMENT ON COLUMN movements.created_by IS
  'Usuário Auth (auth.uid()) que inseriu a linha. NULL em registros anteriores à migration.';

-- -----------------------------------------------------------------------------
-- 2. Trocar políticas "Allow all" por acesso autenticado
--    TO authenticated: anon key sem JWT não passa.
-- -----------------------------------------------------------------------------

-- sectors
DROP POLICY IF EXISTS "Allow all" ON sectors;
DROP POLICY IF EXISTS "Authenticated" ON sectors;
CREATE POLICY "Authenticated" ON sectors
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- categories
DROP POLICY IF EXISTS "Allow all" ON categories;
DROP POLICY IF EXISTS "Authenticated" ON categories;
CREATE POLICY "Authenticated" ON categories
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- products
DROP POLICY IF EXISTS "Allow all" ON products;
DROP POLICY IF EXISTS "Authenticated" ON products;
CREATE POLICY "Authenticated" ON products
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- movements
DROP POLICY IF EXISTS "Allow all" ON movements;
DROP POLICY IF EXISTS "Authenticated" ON movements;
CREATE POLICY "Authenticated" ON movements
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- config (access_password deixa de ser usada pelo app; coluna permanece)
DROP POLICY IF EXISTS "Allow all" ON config;
DROP POLICY IF EXISTS "Authenticated" ON config;
CREATE POLICY "Authenticated" ON config
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- price_history
DROP POLICY IF EXISTS "Allow all" ON price_history;
DROP POLICY IF EXISTS "Authenticated" ON price_history;
CREATE POLICY "Authenticated" ON price_history
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- departments
DROP POLICY IF EXISTS "Allow all" ON departments;
DROP POLICY IF EXISTS "Authenticated" ON departments;
CREATE POLICY "Authenticated" ON departments
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- roles
DROP POLICY IF EXISTS "Allow all" ON roles;
DROP POLICY IF EXISTS "Authenticated" ON roles;
CREATE POLICY "Authenticated" ON roles
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- employees
DROP POLICY IF EXISTS "Allow all" ON employees;
DROP POLICY IF EXISTS "Authenticated" ON employees;
CREATE POLICY "Authenticated" ON employees
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- lockers
DROP POLICY IF EXISTS "Allow all" ON lockers;
DROP POLICY IF EXISTS "Authenticated" ON lockers;
CREATE POLICY "Authenticated" ON lockers
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- locker_assignments
DROP POLICY IF EXISTS "Allow all" ON locker_assignments;
DROP POLICY IF EXISTS "Authenticated" ON locker_assignments;
CREATE POLICY "Authenticated" ON locker_assignments
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- quiz_respostas (rota desativada permanentemente; fecha superfície se alguém
-- reativar o path sem querer)
DROP POLICY IF EXISTS "Allow all" ON quiz_respostas;
DROP POLICY IF EXISTS "Authenticated" ON quiz_respostas;
CREATE POLICY "Authenticated" ON quiz_respostas
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- follow_up_*
DROP POLICY IF EXISTS "Allow all" ON follow_up_solicitations;
DROP POLICY IF EXISTS "Authenticated" ON follow_up_solicitations;
CREATE POLICY "Authenticated" ON follow_up_solicitations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON follow_up_purchase_orders;
DROP POLICY IF EXISTS "Authenticated" ON follow_up_purchase_orders;
CREATE POLICY "Authenticated" ON follow_up_purchase_orders
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON follow_up_receipts;
DROP POLICY IF EXISTS "Authenticated" ON follow_up_receipts;
CREATE POLICY "Authenticated" ON follow_up_receipts
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- schema_migrations (se existir; senão cria só o bookkeeping no fim)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schema_migrations'
  ) THEN
    ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all" ON schema_migrations;
    DROP POLICY IF EXISTS "Authenticated" ON schema_migrations;
    CREATE POLICY "Authenticated" ON schema_migrations
      FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. RPCs: com JWT o role é authenticated — GRANT só a anon deixa de bastar.
--    Condicional: #11/#13 podem ainda não ter sido aplicadas neste banco.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('transfer_locker_assignment(uuid,uuid,uuid)'),
      ('deactivate_employee(uuid)'),
      ('dashboard_operacao(uuid)'),
      ('dashboard_analise_kpis(date,date,uuid,uuid)'),
      ('dashboard_serie(date,date,uuid,uuid)'),
      ('dashboard_dimensao(date,date,text,uuid,uuid,integer)'),
      ('dashboard_destaques(date,date,uuid,uuid)')
    ) AS t(sig)
  LOOP
    IF to_regprocedure(r.sig) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Registro em schema_migrations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('migration_auth_rls.sql')
ON CONFLICT (filename) DO NOTHING;
