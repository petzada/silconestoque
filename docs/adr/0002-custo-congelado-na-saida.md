# Custo congelado no momento da Saída

Saídas passam a gravar o custo unitário vigente do produto na própria movimentação, no momento do registro. Relatórios de consumo em R$ (dashboard, gastos por setor) usam o custo gravado na movimentação, nunca o `cost_price` atual do produto — assim o histórico é imutável e não se reavalia quando o preço muda.

Saídas anteriores à mudança recebem backfill com o `cost_price` atual do produto: é o mesmo número que os relatórios já exibiam, então nada muda visualmente. É uma estimativa, e assumimos isso.
