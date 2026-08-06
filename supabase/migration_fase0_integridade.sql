-- Silcon Ambiental - Migração Fase 0: Correções de integridade de dados
-- Ver docs/superpowers/plans/2026-07-29-dashboard-home-plan.md, secao 2
-- (itens 1, 2, 5, 8 e 11 do nucleo/adjacentes). Os demais itens da Fase 0
-- (3, 4, 6, 7, 9, 10) são somente front-end e não têm SQL correspondente.
--
-- Aditiva. As funções usam CREATE OR REPLACE (idempotente). A normalização
-- de estoque (secao 3) e a consolidação de categorias (secao 5) são seguras
-- para re-executar: os WHERE/HAVING só encontram o que ainda falta corrigir
-- na segunda vez em diante.
--
-- Rodar no SQL Editor do Supabase, na ordem em que aparece neste arquivo.

-- =====================================================================
-- 1. RPC transfer_locker_assignment — transferência de armário atômica
-- =====================================================================
-- Antes, o front-end (components/lockers/locker-sheet.tsx) fazia duas
-- escritas separadas: encerrar a ocupação atual e, na sequência, inserir a
-- nova. Se o INSERT falhasse — índice uniq_active_assignment_per_employee_kind,
-- ou o trigger set_locker_assignment_kind recusando colaborador desligado ou
-- armário inativo — o ocupante original já tinha perdido o armário, que
-- ficava vazio sem ninguém. Uma função PL/pgSQL executa como uma única
-- transação implícita: se o INSERT levantar exceção, o UPDATE anterior é
-- revertido junto, sem precisar de BEGIN/COMMIT explícito no cliente.
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

-- =====================================================================
-- 2. RPC deactivate_employee — desligamento atômico
-- =====================================================================
-- Mesmo padrão de defeito do item 1: app/(dashboard)/employees/page.tsx
-- fazia `is_active = false` e depois encerrava as ocupações abertas do
-- colaborador em duas escritas separadas. Falhando a segunda, o colaborador
-- ficava desligado segurando o armário — e, por sair de `activeEmployees`
-- (components/lockers/locker-utils.ts), o armário deixava de ser liberável
-- por qualquer tela, já que nenhuma consulta voltaria a listar aquele
-- colaborador como candidato a transferência/liberação.
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

-- =====================================================================
-- 3. products: CHECK (max_stock >= min_stock)
-- =====================================================================
-- Sem esta trava, um Estoque Máximo menor que o Mínimo (ambos nascem com
-- default 0) produz déficit e sugestão de compra negativos em Sugestões de
-- Compra (purchase-orders/page.tsx) e "Repor p/ Max." negativo na Fila de
-- Reposição (replenishment-queue/page.tsx). O front-end passa a barrar isso
-- no formulário (superRefine do zod), mas o banco é a garantia final contra
-- qualquer escrita que não passe pelo formulário.
--
-- Linhas existentes que já violam a regra são normalizadas ANTES do CHECK
-- (senão o ALTER TABLE falha). Normalização escolhida: eleva max_stock até
-- o min_stock — nunca abaixa o mínimo. Justificativa: o Estoque Mínimo é o
-- piso de segurança e é o dado em que se pode confiar; o Estoque Máximo,
-- quando zerado por padrão em cadastros antigos ou vindos de importação
-- sem a coluna preenchida, é o valor mais provável de nunca ter sido
-- definido corretamente. Elevar o teto ao piso é a correção menos
-- destrutiva: nenhuma sugestão de compra passa a sugerir menos do que o
-- mínimo de segurança exige.
UPDATE products
SET max_stock = min_stock,
    updated_at = NOW()
WHERE max_stock < min_stock;

ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_max_stock_gte_min_stock;
ALTER TABLE products
  ADD CONSTRAINT chk_products_max_stock_gte_min_stock CHECK (max_stock >= min_stock);

