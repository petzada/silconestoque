-- Silcon Ambiental - 0001: desfaz a variação de preço ao excluir a Entrada
-- Aditiva e idempotente. Rodar no SQL Editor do Supabase.
--
-- O QUE FAZ:
--   1) reconcile_product_on_delete passa a apagar a linha de price_history
--      ligada à Entrada excluída, na mesma transação em que o saldo e o
--      cost_price já são restaurados.
--   2) Apaga as variações já órfãs (movement_id IS NULL), deixadas pelas
--      exclusões anteriores por causa do ON DELETE SET NULL.
--
-- POR QUE: handle_price_change grava price_history quando uma Entrada com
-- nota fiscal muda o preço. A FK price_history.movement_id é ON DELETE SET
-- NULL (migration_integridade_historico.sql): excluir a movimentação só
-- solta o vínculo, e a variação permanece na tela mesmo depois de o custo
-- cadastrado voltar ao preço anterior. Excluir é o jeito de desfazer um
-- lançamento com valor errado — a variação desse lançamento também tem de
-- sair.
--
-- A FK continua SET NULL. O DELETE é explícito no trigger, ao lado da
-- restauração do custo. migration_fase0_integridade.sql redefine a mesma
-- função com este DELETE: a ordem entre os dois arquivos não regride a
-- correção.
--
-- IDEMPOTENTE: CREATE OR REPLACE FUNCTION e o DELETE das órfãs. Na segunda
-- execução o DELETE não encontra linha (exclusões novas já apagam a
-- variação no trigger).
--
-- A recusa de saldo negativo foi acrescentada na função depois da primeira
-- aplicação deste arquivo. Banco que já rodou a versão anterior precisa de
-- 0002_integridade_saldos_e_painel.sql. Reaplicar este arquivo também
-- atualiza a função (CREATE OR REPLACE) e o DELETE das órfãs não acha linha
-- nova; mesmo assim, 0002 é o caminho para quem já registrou este nome em
-- schema_migrations.
--
-- NÃO É REVERSÍVEL: as linhas com movement_id IS NULL são apagadas de vez.
-- São exatamente as variações cuja movimentação já não existe. Variação
-- cuja movimentação ainda existe não é tocada.
--
-- Para ver o que o passo 2 vai apagar, rode só isto antes do arquivo:
--   SELECT id, product_id, old_price, new_price, invoice_number, created_at
--   FROM price_history
--   WHERE movement_id IS NULL
--   ORDER BY created_at;

-- =====================================================================
-- 1. Excluir a Entrada desfaz a variação que ela gerou
-- =====================================================================
CREATE OR REPLACE FUNCTION reconcile_product_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  prev_cost DECIMAL(10, 2);
  new_qty INTEGER;
BEGIN
  SELECT COALESCE(
           SUM(
             CASE
               WHEN m.type = 'IN' THEN m.quantity
               ELSE -m.quantity
             END
           ),
           0
         )::integer
    INTO new_qty
  FROM movements m
  WHERE m.product_id = OLD.product_id
    AND m.id != OLD.id;

  -- Entrada já consumida: apagá-la deixaria saldo negativo, estado que as
  -- faixas Zerado / Crítico / Estável não fecham. A saída que consumiu o
  -- saldo continua no histórico e precisa ser desfeita antes.
  IF OLD.type = 'IN' AND new_qty < 0 THEN
    RAISE EXCEPTION 'Não é possível excluir esta entrada: o saldo ficaria negativo. Exclua antes as saídas que consumiram esse estoque.';
  END IF;

  UPDATE products
  SET current_qty = new_qty,
      updated_at = NOW()
  WHERE id = OLD.product_id;

  IF OLD.type = 'IN' THEN
    -- A variação nasce desta entrada (handle_price_change). Excluir o
    -- lançamento desfaz a variação; a FK é SET NULL e, sem este DELETE, a
    -- linha continuaria na tela de Variação de Preço com um preço que o
    -- custo cadastrado já não tem.
    DELETE FROM price_history
    WHERE movement_id = OLD.id;

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

-- =====================================================================
-- 2. Limpa variações já órfãs (movimentação excluída antes desta correção)
-- =====================================================================
DELETE FROM price_history
WHERE movement_id IS NULL;

-- =====================================================================
-- Registro em schema_migrations
-- =====================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('0001_desfaz_variacao_preco_entrada.sql')
ON CONFLICT (filename) DO NOTHING;
