-- Silcon Ambiental - Diagnostico: integridade historica de movimentacoes
-- Apenas leitura (nenhum UPDATE/DELETE). Rodar cada bloco no SQL Editor do
-- Supabase, um de cada vez, para investigar por que o dashboard nao mostra
-- valores de meses antigos.

-- =====================================================================
-- 1. Total de linhas em movements
-- =====================================================================
-- O client do PostgREST (usado pelo app) tem um teto padrao de 1000 linhas
-- por requisicao. Se a contagem abaixo passar de 1000, qualquer tela que
-- busque "todas as movimentacoes" sem paginacao/range explicito esta
-- silenciosamente cortando os registros mais antigos (ou mais novos,
-- dependendo da ordenacao), o que explica meses sumindo do dashboard.
select count(*) as total_movimentacoes
from movements;

-- =====================================================================
-- 2. Totais por mes e tipo desde 2026-01-01
-- =====================================================================
-- Resultado ruim: meses com "qtd_unit_value_nulo" alta (proxima de
-- "qtd_linhas") em type = 'OUT' indica saidas gravadas sem custo congelado
-- (unit_value NULL) - o dashboard soma isso como R$ 0,00 para o mes inteiro.
-- Tambem observe "soma_valor" caindo para 0 ou muito baixo em meses que
-- deveriam ter movimento normal.
select
  date_trunc('month', created_at) as mes,
  type,
  count(*) as qtd_linhas,
  count(*) filter (where unit_value is null) as qtd_unit_value_nulo,
  sum(quantity * coalesce(unit_value, 0)) as soma_valor
from movements
where created_at >= '2026-01-01'
group by 1, 2
order by 1, 2;

-- =====================================================================
-- 3. Triggers existentes em movements
-- =====================================================================
-- Resultado ruim: a ausencia de "trigger_freeze_exit_cost" na lista abaixo.
-- Esse trigger (ADR-0002) e o responsavel por gravar unit_value nas saidas
-- no momento do INSERT. Sem ele, toda saida nova entra com unit_value NULL,
-- mesmo depois de qualquer backfill historico.
select tgname
from pg_trigger
where tgrelid = 'movements'::regclass
  and not tgisinternal;

-- =====================================================================
-- 4. Contagem de saidas com unit_value nulo
-- =====================================================================
-- Resultado ruim: qualquer numero maior que zero. Cada linha aqui e uma
-- saida que hoje conta como R$ 0,00 em relatorios de consumo, mesmo tendo
-- consumido estoque de fato.
select count(*) as saidas_sem_unit_value
from movements
where type = 'OUT'
  and unit_value is null;

-- =====================================================================
-- 5. Movimentacoes de importacao inicial (is_initial_import = true) por mes
-- =====================================================================
-- Estas linhas sao deliberadamente excluidas do dashboard (nao representam
-- consumo/entrada real, apenas a carga inicial de estoque). Um resultado
-- "ruim" aqui nao e um bug por si so - serve para confirmar que o volume
-- excluido bate com o esperado e nao esta mascarando meses inteiros que
-- deveriam aparecer normalmente.
select
  date_trunc('month', created_at) as mes,
  count(*) as qtd_importacao_inicial
from movements
where is_initial_import = true
group by 1
order by 1;

-- =====================================================================
-- 6. Regra ON DELETE da FK price_history.movement_id
-- =====================================================================
-- Resultado ruim: delete_rule = 'CASCADE'. Isso significa que excluir uma
-- movimentacao de entrada apaga junto o ponto correspondente em
-- price_history, destruindo permanentemente um dado do grafico de variacao
-- de precos. O esperado, apos a correcao (migration_integridade_historico.sql),
-- e delete_rule = 'SET NULL'.
select
  tc.constraint_name,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.constraint_schema
where tc.table_name = 'price_history'
  and tc.constraint_type = 'FOREIGN KEY';

-- =====================================================================
-- 7. Saidas cujo unit_value NAO bate com o preco vigente na data
-- =====================================================================
-- Contexto: a migration_custo_congelado_saida.sql original preencheu saidas
-- antigas com o products.cost_price ATUAL na epoca em que rodou, ou seja,
-- carimbou um preco de "hoje" em movimentacoes de meses anteriores. A
-- migration_integridade_historico.sql corrige apenas as linhas que ainda
-- estao com unit_value NULL - as que ja foram preenchidas de forma imprecisa
-- nao sao tocadas, justamente para NAO sobrescrever valores que possam estar
-- corretos.
--
-- Esta query NAO corrige nada: ela apenas MOSTRA a divergencia, para o
-- usuario decidir. Compara o unit_value gravado na saida com o preco que o
-- price_history diz que estava vigente naquela data.
--
-- Como ler o resultado:
--   - divergencia alta e sistematica (varias saidas do mesmo produto com o
--     mesmo unit_value, todas diferentes do preco da epoca) => provavel
--     carimbo do backfill antigo.
--   - divergencia pontual => pode ser legitima: o cost_price tambem muda ao
--     excluir uma entrada, e essa alteracao nao gera registro em
--     price_history. Por isso NAO existe forma 100% confiavel de distinguir
--     retroativamente um valor congelado corretamente de um carimbado pelo
--     backfill antigo - e por isso nada e reescrito automaticamente.
select
  m.id as movimentacao_id,
  p.name as produto,
  m.created_at as data_saida,
  m.quantity,
  m.unit_value as valor_gravado,
  hist.preco_vigente_na_data,
  (m.unit_value - hist.preco_vigente_na_data) as diferenca
from movements m
join products p on p.id = m.product_id
join lateral (
  select ph.new_price as preco_vigente_na_data
  from price_history ph
  where ph.product_id = m.product_id
    and ph.created_at <= m.created_at
  order by ph.created_at desc
  limit 1
) hist on true
where m.type = 'OUT'
  and m.unit_value is not null
  and m.unit_value is distinct from hist.preco_vigente_na_data
order by p.name, m.created_at;
