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
