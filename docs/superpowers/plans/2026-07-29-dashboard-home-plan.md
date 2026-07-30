# Plano — Nova Home do Dashboard + Correções de Integridade

**Data:** 2026-07-29
**Origem:** sessão de grilling sobre os fluxos ponta a ponta da plataforma (cadastros, registros, movimentações), com auditoria paralela de banco, cadastros, movimentações/financeiro e camada analítica.
**Status:** aguardando aprovação

---

## 1. Decisões travadas no grilling

| # | Decisão | Consequência |
|---|---|---|
| D1 | Home em **duas abas**: `Operação` e `Análise` | Cada aba com suas queries e filtros, carregadas sob demanda |
| D2 | **Visual-first**: gráficos, KPIs numéricos e insights curtos; sem blocos de prosa | Restringe o vocabulário de componentes |
| D3 | **Corrigir o que corrompe dado antes** de construir tela nova | Fases 0–2 bloqueiam a Fase 4 |
| D4 | Janela padrão: **mês corrente + delta vs. mesmo período do mês anterior** | Todo KPI da aba Análise carrega comparativo |
| D5 | Filtros **globais, na URL, persistidos** | Querystring é a fonte de verdade; último filtro lembrado |
| D6 | Dinheiro: **Consumo** (saídas a custo congelado) principal, **Compra** (entradas com NF) secundário | Consumo é o único que fatia por setor |
| D7 | Ruptura = **foto instantânea** (zerados/críticos) | Sem tabela de snapshot de saldo; "dias em ruptura" fica fora |
| D8 | Insights = **anotação no gráfico + faixa de 3–4 destaques determinísticos** | Regras em SQL/código, sem IA, auditáveis |
| D9 | Vestiário e Quiz **fora da home** | Seguem auditados, sem widget |
| D10 | Carimbar **`department_id` em `movements`**, backfill com o setor atual | Congela a distorção existente; futuro fica correto |
| D11 | Agregação em **RPCs no Postgres** | Padrão novo no repo (hoje há zero `.rpc()`) |
| D12 | Custo-zero nas saídas: **sem selo de cobertura** | Risco assumido — ver §7 |
| D13 | Home mostra **zerados e críticos**, não a fila de reposição como lista de trabalho | Evita prometer estado que o modelo não tem |
| D14 | Escopo de correção: **transacional + higiene SQL + F0**. Segurança/auth **fora** | Ver §7 |
| D15 | Tela nova implementada com a skill **`/design-taste-frontend`** | Primeira ação da Fase 4 |

---

## 2. Fase 0 — Correções que corrompem dado

Bloqueia todo o resto. Cada item tem arquivo, linha e critério de aceite.

### 0.1 Núcleo (escopo escolhido)

1. **Transferência de armário sem rollback** — `components/lockers/locker-sheet.tsx:196-223`
   Libera a ocupação atual e só depois tenta inserir a nova; se o insert falhar (índice `uniq_active_assignment_per_employee_kind`, colaborador desligado, armário inativo), o ocupante original perde o armário e ele fica vazio. O `catch` só refaz o fetch.
   → RPC `transfer_locker_assignment(p_assignment_id, p_locker_id, p_employee_id)` em transação única.
   *Aceite:* forçar a falha do insert (atribuir a alguém que já tem armário do tipo) deixa a ocupação original intacta.

2. **Desligamento de colaborador sem transação** — `app/(dashboard)/employees/page.tsx:271-298`
   Duas escritas: `is_active=false`, depois encerra ocupações. Falhando a segunda, o colaborador fica desligado segurando armário — e o armário não é liberável, porque ele sai de `activeEmployees` (`locker-utils.ts:78-81`).
   → RPC `deactivate_employee(p_employee_id)` transacional.
   *Aceite:* falha simulada na segunda escrita não deixa estado misto.

3. **Import de produtos conta insert falho como sucesso** — `app/(dashboard)/products/page.tsx:583-609`
   O insert da movimentação de saldo inicial (`:595-602`) descarta o resultado; `imported++` (`:605`) roda de qualquer forma.
   → Checar `error` de ambos os inserts; contabilizar falhas em `errors`; produto criado sem a movimentação de saldo é erro, não sucesso.
   *Aceite:* lote 100% rejeitado reporta `Importados: 0`.

4. **`unit_value` gravado com NF nula** — `app/(dashboard)/movements/page.tsx:262-263`
   `unit_value` é condicionado ao campo **sem trim**, `invoice_number` ao campo **com trim**. NF preenchida com espaços → grava preço com NF `NULL`; `handle_price_change` (`schema.sql:217`) não dispara, mas o dashboard soma o valor.
   → Normalizar uma vez antes de montar o payload; `shouldUnregister` ou reset explícito do campo de preço.
   *Aceite:* NF só com espaços grava `unit_value NULL`.

