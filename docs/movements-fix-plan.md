# Plano de Correcao: Movimentacoes + Filtros de Data/Setor

## Objetivo
Corrigir o sumico de entradas na tela de Movimentacoes e adicionar filtros de mes/ano/setor sem quebrar o fluxo de negocio existente.

## Causa Raiz Confirmada
1. A tela de Movimentacoes aplicava `.limit(100)` na consulta e filtrava apenas em memoria.
2. O Dashboard consulta o historico completo de movimentacoes, por isso continuava refletindo dados fora dos 100 mais recentes.
3. `Sincronizar Agora` (Configuracoes) recalcula saldo/custo em `products` e nao remove registros de `movements`.
4. A rotina de variacao de preco atua em `price_history` + `products.cost_price` e nao remove registros de `movements`.
5. A exclusao de movimentacao revertia estoque em duplicidade (frontend + trigger SQL).

## Implementacao Aplicada

### 1) Historico completo em Movimentacoes
- Arquivo: `app/(dashboard)/movements/page.tsx`
- Acao: removido o limite silencioso de 100 registros.
- Resultado: listagem passa a usar o historico completo ordenado por `created_at DESC`.

### 2) Exclusao sem reversao duplicada
- Arquivo: `app/(dashboard)/movements/page.tsx`
- Acao: removida a reversao manual de estoque no frontend ao excluir movimentacao.
- Resultado: a reversao fica centralizada no trigger SQL `reverse_movement_on_delete`.

### 3) Novos filtros em Movimentacoes
- Arquivo: `app/(dashboard)/movements/page.tsx`
- Adicionados:
  - Filtro por mes (`all` + janeiro..dezembro)
  - Filtro por ano (`all` + anos dinamicos presentes nas movimentacoes)
  - Filtro por setor (`all` + setores do banco)
- Mantidos:
  - Busca por produto/fornecedor/NF
  - Filtro por tipo (`all`, `IN`, `OUT`)
- Regras:
  - Composicao unica de filtros (AND): texto + tipo + mes + ano + setor.
  - Estado inicial dos novos filtros: `all`.
  - `is_initial_import = true` permanece visivel por padrao na tela.

### 4) Empty state da tabela
- Arquivo: `app/(dashboard)/movements/page.tsx`
- Acao: adicionada mensagem explicita quando nenhum registro corresponder aos filtros.

### 5) Tipagem de filtros
- Arquivo: `lib/types.ts`
- Adicionado tipo:
  - `MovementFilters` com `searchTerm`, `type`, `month`, `year`, `sectorId`.

## Sem Alteracoes Deliberadas
1. Logica do Dashboard (KPIs continuam ignorando `is_initial_import`).
2. Funcoes SQL de variacao de preco e schema do Supabase.

## Adendo Pos-Auditoria (2026-02-19)
- O botao `Sincronizar Agora` foi removido da tela de configuracoes.
- Motivo: o recalculo manual sobrescrevia `products.current_qty` e `products.cost_price` fora do fluxo oficial de movimentacoes, com risco de inconsistencias em bases legadas.
- Regra vigente: ajuste de estoque/custo deve ocorrer somente por:
  - entrada (`movements.type = IN`)
  - saida (`movements.type = OUT`)
  - exclusao manual de movimentacao
  - exclusao completa do produto

## Cenarios de Aceite
1. Entradas antigas fora do top 100 aparecem em Movimentacoes.
2. Busca por produto/fornecedor/NF encontra itens antigos e recentes.
3. Filtro `ENTRADAS` mostra apenas `type = IN`.
4. Filtros combinados (tipo + mes + ano + setor) retornam intersecao correta.
5. Com filtros `all`, a lista mostra o historico completo.
6. Movimentacoes de importacao inicial aparecem por padrao.
7. Empty state aparece quando nao ha resultados apos filtros.
8. Exclusao de entrada/saida reverte estoque apenas uma vez.

## Validacao de Correlacao (Execucao em ambiente com Supabase configurado)

### A) Nao existe mais recalculo manual em Configuracoes
1. A tela `Configuracoes` nao deve exibir acao de sincronizacao/recalculo de estoque.
2. Esperado: qualquer alteracao de saldo/custo ocorre apenas por movimentacoes.

### B) Variacao de preco nao remove movimentacoes
1. Antes:
```sql
select count(*) as total_movements from movements;
select count(*) as total_price_history from price_history;
```
2. Registrar uma entrada com NF + valor unitario diferente do custo anterior.
3. Depois:
```sql
select count(*) as total_movements from movements;
select count(*) as total_price_history from price_history;
```
4. Esperado:
- `movements`: +1
- `price_history`: +1 quando houver mudanca real de preco.

## Observacao de Ambiente
As validacoes de banco em runtime dependem de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurados no ambiente local.

## Adendo: Meses Antigos Sumindo do Dashboard (2026-07-29)

### Sintoma
Registros de janeiro a abril existiam no banco, mas nao alimentavam KPIs nem
graficos do dashboard.

