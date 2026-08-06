-- Silcon Ambiental - Migração Fase 3: Fundação analítica
-- Ver docs/superpowers/plans/2026-07-29-dashboard-home-plan.md, secao 5.
-- Ver CONTEXT.md para as definições normativas de Zerado/Item Crítico/Estável,
-- Custo Cadastrado, Solicitante etc. usadas literalmente nas queries abaixo.
--
-- Escopo: só banco (schema + RPCs) + tipos TypeScript (lib/types.ts). Nenhuma
-- tela nova consome isto ainda — é a fundação que a Fase 4 (nova home) vai
-- consumir via .rpc(...).
--
-- Aditiva e idempotente: ALTER TABLE ... ADD COLUMN IF NOT EXISTS, CREATE
-- INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION, backfill que só toca
-- linhas com department_id ainda NULL. Segura para re-executar.
--
-- Rodar no SQL Editor do Supabase, na ordem em que aparece neste arquivo.
-- Pressupõe schema.sql (com Fase 0 e Fase 1 absorvidas) já aplicado.

-- =====================================================================
-- 1. movements.department_id — carimbo de setor na movimentação
-- =====================================================================
-- Problema (plano, D10): employees.department_id é escalar mutável, sem
-- histórico. Mover uma pessoa de setor hoje reescreve retroativamente todo o
-- consumo por setor de todos os meses anteriores, porque hoje "consumo por
-- setor" é calculado fazendo JOIN de movements -> employees -> department_id
-- ATUAL. A partir desta migration, o setor é gravado na própria linha de
-- movimentação, no momento em que ela é criada — igual ADR-0002 já faz para
-- o custo (freeze_exit_cost).
ALTER TABLE movements ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Linhas sem employee_id (solicitante avulso/nome livre — ver CONTEXT.md,
-- "Solicitante") ficam com department_id NULL. Todos os RPCs abaixo agrupam
-- department_id NULL como "Sem solicitante", nunca descartam a linha.

-- Trigger BEFORE INSERT: copia employees.department_id para a movimentação
-- quando há employee_id e department_id ainda não foi informado.
--
-- ORDEM DE DISPARO: já existem, em movements, um BEFORE INSERT
-- (trigger_freeze_exit_cost, schema.sql) e dois AFTER INSERT
-- (trigger_update_product_qty, trigger_handle_price_change). Múltiplos
-- triggers do MESMO evento (BEFORE INSERT) disparam em ordem alfabética do
-- NOME DO TRIGGER (não da função). "trigger_freeze_exit_cost" vem antes de
-- "trigger_stamp_movement_department" alfabeticamente ('f' < 's'), então
-- freeze_exit_cost roda primeiro. Isso é IRRELEVANTE para a correção deste
-- trigger: stamp_movement_department só lê NEW.employee_id (já veio do
-- INSERT, imutável) e NEW.department_id (só grava se ainda NULL); não lê nem
-- escreve unit_value/type, que é tudo que freeze_exit_cost toca. Os dois
-- triggers não têm dependência de dado entre si em nenhuma ordem — mas o
-- nome foi escolhido para não sugerir uma dependência que não existe (ex.:
-- não chamei de "trigger_after_freeze_exit_cost" ou qualquer nome que
-- insinuasse ordem relativa ao outro trigger).
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

-- Backfill (decisão travada no grilling, D10): department_id = setor ATUAL
-- do colaborador, para toda linha existente com employee_id. Isso CONGELA a
-- distorção já existente (se alguém mudou de setor no passado, as
-- movimentações antigas dele passam a carregar o setor de hoje, não o de
-- quando ela ocorreu) em vez de deixar o cálculo ao vivo perpetuar o mesmo
-- erro para sempre. A partir desta migration em diante, todo INSERT novo
-- grava o setor correto no momento do fato, via o trigger acima.
--
-- ASSUNÇÃO REGISTRADA: números históricos de consumo por setor, para
-- movimentações anteriores a esta migration, são APROXIMADOS (setor de hoje,
-- não o setor de quando a saída ocorreu). A partir desta migration, são
-- fiéis. Idempotente: só toca linhas com department_id ainda NULL, então
-- rodar de novo não sobrescreve nada já carimbado por engano.
UPDATE movements m
SET department_id = e.department_id
FROM employees e
WHERE m.employee_id = e.id
  AND m.department_id IS NULL;

-- Índices (plano, secao 5.1 e "correções que vêm junto"):
-- (department_id, created_at) — toda query de consumo por setor com filtro
-- de período faz WHERE department_id = ... AND created_at BETWEEN ...
CREATE INDEX IF NOT EXISTS idx_movements_department_created
  ON movements(department_id, created_at);