5. **`max_stock >= min_stock`** — `app/(dashboard)/products/page.tsx:90-91`
   Sem cross-check; default 0/0. Raiz das quantidades negativas em Sugestões de Compra (`purchase-orders/page.tsx:93-95`) e do "Repor p/ Max." negativo na Fila (`replenishment-queue/page.tsx:97`).
   → `superRefine` no zod **e** `CHECK (max_stock >= min_stock)` no banco.
   *Aceite:* nenhuma sugestão de compra pode emitir quantidade ou valor negativo.

6. **Tiebreaker `.order('id')` faltando em 3 queries paginadas**
   `price-variation/page.tsx:89-92`, `products/page.tsx:234-240`, `employees/page.tsx:318-325`. Ordenadas só por `created_at`; lançamentos no mesmo segundo podem ser perdidos ou duplicados entre janelas de `range()` — defeito já documentado como corrigido em `docs/movements-fix-plan.md:205-207`, mas não aplicado nestes três.

### 0.2 Adjacentes (recomendo incluir; corte se quiser enxugar)

7. **`handleSave` de produto ignora o erro e sempre toasta sucesso** — `products/page.tsx:324-330`
   Único cadastro do app com esse defeito; categorias, setores e colaboradores checam. Escrita rejeitada mostra toast verde.

8. **`cost_price` restaurado a partir de movimentação sem NF** — `reconcile_product_on_delete`, `schema.sql:306-321` / `migration_integridade_historico.sql:149-164`
   Escolhe a IN anterior só por `unit_value IS NOT NULL`, sem exigir NF — contraria CONTEXT.md:77 e não gera linha em `price_history`.
   → Adicionar `AND invoice_number IS NOT NULL`.

9. **Truncamento silencioso de 1000 linhas alimentando checagens de duplicidade**
   `employees/page.tsx:179`, `locker-utils.ts:70-82`, `products/page.tsx:190`, `replenishment-queue/page.tsx:61-62` usam query nua em vez de `fetchAllRows`. Acima do teto, o pré-check de duplicados fica cego e o lote all-or-nothing quebra inteiro.

10. **Decimal brasileiro truncado no import** — `products/page.tsx:399-400`
    `parseFloat('12,50') → 12`. Arquivo é `;`-delimitado (locale BR), então a perda é sistemática. `|| null` ainda transforma custo legítimo `0` em `null`.

11. **Import cria categorias duplicadas por caixa** — `products/page.tsx:565-575`
    `categories.name` é `UNIQUE` case-**sensitive** (`schema.sql:41`), sem índice CI — ao contrário de `departments` e `roles`. `EPIs` e `epis` coexistem e **quebram o agrupamento do dashboard**, que chaveia por nome.
    → Índice único em `lower(trim(name))` + dedupe normalizado no import.

---

## 3. Fase 1 — Higiene de SQL / migration

Hoje **não existe runner de migration**: nenhum diretório `supabase/migrations/`, nenhuma tabela `schema_migrations`, nomes sem ordem. O estado real do banco não é verificável pelo repositório — "aplicada" existe só em comentário de prosa.

1. **`schema.sql` regride correção de produção se re-rodado.** `:317-320` ainda tem `SET cost_price = prev_cost`, revertido para `COALESCE(prev_cost, cost_price)` em `migration_integridade_historico.sql:160-163`. `CREATE OR REPLACE FUNCTION` sobrescreve. Mesmo defeito em `hotfix_fix_saida_duplicada.sql:73`.
2. **`schema.sql:103`** ainda declara `price_history.movement_id ON DELETE CASCADE`; foi trocado para `SET NULL`. Instalação nova a partir do `schema.sql` nasce com o bug diagnosticado em `diagnostico_movimentacoes.sql:76-82`.
3. **`reverse_movement_on_delete()` (`schema.sql:240-280`)** — função morta, nunca anexada, contendo exatamente a lógica delta que causou o débito duplicado. Remover.
4. **`migration_custo_congelado_saida.sql:30-36`** — backfill repudiado que carimbou o preço de hoje em todo o passado (CLORO −58%, VASSOURÃO +182%, medido em `migration_corrige_custo_carimbado.sql:20-38`). Não tem corte de data e continua re-executável. Marcar como não-reexecutável.
5. **`migration_chapas_armarios.sql:33`** cria índice sobre `sector_id`, coluna já removida — o arquivo se declara idempotente (`:2`) e não é mais.
6. **`config` sem índice único** — `INSERT ... ON CONFLICT DO NOTHING` sem alvo (`schema.sql:123-125`); cada re-run acrescenta uma linha e o `.single()` do login passa a falhar.
7. **Adotar convenção real de migration**: `supabase/migrations/NNNN_nome.sql` + tabela de controle, e `schema.sql` passa a ser snapshot gerado, não script re-rodável à mão.