### Causa Raiz Confirmada
1. **Teto de 1000 linhas do PostgREST.** As consultas de historico nao usavam
   `range`. O Supabase corta a resposta em `max-rows` (1000 por padrao) sem
   sinalizar truncamento. Como as queries ordenam por `created_at DESC`, o corte
   descartava exatamente os meses mais antigos. Esta e a causa principal.
2. **Dashboard engolia erros de query.** `fetchData` usava `res.data || []` sem
   checar `.error`. O supabase-js nao lanca excecao em erro de API, entao
   timeout/RLS/join quebrado renderizavam um dashboard zerado e mudo.
3. **`trigger_freeze_exit_cost` ausente.** O bloco `DO $$` do
   `hotfix_fix_saida_duplicada.sql` dropava todos os triggers de `movements` e
   recriava apenas tres, esquecendo o de ADR-0002. Saidas passavam a gravar
   `unit_value = NULL` e o periodo fechava em R$ 0,00.
4. **`price_history` apagado em cascata.** A FK `price_history.movement_id` era
   `ON DELETE CASCADE`: excluir uma entrada destruia o ponto do grafico de
   variacao de precos.
5. **Exclusao de produto era fisica.** `handleDeleteProduct` apagava as
   `movements` e o `price_history` do produto, reescrevendo retroativamente
   meses ja fechados.
6. **`reconcile_product_on_delete` zerava o custo.** Sem entrada anterior,
   `prev_cost` era NULL e o produto ficava sem `cost_price`, fazendo toda saida
   futura congelar NULL.

### Implementacao Aplicada
- `lib/supabase.ts`: helper `fetchAllRows`, que pagina por `range` ate esgotar.
  Recebe uma **funcao** que reconstroi a query a cada pagina (os builders do
  PostgREST sao de uso unico).
- Paginacao aplicada em: dashboard, movimentacoes, variacao de precos, retiradas
  do colaborador e historico de precos do produto.
- Dashboard: checagem de `.error`, card de erro com "Tentar novamente",
  `availableYears` derivado dos dados reais e linha de transparencia sob os KPIs
  (total do periodo, quantos sem valor unitario, quantos de importacao inicial).
- `products`: exclusao passou a ser logica (`is_active = false`). Historico
  preservado.
- `supabase/migration_integridade_historico.sql`: restaura o trigger de custo
  congelado, troca a FK para `ON DELETE SET NULL`, faz backfill historicamente
  correto e preserva `cost_price` na exclusao de entrada.
- `supabase/diagnostico_movimentacoes.sql`: 7 queries somente leitura.

### Regra de Custo (reforcada)
O valor de uma saida e **congelado no momento do registro** e nunca reavaliado.
O backfill desta rodada reconstitui o preco vigente **na data da movimentacao**
a partir de `price_history`, e nao o `cost_price` atual — ao contrario do
backfill de `migration_custo_congelado_saida.sql`, que carimbava o preco de hoje
em movimentacoes antigas.

### Resultado do Diagnostico (2026-07-29)
A query 7 confirmou o carimbo do backfill antigo, de forma **sistematica**: para
cada produto o `unit_value` das saidas e constante ao longo de todo o periodo,
enquanto `price_history` registra 2 ou 3 mudancas de preco no mesmo intervalo.

| Produto | unit_value gravado | preco vigente (evolucao) |
| --- | --- | --- |
| CLORO LIQUIDO 5L | 8,43 sempre | 19,90 -> 15,39 -> 12,77 |
| LUVA DE RASPA | 23,50 sempre | 15,90 -> 44,00 |
| VASSOURAO DE NYLON 40MM | 71,90 sempre | 25,49 -> 68,03 -> 20,78 |
| CAFE EM PO A VACUO | 644,80 sempre | 598,00 -> 746,07 |
| PAPEL TOALHA 2D | 75,47 sempre | 55,30 -> 119,90 |

Um custo congelado no momento da saida acompanharia as variacoes. Valor
identico de fevereiro a julho atravessando tres mudancas so pode ter sido
carimbado de uma vez. Cerca de 40 produtos afetados, com desvios de ate 182%.

Correcao em `supabase/migration_corrige_custo_carimbado.sql`: reescreve o
`unit_value` das saidas divergentes para o preco vigente na data, apurado em
`price_history` (fonte autoritativa, alimentada so por Entrada com NF).

### Limite Conhecido (assumido)
`products.cost_price` tambem muda em `reconcile_product_on_delete` sem gerar
registro em `price_history`. Existe, portanto, um caso raro em que o
`unit_value` divergente estava correto e o `price_history` e que nao reflete a
reversao — indistinguivel retroativamente. Por isso a migracao corretiva e
**reversivel**: guarda o valor anterior de cada linha em
`movements_unit_value_backup_20260729`, com query de rollback documentada no
proprio arquivo. Saidas sem nenhum `price_history` anterior a data nao sao
tocadas.

### Sem Alteracoes Deliberadas
1. `created_at` continua sendo a data da entrada/saida — nenhuma coluna de data
   nova foi adicionada, por decisao do usuario.
2. O filtro de `is_initial_import` no dashboard permanece; apenas o efeito dele
   ficou visivel na linha de transparencia.
3. ADR-0002 (custo congelado) intacto: valores vem de `movements.unit_value`.