-- (product_id, created_at) — inexistente até aqui; é a forma de toda query
-- de replay do ledger de um produto (ex.: cobertura em dias, série de
-- consumo por produto). idx_movements_created (só created_at) já existe mas
-- sozinho não atende filtro composto por produto + período.
CREATE INDEX IF NOT EXISTS idx_movements_product_created
  ON movements(product_id, created_at);

-- =====================================================================
-- 2. Remoção da view morta dashboard_stats
-- =====================================================================
-- schema.sql definia `dashboard_stats`, view morta que nenhum código lê.
-- Ela conta produtos INATIVOS (sem filtro is_active) e diverge tanto das
-- telas quanto das definições normativas de CONTEXT.md — combinação que, se
-- alguém a adotasse por engano, produziria números diferentes dos RPCs desta
-- migration. Substituída pelos RPCs abaixo (dashboard_operacao cobre
-- zerados/críticos/estáveis com a definição correta, sobre produtos ativos).
DROP VIEW IF EXISTS dashboard_stats;

-- =====================================================================
-- 3. RPCs — SECURITY INVOKER, STABLE, GRANT EXECUTE TO authenticated
-- =====================================================================
-- Convenção adotada nesta migration (nenhuma pré-existe no repo — D11 do
-- plano, "zero .rpc() hoje"):
--   - Parâmetros sempre com prefixo p_.
--   - Funções que devolvem exatamente UMA "foto"/linha agregada com campos
--     heterogêneos (contagens + arrays aninhados) devolvem JSONB
--     (dashboard_operacao) — formato documentado no comentário da função.
--   - Funções que devolvem N linhas homogêneas (série temporal, ranking por
--     dimensão, lista de insights, ou uma única linha de KPIs lado a lado)
--     devolvem TABLE(...), para o cliente consumir como array de objetos
--     tipados sem parsear JSON manualmente.
--
-- DECISÃO DE MODELAGEM (aplica-se a 3.2/3.3/3.4/3.5 abaixo): nenhuma delas
-- filtra os JOINs com `products` por `is_active`. Consumo/Compras/série/
-- dimensão/destaques são agregados sobre MOVIMENTAÇÕES HISTÓRICAS; usar o
-- `is_active` ATUAL do produto para incluir/excluir uma movimentação passada
-- seria exatamente o mesmo defeito que a Parte 1 desta migration corrige
-- para setor: usar estado mutável de HOJE para reescrever agregados de
-- PERÍODOS PASSADOS. Se um produto foi descontinuado mês passado, o consumo
-- que ele gerou enquanto ativo continua sendo dinheiro gasto naquele mês.
-- A única exceção é onde a definição normativa exige explicitamente "sobre
-- produtos ativos" (zerado/crítico/estável em dashboard_operacao, valor
-- imobilizado em dashboard_analise_kpis, encalhe em dashboard_destaques) —
-- todas fotos do ESTADO ATUAL do catálogo, não de um período passado.