> Não incluído: remover a tabela morta `sectors` (`schema.sql:13-32`, sem FK de entrada e sem leitor). É destrutivo e não bloqueia nada — vira item opt-in.

---

## 4. Fase 2 — F0: mensagens de erro invisíveis

Supabase-js v2 devolve o erro do PostgREST como **objeto plano** (`postgrest-js/dist/index.cjs:126`), não instância de `Error`. Todo `catch` do app guarda com `error instanceof Error ? error.message : ''` → sempre `''` → **toda mensagem específica é inalcançável** e só o fallback genérico aparece.

Atingidos: `employees/page.tsx:125-137`, `components/lockers/locker-utils.ts:49-61`, `components/employees/simple-crud-dialog.tsx:97-151`, `categories/page.tsx:150-153`, `sectors/page.tsx:150-153`, `components/employees/import-dialog.tsx:211-217`, `components/lockers/locker-range-dialog.tsx:117-125`.

→ Helper único `getDbErrorMessage(error)` lendo `code`/`message`/`details` do objeto, chaveando por **código Postgres** (`23505` unique, `23503` FK, `P0001` raise) em vez de substring de mensagem. Substituir nos 7 arquivos.

*Aceite:* excluir categoria em uso exibe "Existem produtos vinculados a esta categoria"; criar setor duplicado exibe a mensagem de duplicidade.

Fica de fora, mas anotado: `/sectors` e `SimpleCrudDialog` são **duas implementações independentes e divergentes do mesmo cadastro** (validação de rename, dicionário de erro e substring de FK diferentes). Unificar é refactor próprio.

---

## 5. Fase 3 — Fundação analítica

### 5.1 Carimbo de setor (D10)

- Migration: `ALTER TABLE movements ADD COLUMN department_id UUID REFERENCES departments(id)`.
- Trigger `BEFORE INSERT`: se `employee_id` presente e `department_id` nulo, copia de `employees.department_id`.
- Backfill: `department_id` = setor **atual** do colaborador, para linhas com `employee_id`. Linhas sem `employee_id` ficam nulas e agrupam como "Sem solicitante".
- Índice `(department_id, created_at)`.

> Assunção registrada: o backfill congela a lotação de hoje sobre o passado. Números históricos por setor são aproximados; a partir da migration passam a ser fiéis.

### 5.2 RPCs

Padrão novo no repo. `SECURITY INVOKER`, `GRANT EXECUTE TO anon`, todas recebendo os filtros e devolvendo agregado pronto.

| RPC | Devolve |
|---|---|
| `dashboard_operacao(p_category_id)` | contagens zerado/crítico/estável, % em risco, top itens por urgência, itens por cobertura em dias, pedidos em atraso |
| `dashboard_analise_kpis(p_from, p_to, p_category_id, p_department_id)` | consumo R$, compras R$, nº de movimentações — cada um com o valor do período anterior equivalente |
| `dashboard_serie(p_from, p_to, ...)` | buckets diários de consumo e compra |
| `dashboard_dimensao(p_from, p_to, p_dim, ...)` | consumo por categoria / setor / produto, com valor do período anterior |
| `dashboard_destaques(p_from, p_to, ...)` | 3–4 insights determinísticos ordenados por relevância |

**Correções que vêm junto:**
- **Timezone.** Hoje o balde de mês usa `new Date(...).getMonth()` no fuso do navegador (`dashboard/page.tsx:161-162`) contra uma coluna `TIMESTAMPTZ`. Nos RPCs, bucketizar em `America/Sao_Paulo` explicitamente.
- **Índice composto** `movements(product_id, created_at)` — inexistente, e é a forma de toda query de replay.
- `idx_movements_created` finalmente é usado, porque passa a existir `WHERE created_at BETWEEN`.
- Definição única de "crítico"/"zerado": hoje vive replicada em `dashboard/page.tsx:265`, `replenishment-queue/page.tsx:105-107`, `products/page.tsx:642-644` e na view morta `dashboard_stats` (que ainda conta produtos inativos — divergiria se alguém a adotasse). A view morta é substituída pelos RPCs.

---