-- =====================================================================
-- 4. reconcile_product_on_delete — exigir NF na entrada restaurada
-- =====================================================================
-- CONTEXT.md (glossário, "Custo Cadastrado"): "Custo Cadastrado atualiza
-- somente via Entrada com nota fiscal + valor unitário [...] entradas
-- informais deliberadamente não mexem no custo nem no Histórico de Preços."
--
-- A função (definida em schema.sql:283-325 e redefinida em
-- migration_integridade_historico.sql:126-168), usada para reconciliar o
-- produto quando uma movimentação é excluída, escolhia a Entrada anterior
-- para restaurar cost_price filtrando só por `unit_value IS NOT NULL`, sem
-- exigir nota fiscal. Isso permitia restaurar um preço vindo de uma Entrada
-- informal — que nunca deveria ter tocado cost_price nem gerado uma linha
-- em price_history, contrariando a regra do glossário. Adiciona
-- `AND invoice_number IS NOT NULL` à busca da entrada anterior.
--
-- Preserva o `COALESCE(prev_cost, cost_price)` já corrigido em
-- migration_integridade_historico.sql (item d daquele arquivo) — NÃO regride
-- para `SET cost_price = prev_cost`, que zerava o custo quando não havia
-- entrada anterior.
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
    -- Cadastrado (ver comentário acima). Sem o AND invoice_number IS NOT
    -- NULL, esta função podia restaurar o custo a partir de uma entrada sem
    -- nota fiscal.
    SELECT unit_value INTO prev_cost
    FROM movements
    WHERE product_id = OLD.product_id
      AND type = 'IN'
      AND unit_value IS NOT NULL
      AND invoice_number IS NOT NULL
      AND id != OLD.id
    ORDER BY created_at DESC
    LIMIT 1;

    UPDATE products
    SET cost_price = COALESCE(prev_cost, cost_price),
        updated_at = NOW()
    WHERE id = OLD.product_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 5. categories: índice único case-insensitive (com consolidação prévia)
-- =====================================================================
-- `categories.name` é UNIQUE case-sensitive (schema.sql:41), ao contrário
-- de `departments`/`roles`, que já têm índice case-insensitive
-- (migration_colaboradores_csv.sql:24-28). Um CSV de produtos com "EPIs" e
-- "epis" cria duas categorias distintas — uma delas órfã — e quebra o
-- agrupamento por nome no dashboard.
--
-- Antes de criar o índice, consolida duplicatas pré-existentes: por grupo
-- normalizado (lower(trim(name))), mantém a categoria mais antiga (menor
-- created_at, empate por id) como canônica, reatribui os `products` das
-- demais para ela e remove as linhas de categoria redundantes. Nenhum
-- produto é perdido — só a linha de categoria duplicada deixa de existir,
-- e cada produto que apontava para ela passa a apontar para a canônica.
--
-- Optou-se por consolidar em vez de abortar a migração com erro porque,
-- aqui, a resolução é inequívoca (mesma classificação lógica, grafia
-- diferente) e não exige que um humano decida qual das duas manter antes de
-- aplicar o índice — ao contrário de, por exemplo, dois setores com nomes
-- parecidos mas potencialmente distintos.
DO $$
DECLARE
  v_group RECORD;
  v_canonical_id UUID;
  v_duplicate_id UUID;
BEGIN
  FOR v_group IN
    SELECT lower(trim(name)) AS norm_name
    FROM categories
    GROUP BY lower(trim(name))
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_canonical_id
    FROM categories
    WHERE lower(trim(name)) = v_group.norm_name
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    FOR v_duplicate_id IN
      SELECT id FROM categories
      WHERE lower(trim(name)) = v_group.norm_name
        AND id != v_canonical_id
    LOOP
      UPDATE products SET category_id = v_canonical_id WHERE category_id = v_duplicate_id;
      DELETE FROM categories WHERE id = v_duplicate_id;
    END LOOP;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_categories_name_ci
  ON categories (lower(trim(name)));

-- =====================================================================
-- 6. Registro em schema_migrations
-- =====================================================================
-- Convenção introduzida por migration_fase1_higiene.sql (ver supabase/README.md):
-- toda migration se registra ao final, para que o estado aplicado seja
-- verificável pelo banco e não apenas por comentário em prosa.
--
-- A tabela é criada aqui de forma idempotente, e não só na fase 1, para que a
-- ordem entre as duas migrations desta leva não importe: qual das duas rodar
-- primeiro cria a tabela, a outra apenas insere.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('migration_fase0_integridade.sql')
ON CONFLICT (filename) DO NOTHING;