-- ---------------------------------------------------------------------
-- 3.1 dashboard_operacao(p_category_id) — foto instantânea, ignora período
-- ---------------------------------------------------------------------
-- Retorna JSONB com o formato exato:
-- {
--   "zerados": int,             -- current_qty = 0, produtos ativos
--   "criticos": int,            -- current_qty < min_stock AND > 0, ativos
--   "estaveis": int,            -- current_qty >= min_stock, ativos
--   "total_ativos": int,        -- COUNT(*) de produtos ativos no filtro
--   "cobertura_abaixo_15_dias": int,  -- produtos ativos com cobertura finita < 15 dias
--   "top_urgencia": [           -- até 10 itens: zerados primeiro, depois
--                               -- críticos por déficit relativo desc
--     {
--       "product_id": uuid, "product_name": text, "sku_code": text|null,
--       "current_qty": int, "min_stock": int,
--       "faixa": "zerado"|"critico",
--       "deficit_relativo": numeric|null  -- NULL para zerado (ver nota)
--     }, ...
--   ],
--   "cobertura_criticos": [     -- até 15 itens com cobertura finita, ASC
--                               -- (mais urgente primeiro); produto sem
--                               -- consumo nos últimos 90 dias (cobertura
--                               -- infinita) NUNCA aparece nesta lista
--     {
--       "product_id": uuid, "product_name": text, "sku_code": text|null,
--       "current_qty": int, "cobertura_dias": numeric|null
--     }, ...
--   ],
--   "pedidos_atraso": [         -- TODOS os PO em atraso, sem limite (não
--                               -- filtra por categoria — ver nota abaixo)
--     {
--       "po_id": uuid, "po_number": text, "supplier_name": text,
--       "estimated_delivery": date, "dias_atraso": int
--     }, ...
--   ]
-- }
--
-- NOTAS:
-- - "cobertura_dias" NULL = cobertura infinita (produto sem nenhuma saída
--   nos últimos 90 dias corridos, a partir de NOW() — janela contínua sobre
--   TIMESTAMPTZ, não precisa bucketizar em fuso: NOW() - INTERVAL '90 days'
--   é aritmética absoluta, sem ambiguidade de fuso horário).
-- - "top_urgencia"/"cobertura_criticos" são limitados (10 e 15 respectiva-
--   mente) por serem "TOP" por definição no plano — limite documentado aqui
--   porque o enunciado não fixou um número.
-- - "pedidos_atraso" NÃO É filtrado por p_category_id: follow_up_purchase_
--   orders não tem FK para products/categories (pode conter item fora do
--   catálogo — CONTEXT.md, "Pedido de Compra"), então o filtro de categoria
--   simplesmente não se aplica a ele.
-- - "deficit_relativo" é NULL para faixa='zerado': a fórmula do plano
--   ((min_stock - current_qty)/min_stock) é a mesma para zerado e crítico,
--   mas zerado já vem sempre primeiro na ordenação por definição — o valor
--   não muda a posição dele na lista, então não foi calculado para não
--   sugerir que zerados são comparáveis entre si por déficit.
-- - AS TRÊS FAIXAS SÃO MUTUAMENTE EXCLUSIVAS, e por isso `estaveis` exige
--   `current_qty > 0`. Um produto com min_stock = 0 E current_qty = 0
--   satisfaria literalmente tanto "zerado" (qty = 0) quanto "estável"
--   (0 >= 0), e a soma passaria de total_ativos — o que quebraria o KPI
--   "% do catálogo em risco". CONTEXT.md chama Zerado de "uma faixa
--   própria", e faixa implica exclusividade: zerado tem precedência, por
--   ser o sinal mais urgente. Invariante garantida:
--   zerados + criticos + estaveis = total_ativos.
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
      -- As tres faixas sao MUTUAMENTE EXCLUSIVAS: CONTEXT.md define Zerado
      -- como "uma faixa propria", e faixa implica exclusividade. Sem o
      -- `current_qty > 0` em estaveis, um produto com min_stock = 0 e
      -- current_qty = 0 contaria em zerados E em estaveis, fazendo
      -- zerados + criticos + estaveis > total_ativos — o que quebra o KPI
      -- "% do catalogo em risco" da aba Operacao.
      COUNT(*) FILTER (WHERE current_qty = 0) AS zerados,
      COUNT(*) FILTER (WHERE current_qty < min_stock AND current_qty > 0) AS criticos,
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

-- ---------------------------------------------------------------------
-- 3.2 dashboard_analise_kpis(p_from, p_to, p_category_id, p_department_id)
-- ---------------------------------------------------------------------
-- Retorna TABLE de UMA linha só: valor do período e valor do período
-- anterior equivalente (mesma duração, imediatamente antes de p_from), lado
-- a lado, para o delta ser calculado no cliente sem segunda chamada.
--
-- Bucketização de dia sempre via (created_at AT TIME ZONE
-- 'America/Sao_Paulo')::date — nunca no fuso da sessão/navegador (o defeito
-- que este RPC substitui: dashboard/page.tsx hoje usa
-- `new Date(m.created_at).getMonth()` no fuso do browser contra uma coluna
-- TIMESTAMPTZ).
--
-- DECISÃO — p_department_id aplica-se de forma UNIFORME a todas as
-- movimentações filtradas (IN e OUT), não só ao consumo. Consequência
-- assumida e documentada: como movements.department_id só é preenchido para
-- linhas com employee_id (que só existe em Saídas — ver migration_fase2_
-- solicitante.sql), filtrar por um setor específico faz `compras_atual` e
-- `compras_anterior` sempre retornarem 0 quando p_department_id não é NULL
-- (Entradas nunca têm setor). Isso é intencional e seguro (não é bug): D6 do
-- plano já registra que "Consumo é o único que fatia por setor" — a Fase 4
-- (UI) decide como comunicar isso (ex.: ocultar/desabilitar Compras quando
-- o filtro de setor está ativo). Optei por um filtro uniforme e literal em
-- vez de uma exceção implícita por métrica, para o comportamento do RPC ser
-- previsível a partir da assinatura, sem regra escondida por campo.
--
-- "número de movimentações" NÃO exclui is_initial_import (ao contrário de
-- consumo/compras, cuja definição normativa exclui explicitamente). É
-- contagem bruta de atividade no período — decisão de modelagem, não uma
-- omissão: a Importação Inicial é uma movimentação real que aconteceu,
-- mesmo não sendo compra nem consumo.
--
-- "valor_imobilizado" é SNAPSHOT do catálogo ativo agora (Σ current_qty *
-- cost_price), filtrado por p_category_id mas NUNCA por p_from/p_to/
-- p_department_id (não tem "período anterior" — não existe snapshot
-- histórico de saldo, D7 do plano). Devolvido como está, sem par de
-- comparação, conforme pedido.
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
    -- NULL, não 0, quando há filtro de setor: Entradas nunca carregam
    -- department_id (só Saídas têm employee_id), então "compras deste setor"
    -- é uma pergunta que não existe, não uma compra de valor zero. Zero diria
    -- "não compramos nada no periodo", que é falso e vira KPI mentiroso em
    -- destaque. NULL deixa a Fase 4 renderizar "—" e explicar o recorte.
    CASE WHEN p_department_id IS NULL THEN atual.compras END,
    CASE WHEN p_department_id IS NULL THEN anterior.compras END,
    atual.movs,
    anterior.movs,
    imobilizado.valor
  FROM atual, anterior, imobilizado;