## 6. Fase 4 — Nova home

**Primeira ação: invocar `Skill(design-taste-frontend)`** e seguir suas diretrizes (D15). Tokens visuais continuam vindo de `DESIGN.md` / `globals.css`.

### 6.1 Filtros

Estado na querystring (`?tab=&from=&to=&cat=&dep=`), último conjunto lembrado em `localStorage`.

Resolução derivada, **precisa da sua confirmação**: a aba `Operação` é foto instantânea, então recebe apenas o filtro de **categoria**; período e setor aparecem só em `Análise`. Isso evita o defeito atual, em que a barra de filtro fica sobre quatro KPIs e move só dois (`dashboard/page.tsx:263-276` ignora mês/ano).

### 6.2 Aba Operação

KPIs: `Zerados` · `Críticos` · `% do catálogo em risco` · `Pedidos em atraso`.

- **Pedidos em atraso** = PO com `estimated_delivery < hoje` e sem linha em `follow_up_receipts`. Computável hoje.
- **Cobertura em dias** (KPI/gráfico novo): `current_qty ÷ consumo médio diário dos últimos 90 dias`. Antecipa a ruptura sem exigir snapshot de saldo — é o item mais valioso que o modelo atual permite.

Gráficos: composição do catálogo por faixa (Zerado/Crítico/Estável) · concentração de risco por categoria · top itens por urgência (déficit relativo `(min−qty)/min`) · pedidos em aberto por dias de atraso.

### 6.3 Aba Análise

KPIs, todos com delta vs. mesmo período do mês anterior: `Consumo (R$)` (principal) · `Compras (R$)` · `Movimentações` · `Valor imobilizado em estoque` (snapshot `Σ current_qty × cost_price`).

Gráficos: série diária Consumo vs. Compras, com média anotada e pico destacado · consumo por categoria com marcador do período anterior · consumo por setor (habilitado pela Fase 3.1) · top 10 produtos por consumo R$ · maiores variações de preço no período.

Faixa de destaques (D8), regras determinísticas: maior alta de custo no período · setor com consumo acima da própria média · categoria que concentra o maior share do mês · **produtos sem movimento há 90+ dias** (encalhe — computável e ausente hoje).

### 6.4 Dívidas de UI a resolver na Fase 4

- **Primitivos ausentes:** não existem `tooltip`, `skeleton` nem wrapper de chart em `components/ui/`. `lib/chart.ts` tem 10 linhas e um único objeto de estilo.
- **Cor de série múltipla — questão aberta de design.** `--chart-1..5` estão definidos em `globals.css:152-156` e **nunca são usados**; todo gráfico hoje é amarelo sólido. `DESIGN.md:203` proíbe segunda cor de marca. Série dupla (Consumo vs. Compras) precisa de uma regra: proposta é amarelo para a série primária, rampa de cinza para a secundária, semânticas só para status. A definir com a skill.
- `PageLoading` renderiza esqueleto de tabela que a home não tem (`page-loading.tsx:22-31`) — layout shift garantido.
- Não existe `loading.tsx`/`error.tsx` em nenhuma rota; todo estado é feito à mão dentro de client component.

---

## 7. Riscos assumidos e débitos registrados

