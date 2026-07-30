# Custo congelado no momento da Saída

Saídas passam a gravar o custo unitário vigente do produto na própria movimentação, no momento do registro. Relatórios de consumo em R$ (dashboard, gastos por setor) usam o custo gravado na movimentação, nunca o `cost_price` atual do produto — assim o histórico é imutável e não se reavalia quando o preço muda.

Saídas anteriores à mudança recebem backfill com o `cost_price` atual do produto: é o mesmo número que os relatórios já exibiam, então nada muda visualmente. É uma estimativa, e assumimos isso.

## Nota (2026-07-30): produto sem custo cadastrado e saídas permanentemente sem valor

O formulário de Produto não tem campo de custo. Um produto nasce sem `cost_price`, e só passa a ter um quando alguém lança uma Entrada com nota fiscal e valor unitário — é o único caminho que atualiza o custo cadastrado (ver `CONTEXT.md`, "Custo Cadastrado").

Enquanto isso não acontece, toda Saída daquele produto congela `unit_value = NULL` — o congelamento é no `INSERT` (trigger `freeze_exit_cost`, `BEFORE INSERT`), sem reavaliação posterior — e essa movimentação fica **permanentemente fora** das agregações de valor (`SUM(quantity * unit_value)` ignora a linha; ver `docs/superpowers/plans/2026-07-29-dashboard-home-plan.md`, §7, "Custo-zero nas saídas"). Não há mecanismo que volte e preencha esse valor depois: a saída já foi gravada com NULL.

**Não haverá backfill dessas saídas (decisão G2 do grilling de 2026-07-30, `docs/superpowers/plans/2026-07-30-backlog-correcoes-plan.md`).** O motivo não é falta de tempo: recarimbar uma saída antiga com o custo de hoje é exatamente o cenário que este ADR existe para impedir — o histórico é imutável por desenho, não se reavalia quando o preço muda. Fazer isso já causou dano real uma vez: `supabase/migration_custo_congelado_saida.sql` tentou um backfill desse tipo sem corte de data, distorceu preços passados (CLORO −58%, VASSOURÃO +182%), e `supabase/migration_corrige_custo_carimbado.sql` teve de existir só para desfazer o estrago. Reabrir essa porta para "consertar" as saídas com `unit_value NULL` seria repetir o erro. Isto não é uma pendência esquecida — é risco aceito e reafirmado (ver G1/G2 no plano acima).
