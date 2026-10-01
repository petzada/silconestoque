-- Silcon Ambiental - 0003: dias até o estoque mínimo
-- Aditiva e idempotente. Rodar no SQL Editor do Supabase.
--
-- O QUE FAZ: dashboard_operacao deixa de projetar dias até o saldo zerar.
-- cobertura_dias passa a ser (saldo - mínimo) / consumo médio diário dos
-- últimos 90 dias, só para produto ativo com saldo no mínimo ou acima
-- (e acima de zero). Zerado e crítico continuam na lista de urgência.
-- O KPI cobertura_abaixo_15_dias conta quantos desses chegam ao mínimo
-- em menos de 15 dias.
--
-- O QUE NÃO FAZ: não há DELETE nem UPDATE de dado. Só substitui a função.
--
-- IDEMPOTENTE: CREATE OR REPLACE FUNCTION.
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
      pf.min_stock,
      -- Dias até o saldo chegar ao mínimo, não até zerar. Só estáveis
      -- (saldo no mínimo ou acima, e acima de zero): quem já está crítico
      -- ou zerado fica na lista de urgência. Sem saída em 90 dias não há
      -- ritmo, então a projeção fica de fora.
      CASE
        WHEN COALESCE(c.qty_90d, 0) = 0 THEN NULL
        ELSE (pf.current_qty - pf.min_stock)::numeric / (c.qty_90d / 90.0)
      END AS cobertura_dias
    FROM produtos_filtrados pf
    LEFT JOIN consumo_90d c ON c.product_id = pf.id
    WHERE pf.current_qty >= pf.min_stock
      AND pf.current_qty > 0
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

-- Registro em schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('0003_dias_ate_o_minimo.sql')
ON CONFLICT (filename) DO NOTHING;