$$;

GRANT EXECUTE ON FUNCTION dashboard_analise_kpis(DATE, DATE, UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION dashboard_analise_kpis(DATE, DATE, UUID, UUID) FROM anon;

-- ---------------------------------------------------------------------
-- 3.3 dashboard_serie(p_from, p_to, p_category_id, p_department_id)
-- ---------------------------------------------------------------------
-- Buckets DIÁRIOS de consumo e compras R$, um por dia entre p_from e p_to
-- inclusive, via generate_series — dia sem movimento vem com 0, não some
-- (senão o gráfico mente sobre densidade, conforme o plano exige).
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

-- ---------------------------------------------------------------------
-- 3.4 dashboard_dimensao(p_from, p_to, p_dim, p_category_id, p_department_id, p_limit)
-- ---------------------------------------------------------------------
-- Consumo R$ (só OUT, exclui is_initial_import — a Consumo (R$) normativa;
-- esta função nunca soma Compras) agrupado por 'categoria' | 'setor' |
-- 'produto', com o valor do período anterior equivalente lado a lado,
-- ordenado desc pelo valor do período atual, limitado a p_limit.
-- 'setor' NULL (sem employee_id na movimentação) agrupa como
-- 'Sem solicitante', com dim_id NULL.
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

-- ---------------------------------------------------------------------
-- 3.5 dashboard_destaques(p_from, p_to, p_category_id, p_department_id)
-- ---------------------------------------------------------------------
-- Retorna TABLE(tipo TEXT, texto TEXT, valor NUMERIC), 0 a 4 linhas — uma
-- por tipo de insight, na ORDEM FIXA abaixo (a "relevância" é a prioridade
-- de tipo definida no plano, não um ranking cruzado entre métricas: %,
-- R$ e contagem de produtos não são comparáveis numa escala só, então
-- ordenar por "valor" misturado seria arbitrário e não determinístico no
-- sentido exigido por D8).
--
--  1. maior_alta_custo    — maior alta percentual de custo no período (via
--                           price_history). Omitido se não houve nenhuma
--                           alta de preço com old_price > 0 no período.
--                           NÃO filtra por p_department_id (variação de
--                           preço não tem dimensão de setor).
--  2. setor_acima_media   — setor cujo consumo no período ficou mais acima
--                           da própria média diária dos 3 meses anteriores
--                           a p_from, escalada para o número de dias do
--                           período. Omitido se nenhum setor com baseline
--                           > 0 teve consumo acima da própria média.
--  3. categoria_maior_share — categoria com maior fatia (%) do consumo total
--                           do período. Omitido se não houve consumo no
--                           período (evita divisão por zero/insight vazio).
--  4. encalhe             — SEMPRE presente (mesmo com valor 0): contagem de
--                           produtos ATIVOS (respeitando p_category_id; NÃO
--                           filtra por p_department_id — produto não tem
--                           dimensão de setor) sem nenhuma movimentação nos
--                           90 dias anteriores a p_to. Usa p_to como
--                           referência de "hoje" (não NOW()), para o insight
--                           ser reproduzível para qualquer período histórico
--                           passado a este RPC — diferente de
--                           dashboard_operacao, que é foto instantânea de
--                           verdade e usa NOW().
--
-- "valor" é sempre a mesma unidade do texto (percentual em pontos — ex.
-- 42.3 para "42,3%" — para 1/2/3; contagem inteira para 4), para a UI
-- formatar sem reparsear a string.
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
      SUM(m.quantity * m.unit_value) / 90.0 AS consumo_medio_dia -- ~3 meses, aproximação em dias corridos
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

-- =====================================================================
-- 4. Registro em schema_migrations
-- =====================================================================
-- Convenção introduzida por migration_fase1_higiene.sql (ver
-- supabase/README.md): toda migration se registra ao final. Tabela criada
-- aqui de forma idempotente (mesmo padrão de migration_fase0_
-- integridade.sql secao 6), para não depender de qual migration desta leva
-- roda primeiro.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('migration_fase3_analitico.sql')
ON CONFLICT (filename) DO NOTHING;
