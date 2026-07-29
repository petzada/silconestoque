-- Silcon Ambiental - Migracao: Corrige custo carimbado em saidas historicas
-- REVERSIVEL (cria tabela de backup). Rodar no SQL Editor do Supabase.
--
-- =====================================================================
-- CONTEXTO E EVIDENCIA
-- =====================================================================
-- A query 7 de diagnostico_movimentacoes.sql mostrou que, para CADA produto,
-- o unit_value gravado nas saidas e CONSTANTE ao longo de todo o periodo,
-- enquanto o preco registrado em price_history mudou 2 ou 3 vezes no mesmo
-- intervalo. Exemplos reais medidos em 2026-07-29:
--
--   CLORO LIQUIDO 5L      unit_value 8,43 sempre  | vigente 19,90 -> 15,39 -> 12,77
--   LUVA DE RASPA         unit_value 23,50 sempre | vigente 15,90 -> 44,00
--   VASSOURAO NYLON 40MM  unit_value 71,90 sempre | vigente 25,49 -> 68,03 -> 20,78
--   CAFE EM PO A VACUO    unit_value 644,80 sempre| vigente 598,00 -> 746,07
--
-- Um custo congelado no momento da saida (ADR-0002) acompanharia as variacoes
-- de preco. Um valor identico de fevereiro a julho, atravessando tres mudancas
-- registradas, so pode ter sido carimbado de uma vez - pelo backfill de
-- migration_custo_congelado_saida.sql, que fazia
-- "SET unit_value = p.cost_price" (o preco ATUAL) em todas as saidas antigas.
--
-- Consequencia: o consumo em R$ dos meses passados esta avaliado a um preco
-- unico em vez do preco real da epoca. Os desvios sao grandes: CLORO a 8,43
-- quando custava 19,90 (subavaliado 58%), VASSOURAO a 71,90 quando custava
-- 25,49 (superavaliado 182%).
--
-- =====================================================================
-- FONTE DA VERDADE
-- =====================================================================
-- price_history so recebe registro quando uma Entrada tem nota fiscal +
-- valor unitario (trigger handle_price_change). Conforme CONTEXT.md, a NF e
-- a garantia de valor oficial - portanto price_history E o registro
-- autoritativo de preco. Esta migracao reescreve o unit_value das saidas
-- divergentes para o preco vigente na data, apurado em price_history.
--
-- =====================================================================
-- LIMITE ASSUMIDO
-- =====================================================================
-- products.cost_price tambem muda em reconcile_product_on_delete (ao excluir
-- uma Entrada) SEM gerar registro em price_history. Entao existe um caso raro
-- em que o unit_value divergente estava correto e o price_history e que nao
-- reflete a reversao. Nao ha como distinguir esse caso retroativamente. Por
-- isso esta migracao e REVERSIVEL: o valor anterior de cada linha alterada
-- fica guardado na tabela de backup criada no passo 1.
--
-- Saidas SEM nenhum price_history anterior a data nao sao tocadas (o JOIN
-- LATERAL abaixo e INNER): sem fonte oficial de preco, o valor atual e
-- mantido como esta.

-- =====================================================================
-- PASSO 0 - PREVIEW (rodar sozinho ANTES de aplicar o resto)
-- =====================================================================
-- Mostra o impacto agregado por produto sem alterar nada. Confira se o
-- numero de linhas e a variacao de total batem com o esperado.
--
-- select
--   p.name as produto,
--   count(*) as saidas_afetadas,
--   min(m.unit_value) as valor_carimbado,
--   sum(m.quantity * m.unit_value) as total_hoje,
--   sum(m.quantity * hist.preco_vigente_na_data) as total_corrigido
-- from movements m
-- join products p on p.id = m.product_id
-- join lateral (
--   select ph.new_price as preco_vigente_na_data
--   from price_history ph
--   where ph.product_id = m.product_id
--     and ph.created_at <= m.created_at
--   order by ph.created_at desc
--   limit 1
-- ) hist on true
-- where m.type = 'OUT'
--   and m.unit_value is not null
--   and m.unit_value is distinct from hist.preco_vigente_na_data
-- group by p.name
-- order by p.name;

-- =====================================================================
-- PASSO 1 - Backup das linhas que serao alteradas
-- =====================================================================
-- Guarda o unit_value anterior de cada saida antes de reescrever. Sem este
-- passo a operacao seria irreversivel. A tabela e criada uma unica vez; se
-- ja existir, a migracao NAO sobrescreve o backup original (o primeiro
-- backup e o que representa o estado pre-correcao).
CREATE TABLE IF NOT EXISTS movements_unit_value_backup_20260729 (
  movement_id UUID PRIMARY KEY,
  unit_value_anterior DECIMAL(10, 2),
  unit_value_corrigido DECIMAL(10, 2),
  backup_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO movements_unit_value_backup_20260729 (movement_id, unit_value_anterior, unit_value_corrigido)
SELECT
  m.id,
  m.unit_value,
  hist.preco_vigente_na_data
FROM movements m
JOIN LATERAL (
  SELECT ph.new_price AS preco_vigente_na_data
  FROM price_history ph
  WHERE ph.product_id = m.product_id
    AND ph.created_at <= m.created_at
  ORDER BY ph.created_at DESC
  LIMIT 1
) hist ON true
WHERE m.type = 'OUT'
  AND m.unit_value IS NOT NULL
  AND m.unit_value IS DISTINCT FROM hist.preco_vigente_na_data
ON CONFLICT (movement_id) DO NOTHING;

-- =====================================================================
-- PASSO 2 - Reescreve o unit_value para o preco vigente na data da saida
-- =====================================================================
UPDATE movements m
SET unit_value = hist.preco_vigente_na_data
FROM (
  SELECT
    m2.id AS movement_id,
    (
      SELECT ph.new_price
      FROM price_history ph
      WHERE ph.product_id = m2.product_id
        AND ph.created_at <= m2.created_at
      ORDER BY ph.created_at DESC
      LIMIT 1
    ) AS preco_vigente_na_data
  FROM movements m2
  WHERE m2.type = 'OUT'
    AND m2.unit_value IS NOT NULL
) hist
WHERE m.id = hist.movement_id
  AND hist.preco_vigente_na_data IS NOT NULL
  AND m.unit_value IS DISTINCT FROM hist.preco_vigente_na_data;

-- =====================================================================
-- PASSO 3 - Conferencia pos-correcao
-- =====================================================================
-- Esperado: a query 7 do diagnostico deve voltar VAZIA (nenhuma saida
-- divergente do preco vigente). Rode para confirmar:
--
-- select count(*) as linhas_alteradas from movements_unit_value_backup_20260729;
--
-- E depois a query 7 de diagnostico_movimentacoes.sql - deve retornar 0 linhas.

-- =====================================================================
-- ROLLBACK (se o resultado nao fizer sentido para o negocio)
-- =====================================================================
-- Restaura exatamente o estado anterior a esta migracao:
--
-- UPDATE movements m
-- SET unit_value = b.unit_value_anterior
-- FROM movements_unit_value_backup_20260729 b
-- WHERE m.id = b.movement_id;
--
-- A tabela de backup pode ser mantida indefinidamente (e pequena) ou
-- removida depois que a correcao for validada na aplicacao:
-- DROP TABLE movements_unit_value_backup_20260729;