| Item | Decisão | Consequência aceita |
|---|---|---|
| **Custo-zero nas saídas** (D12) | Sem selo de cobertura | Produto sem `cost_price` **não** congela `unit_value = R$ 0,00` — o mecanismo é outro. O RPC `dashboard_analise_kpis` (`schema.sql`) soma `SUM(quantity * unit_value)`; com `unit_value NULL` o termo vira NULL e o `SUM` **descarta a linha inteira** da soma, enquanto o `COUNT(*)` da mesma CTE continua contando aquela movimentação. O dashboard fica **internamente inconsistente**: a contagem de movimentações não é coberta pelo valor de consumo, e nada na tela sinaliza o buraco. Três agravantes: (a) `freeze_exit_cost` é trigger `BEFORE INSERT` — nenhuma correção aplicada de hoje em diante alcança uma saída já gravada; (b) a premissa de `CONTEXT.md:86` ("Custo Cadastrado atualiza **somente** via Entrada com nota fiscal") **já não corresponde ao código** — o importador de produtos grava `cost_price` direto do CSV, sem NF e sem gerar linha em `price_history` (`app/(dashboard)/products/page.tsx:696`), então a ausência de campo de custo no formulário de Produto não preserva pureza nenhuma; (c) **decidido em 2026-07-30** manter o risco — sem selo de cobertura no dashboard e sem campo de custo no formulário de Produto. É decisão consciente e recorrente (reafirmada no grilling de `2026-07-30-backlog-correcoes-plan.md`, G1), não pendência esquecida. **O KPI principal da aba Análise subestima em silêncio.** |
| **Segurança/auth** (D14) | Fora de escopo | Senha em texto plano legível por qualquer um com o anon key (`schema.sql:124`, RLS `Allow all`); cookie de sessão é a constante `silcon_authenticated_2024` (`lib/auth.ts:5`); não existe `middleware.ts` — a guarda é um `useEffect` client-side. `ADR-0004` aceitou o risco condicionado a "URL não divulgada"; a página pública do quiz distribuía o anon key e quebrou essa premissa. **Executado em 2026-07-30:** a rota do quiz foi desativada (`notFound()` em `app/quiz-seguranca/layout.tsx`, arquivos e tabela `quiz_respostas` preservados) e o `ADR-0004` foi reescrito com a premissa correta. Atenção ao limite do ganho: isso **restaura** a premissa "só quem tem a URL", não torna o anon key secreto — ele segue `NEXT_PUBLIC_*` no bundle do dashboard. O resto desta linha (senha em texto plano, cookie constante, guarda client-side, ausência de `middleware.ts`) **continua valendo integralmente** e segue fora de escopo por D14. |
| **Fila de reposição sem estado** (D13) | Home mostra só zerados/críticos | Não há flag "já pedido" nem FK de compra para produto; item permanece na fila após comprado. A home não promete ser lista de trabalho. |
| **Setor histórico** (D10) | Backfill com lotação atual | Meses anteriores à migration têm setor aproximado. |
| **Sem cadastro de fornecedor** | Fora de escopo | `entity_name` é texto livre em três campos desconexos (`movements`, PO, recebimento) — gasto por fornecedor é inviável. |
| **Sem `created_by` em lugar nenhum** | Fora de escopo | Nenhuma ação é atribuível a uma pessoa; não existe cadastro de usuário. |
| **Lead time de compra** | Fora de escopo | `follow_up_receipts.received_at` default `NOW()` e o form não coleta a data real de entrega — o número seria data de digitação. |

---

## 8. Ordem de execução

```
Fase 0  Correções transacionais          ── bloqueia tudo
Fase 1  Higiene SQL / migration          ── pode correr em paralelo à 0
Fase 2  F0 (mensagens de erro)           ── independente, barata
Fase 3  Carimbo de setor + RPCs          ── depende de 0 e 1
Fase 4  Nova home via /design-taste-frontend ── depende de 3
```

---

## 9. Achados fora de escopo, registrados para backlog

**Saíram nesta leva** (`2026-07-30-backlog-correcoes-plan.md`, Etapas 2–5): lixeira do Follow-up, que era duas ações num botão só e tornava impossível excluir pedido recebido sem passar antes pela ação irreversível — agora ações explícitas e rotuladas, ambas confirmando · `follow_up_solicitations.status`, escrito e nunca lido com implementações divergentes da mesma regra — coluna dropada, `computeStatus` é fonte única · `window.confirm` dentro de um sistema de diálogo desenhado — **a contagem correta era 7 arquivos, não 6** (`categories`, `employees`, `movements`, `products`, `sectors`, `locker-form-dialog`, `locker-range-dialog`); migrados para a primitiva `useConfirm()`.

**Ficam:** Sugestões de Compra com quantidade e valor **negativos** (`purchase-orders/page.tsx:93-95` — a causa some na Fase 0.5) · Follow-up sem caminho de edição para nada · datas impossíveis aceitas (`follow-up/page.tsx:63-69` — `applyDateMask`/`parseDateInput` não validam calendário real) · `follow_up_solicitations.updated_at` virou órfão ao remover o `syncStatus` nesta leva: não há trigger de `updated_at` nessa tabela (o único do schema é `trigger_employees_updated_at`), então a coluna nunca muda depois do insert e hoje é sinônimo de `created_at` — ninguém a lê, mas o nome promete uma semântica que o código não cumpre · Movimentações não permite editar, e não há trigger de UPDATE — um `PATCH` direto via anon key corrompe o saldo sem autocorreção · exclusão de movimentação é DELETE físico sem trilha · quiz recalcula acerto contra o gabarito atual por posição, então mudar uma questão reescreve notas passadas (`painel/page.tsx:352-354`) — a rota pública foi desativada em 2026-07-30 (`app/quiz-seguranca/layout.tsx`), mas o defeito continua no código, que segue intacto para uma eventual reativação · Função (`roles`) não tem tela própria, embora Setor tenha · soft vs hard delete divergente em seis telas.
