-- Silcon Ambiental - 0002: saldo, desativação e painel
-- Aditiva e idempotente. Rodar no SQL Editor do Supabase.
--
-- O QUE FAZ:
--   1) Excluir uma Entrada cujo saldo restante ficaria negativo é recusado.
--      A movimentação não é apagada. Saídas e o custo congelado nelas não
--      são reescritos.
--   2) Desativar produto com saldo diferente de zero é recusado. Nenhuma
--      baixa automática é criada.
--   3) dashboard_operacao conta saldo negativo já existente como Crítico,
--      para as três faixas fecharem no total de ativos.
--   4) dashboard_destaques: encalhe passa a ser produto ativo com saldo e
--      sem movimento há mais de 90 dias. Com filtro de setor o destaque
--      não é emitido.
--
-- O QUE NÃO FAZ: este arquivo não executa DELETE nem UPDATE em dados
-- existentes. Nenhuma movimentação, variação, custo de saída, custo
-- cadastrado ou recebimento é apagado ou reescrito ao aplicá-lo.
-- No futuro, ao excluir uma Entrada permitida, o trigger continua (como
-- na 0001) restaurando cost_price e apagando só a variação daquela
-- movimentação. unit_value das saídas não é alterado.
--
-- IDEMPOTENTE: CREATE OR REPLACE FUNCTION e DROP TRIGGER IF EXISTS.

-- 1. Recusa saldo negativo ao excluir Entrada. Mantém o DELETE de price_history daquela movimentação (0001).
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

DROP TRIGGER IF EXISTS trigger_reverse_movement ON movements;
CREATE TRIGGER trigger_reverse_movement
  BEFORE DELETE ON movements
  FOR EACH ROW
  EXECUTE FUNCTION reconcile_product_on_delete();

-- 2. Recusa desativar produto com saldo.
CREATE OR REPLACE FUNCTION prevent_product_deactivate_with_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_active AND NOT NEW.is_active AND OLD.current_qty <> 0 THEN
    RAISE EXCEPTION 'Não é possível desativar um produto com saldo. Ajuste o estoque até zero com uma movimentação antes.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_deactivate_with_stock ON products;
CREATE TRIGGER trigger_prevent_deactivate_with_stock
  BEFORE UPDATE OF is_active ON products
  FOR EACH ROW
  EXECUTE FUNCTION prevent_product_deactivate_with_stock();

-- 3. Faixas do dashboard de operação
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
      -- Saldo negativo (dado antigo: entrada apagada depois de consumida)
      -- conta como Crítico. A exclusão nova é recusada em
      -- reconcile_product_on_delete. Sem este `<> 0`, o saldo negativo
      -- ficava fora das três faixas e zerados + criticos + estaveis < total.
      COUNT(*) FILTER (WHERE current_qty <> 0 AND current_qty < min_stock) AS criticos,
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
    WHERE pf.current_qty = 0 OR (pf.current_qty <> 0 AND pf.current_qty < pf.min_stock)
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

-- 4. Encalhe
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

  -- 4. Encalhe: saldo parado no catálogo. Com filtro de setor o destaque
  -- some: entrada não tem setor, e "este setor não mexeu no produto"
  -- contaria quase o catálogo inteiro. Saldo zero também não entra —
  -- não há material parado.
  IF p_department_id IS NULL THEN
    RETURN QUERY
    SELECT
      'encalhe'::text,
      format('%s produto(s) ativo(s) com saldo parado há mais de 90 dias', COUNT(*)),
      COUNT(*)::numeric
    FROM products p
    WHERE p.is_active = true
      AND p.current_qty > 0
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND NOT EXISTS (
        SELECT 1 FROM movements m
        WHERE m.product_id = p.id
          AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date > (p_to - 90)
          AND (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_to
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION dashboard_destaques(DATE, DATE, UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION dashboard_destaques(DATE, DATE, UUID, UUID) FROM anon;

-- Registro em schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('0002_integridade_saldos_e_painel.sql')
ON CONFLICT (filename) DO NOTHING;
