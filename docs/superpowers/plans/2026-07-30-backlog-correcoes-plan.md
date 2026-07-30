# Plano — Backlog de Bugs Funcionais (grilling de 2026-07-30)

**Data:** 2026-07-30
**Origem:** backlog da §9 + riscos assumidos da §7 de `2026-07-29-dashboard-home-plan.md`, re-verificados linha a linha no código de `main` (`7b0f7e7`).
**Status:** executado parcialmente em 2026-07-30 — Etapas 0b, 1 (sem verificação em browser), 2, 3 e 4 concluídas; Etapa 0a **não** executada (sem acesso a banco nesta sessão), continua bloqueando as migrations pendentes. Ver §10, "Resultado da execução".
**Planos irmãos:** `2026-07-29-dashboard-home-plan.md`, `2026-07-29-refactor-visual-carbon-plan.md`

---

## 0. Decisões travadas no grilling

| # | Questão | Decisão |
|---|---|---|
| G1 | **KPI de Consumo subestima** (custo-zero) | **Nada agora, só documentar.** Sem campo de custo no form, sem selo de cobertura. O risco continua aceito; o que muda é a redação — a §7 hoje descreve o mecanismo errado (ver E5) |
| G2 | **Saídas passadas com `unit_value` NULL** | **Sem backfill.** Reprecificar saída antiga com o custo de hoje é exatamente o que o ADR-0002 existe para impedir, e já foi a causa dos bugs que `migration_corrige_custo_carimbado.sql` teve de desfazer |
| G3 | **`follow_up_solicitations.status`** | **Dropar a coluna** e derivar no cliente. `computeStatus` passa a ser fonte única; `syncStatus` e os 2 round-trips por ação vão embora |
| G4 | **Amplitude das correções de UI** | **Primitiva única de confirmação** (absorve o modal-sobre-modal e os 7 `window.confirm`) + **lixeira do Follow-up** + **cards do grid de armários** |

**Fora desta rodada, por decisão explícita:** campo de custo no cadastro de Produto; selo de cobertura no KPI; backfill de `unit_value`; caminho de edição no Follow-up; datas impossíveis no Follow-up; `created_by`; cadastro de fornecedor; soft vs hard delete divergente; edição de movimentação.

---

## 1. Correções ao enunciado do backlog

O backlog da §9 descrevia quatro dos cinco itens de forma imprecisa. As correções mudam o desenho do conserto, não só a redação.

| Item | Enunciado no backlog | O que o código mostra |
|---|---|---|
| Cards de armário | "não fecham a conta" | Duas causas independentes: `total = lockers.length` inclui inativos e `occupied`/`free` não (`locker-grid.tsx:31-36` + `locker-utils.ts:41-44`); e o 4º card troca a **unidade** — conta pessoas, não armários (`lockers-panel.tsx:132`). Mais: o filtro oferece `Inativo` (`:115`) para um estado sem card |
| `SimpleCrudDialog` | "empilha dois focus traps" | O empilhamento existe, mas o `focusScopesStack` global do Radix pausa o escopo antigo — trap **não** é o defeito provável. Os defeitos legíveis no código são **dois overlays** de `rgba(22,22,22,0.5)` compostos (`dialog.tsx:43`) = scrim ~0,75, único no app; e retorno de foco a um gatilho **já removido da lista**, que joga o teclado no `body`. E não é só esse componente: `locker-sheet.tsx:277+423+434` tem o mesmo padrão |
| Lixeira do Follow-up | "duas ações num botão, sem caminho para excluir pedido recebido" | Pior: a ação **irreversível** (remover recebimento, `:588`) dispara sem confirmação, e a reversível (excluir pedido, `:590`) confirma. Está invertido. E o caminho para excluir pedido recebido **existe** — dois cliques na mesma lixeira, ou cascata pela solicitação (`:520`); o `aria-label` (`:584`) é que nunca revela isso. É indescobrível, não impossível |
| `status` do Follow-up | "duas implementações divergentes" | **Três** derivações (`:100-105` TS por solicitação, `:210-250` TS por contagem, `schema.sql:938-942` SQL por pedido), e a divergência é **latente**: `receivedCount >= poIds.length` só difere de `every(po → tem recebimento)` se um pedido tiver 2+ recebimentos, o que o `UNIQUE` de `schema.sql:813` impede. Não é bug de dado — é coluna morta + ~40 linhas de custo de manutenção |
| KPI de Consumo | "congela a saída em R$ 0,00" | Não vale zero: **desaparece da soma**. `SUM(quantity * unit_value)` com `unit_value NULL` produz termo NULL e o `SUM` ignora a linha (`schema.sql:1017`) — enquanto `COUNT(*)` na mesma CTE a conta. O dashboard fica internamente inconsistente. Mais: `freeze_exit_cost` é `BEFORE INSERT` (`:415-419`), então nada aplicado no futuro alcança uma saída passada. Mais: a premissa "só Entrada com NF mexe no custo" (`CONTEXT.md:77`) **já é ficção** — o importador grava `cost_price` sem NF e sem `price_history` (`products/page.tsx:675`) |

---

## 2. Etapa 0 — Bloqueadores que precedem o backlog

Nenhum item do backlog importa enquanto estes dois estiverem abertos. **Ambos precisam de de-acordo antes de eu tocar em código** — nenhum foi decidido no grilling.

### 0a. Três migrations pendentes contra código já mergeado

`supabase/README.md:70-72` declara `migration_fase0_integridade.sql` (#11), `migration_fase1_higiene.sql` (#12) e `migration_fase3_analitico.sql` (#13) como **PENDENTE — ainda não aplicada**, em nenhum banco. O `main` já mergeado chama os RPCs que elas criam:

- `dashboard-home.tsx:154-172` → `dashboard_operacao`, `dashboard_analise_kpis`, `dashboard_serie`, `dashboard_dimensao` (×3), `dashboard_destaques` → **as duas abas da home nova não carregam**
- `locker-sheet.tsx:204` → `transfer_locker_assignment` → **transferência de armário quebrada**
- `employees/page.tsx:285` → `deactivate_employee` → **desligamento de colaborador quebrado**

O status vem dos comentários dos arquivos + `git log`, ambos de 2026-07-29 — pode estar defasado se as migrations foram rodadas desde então. **Primeiro passo, antes de qualquer código:**

```sql
SELECT * FROM schema_migrations ORDER BY applied_at;
```

Sem a tabela, ou faltando fase 0/1/3, o bloqueador está de pé: aplicar #11 → #12 → #13 nessa ordem, no SQL Editor, antes de tudo. **Nenhuma migration nova desta rodada (Etapa 4) pode entrar em cima de uma pilha não aplicada.**

### 0b. Quiz público distribui o anon key

- `app/quiz-seguranca/page.tsx` está **fora** do grupo `(dashboard)`, logo fora do guard de `layout.tsx:20-23`. Não existe `middleware.ts`.
- Página pública + anon key + RLS `Allow all` = qualquer visitante lê e escreve **todas** as tabelas, inclusive `config.access_password` em texto puro (`schema.sql:306`, políticas `Allow all` a partir de `schema.sql:747`).
- A §7 declarou a mitigação — "o quiz será desativado" — e ela **não foi executada**: a página está em `main`, funcionando.

Consequência para o ADR-0004: atualizá-lo hoje é escrever um documento que registra um furo **aberto** como aceito. A premissa "URL não divulgada" não está quebrada só no papel.

Duas variantes, à escolha:

- **(i) Desativar a rota** — o que a §7 já prometeu. Remover/`notFound()` em `app/quiz-seguranca/**` (2 páginas). Mantém `quiz_respostas` e os dados. Custo: minutos.
- **(ii) Mover para trás do guard** — só faz sentido se o quiz precisa continuar acessível a quem não tem a senha do sistema. Nesse caso o guard client-side não basta: precisa `middleware.ts` de verdade, o que é o item "Segurança/auth" que a D14 pôs fora de escopo.

Recomendação: **(i)**, e o ADR-0004 na Etapa 5 registra o furo como *fechado por remoção da superfície*, não como aceito.

---

## 3. Etapa 1 — Primitiva única de confirmação (absorve B2)

**Achado que orienta o desenho:** os 7 `window.confirm` e o `ConfirmDialog` não são o mesmo padrão mal aplicado — são **dois papéis distintos**:

- **destrutivo** (`ConfirmDialog`, 6 sítios): disparado de uma linha de tabela, com o modal pai fechado. Declarativo, não empilha, **não está quebrado**.
- **descartar alterações** (`window.confirm`, 7 sítios: `categories:95`, `employees:229`, `movements:227`, `products:363`, `sectors:95`, `locker-form-dialog:71`, `locker-range-dialog:75`): dispara **por definição com um modal aberto**, e precisa de resposta síncrona para decidir se deixa fechar. É exatamente o caso empilhado — e é por isso que alguém escolheu o `confirm` nativo: o Radix aninhado era desconfortável ali.

Logo, a primitiva tem de ser **imperativa e promise-based**, senão os 7 sítios não migram:

1. `components/ui/confirm-provider.tsx` — instância **única** montada no `app/layout.tsx`, expondo `useConfirm()`:
   ```ts
   const ok = await confirm({ title, description, confirmLabel, variant });
   if (!ok) return;
   ```
   Forma imperativa idêntica à do `window.confirm`, então os 7 sítios viram troca de uma linha (mais `async`).
2. `dialog.tsx` — `DialogContent` ganha `showOverlay = true`. Quando a confirmação monta sobre um diálogo já aberto, ela renderiza **sem** overlay próprio: mata o scrim duplo, uma composição só.
3. Retorno de foco: o provider guarda o `DialogContent` ancestral ao abrir e, no fechamento, se o gatilho original não estiver mais em `document` (caso do item deletado da lista), devolve o foco ao conteúdo do modal pai em vez de deixar cair no `body`.
4. `ConfirmDialog` continua existindo como **casca declarativa fina sobre a mesma instância** — uma implementação, uma política de scrim e de foco. Migrar os 6 sítios declarativos fica mecânico e opcional.

**Antes de escrever o item 3, verificar no browser** (10 min) se o trap realmente vaza ou se só o scrim e o foco estão errados: abrir Setores → gerenciar → excluir um item e conferir (a) escurecimento contra outro modal do app, (b) onde o `:focus` cai depois do delete, (c) se `Tab` sai do modal. Sem isso a gente conserta o sintoma errado.

**Sítios empilhados a cobrir:** `simple-crud-dialog.tsx:267` e `locker-sheet.tsx:423`+`:434`.

---

## 4. Etapa 2 — `follow_up_solicitations.status`: dropar (G3)

**Ordem é obrigatória: código primeiro, migration depois.** Se a coluna cair com o código antigo em produção, todo `PATCH` de `syncStatus` passa a dar 400 na criação de pedido.

1. `follow-up/page.tsx`: apagar `syncStatus` (`:210-250`); as 4 chamadas passam a chamar `refreshSolicitations()` direto (`:323`, `:336`, `:378`, `:394`). Remover `status: 'pendente'` do insert (`:267`). `computeStatus` (`:100-105`) fica como fonte única.
2. Efeito colateral que morre junto: `confirmDelete` passa `sol?.id || ''` para `syncStatus` (`:408`) — string vazia como id de solicitação. Desaparece com o `syncStatus`.
3. `lib/types.ts:135`: remover `status` de `FollowUpSolicitation`. **Manter `FollowUpStatus`** (`:109`) — `computeStatus`/`statusBadge` continuam usando.
4. Migration nova `supabase/migration_dropa_status_followup.sql`: `ALTER TABLE follow_up_solicitations DROP COLUMN IF EXISTS status;` + registro em `schema_migrations`.
5. `schema.sql:793`: remover a coluna do `CREATE TABLE`. `supabase/README.md`: linha nova na tabela da §2.

**Só rodar a migration depois de a Etapa 0a estar resolvida** — não empilhar em cima das três pendentes.

---

## 5. Etapa 3 — Lixeira do Follow-up (B3)

Depois da Etapa 2, porque ela já enxuga o arquivo e remove `syncStatus` das mãos dos handlers de delete.

1. Substituir o botão único (`:580-596`) por ações **explícitas e rotuladas**. Card recebido → duas ações: `Remover recebimento` e `Excluir pedido` (esta avisa que leva o recebimento junto, via cascata de `schema.sql:813`). Card não recebido → só `Excluir pedido`.
2. **As duas passam pelo `confirm()` da Etapa 1.** Hoje remover recebimento — a irreversível — não confirma.
3. `deleteTarget` ganha o caso `receipt`, para os três alvos correrem pelo mesmo caminho de confirmação em vez de um deles curto-circuitar.
4. O `Dialog` de confirmação ad-hoc (`:794-820`) sai; passa a usar a primitiva.

---

## 6. Etapa 4 — Cards do grid de armários (B1)

1. `locker-grid.tsx:31-36`: a fileira de KPIs passa a ter **uma unidade só — armários** — e a conta fecha: `Total` = `Ocupados` + `Livres` + **`Inativos`** (card novo, que dá corpo ao filtro já existente em `:115`).
2. `Sem armário` / `Sem vestiário` sai da fileira (`:75-82`): é métrica de **pessoas**. Vira linha própria abaixo — "N colaboradores ativos sem armário" —, onde a unidade fica explícita no texto.
3. `CONTEXT.md`, §Vestiário: acrescentar **Ocupado / Livre / Inativo** como termos normativos. Hoje só Armário e Ocupação estão definidos (`:51-56`), então o conserto não tem contra o que ser conferido.
4. Manter o resumo sobre o universo do `kind` inteiro, **ignorando os filtros ativos** (comportamento atual): é denominador, não recorte. Documentar no rótulo.
5. Fica aceito e registrado: armário inativo **com** ocupação conta como Inativo, nunca como Ocupado (`locker-utils.ts:42`). A UI impede criar esse estado (`locker-sheet.tsx:409`); o anon key, não — o que é o risco do ADR-0004, não deste item.

---

## 7. Etapa 5 — Documentação (G1, G2 + ADR-0004)

Só depois de a Etapa 0b estar decidida — o texto do ADR-0004 depende do que de fato ficou no código.

1. **§7 do `2026-07-29-dashboard-home-plan.md`**, linha "Custo-zero nas saídas": corrigir o mecanismo. Não é "vale R$ 0,00 para sempre" — a linha **sai da soma** e o `COUNT(*)` a mantém, então o dashboard se contradiz internamente. Acrescentar: (a) o freeze é `BEFORE INSERT`, nenhuma correção futura alcança o passado; (b) o importador já grava custo sem NF, então a ausência do campo no form não preserva pureza nenhuma; (c) decidido em 2026-07-30 manter o risco, sem selo e sem campo.
2. **ADR-0002**: nota registrando que produto criado pelo form nasce sem custo, que suas Saídas ficam permanentemente fora das agregações de valor, e que **não haverá backfill** — com o motivo (G2), para ninguém reabrir a discussão daqui a três meses achando que foi esquecimento.
3. **ADR-0004**: reescrever a premissa. Hoje ele condiciona o risco a "URL não divulgada"; o texto novo registra o guard client-side (`layout.tsx:20-23`), a ausência de `middleware.ts`, o cookie constante (`lib/auth.ts:5`), e o que aconteceu com o quiz — furo fechado por remoção da rota (variante 0b-i) ou ainda aberto (0b-ii).
4. **§9 do plano irmão**: marcar o que saiu (`status`, lixeira, cards, `window.confirm` — este de 6 para 7 sítios, contagem corrigida) e o que fica.

---

## 8. Ordem de execução

```
Etapa 0a  Verificar/aplicar as 3 migrations pendentes   ── BLOQUEIA TUDO
Etapa 0b  Decidir e executar o quiz público            ── independente, minutos
Etapa 1   Primitiva de confirmação (+ verif. browser)   ── bloqueia 2 e 3
Etapa 2   Dropar status: código, depois migration       ── migration depende de 0a
Etapa 3   Lixeira do Follow-up                          ── depende de 1 e 2
Etapa 4   Cards de armário + CONTEXT.md                 ── independente, paralelizável
Etapa 5   Documentação (§7, ADR-0002, ADR-0004, §9)     ── depende de 0b
```

---

## 9. Verificação

| Etapa | Como conferir que ficou certo |
|---|---|
| 0a | `SELECT * FROM schema_migrations` lista fase 0, 1 e 3; a home carrega as duas abas; transferir armário e desligar colaborador funcionam na UI |
| 0b | `/quiz-seguranca` e `/quiz-seguranca/painel` não respondem (ou exigem login); nenhuma página fora de `(dashboard)` importa `lib/supabase` |
| 1 | Excluir item de dentro de Setores → gerenciar: um só nível de escurecimento; foco volta para dentro do modal pai; `Tab` não escapa. Zero `window.confirm` no `grep` |
| 2 | `grep -rn "syncStatus\|solicitations.*status" app lib` vazio; criar pedido e confirmar recebimento não disparam PATCH em `follow_up_solicitations` (Network); badge continua correto nos 3 estados |
| 3 | Num pedido recebido, as duas ações aparecem rotuladas e **as duas** confirmam; excluir o pedido leva o recebimento; o badge da solicitação volta a `em_andamento`/`pendente` |
| 4 | Com ≥1 armário desativado: `Ocupados + Livres + Inativos == Total`; contagem de pessoas fora da fileira de KPIs |
| 5 | `npm run lint` limpo; §7 sem a redação "R$ 0,00"; ADR-0004 sem a premissa "URL não divulgada" |

---

## 10. Resultado da execução (2026-07-30)

| Etapa | Resultado |
|---|---|
| 0a | **Não executada.** Exige acesso ao banco (SQL Editor do Supabase), que não existe nesta sessão — nem para aplicar, nem sequer para verificar `schema_migrations`. `supabase/README.md` §2 segue declarando #11 `migration_fase0_integridade.sql`, #12 `migration_fase1_higiene.sql` e #13 `migration_fase3_analitico.sql` como PENDENTE, e o `main` já chama os RPCs que #11 e #13 criam. Continua sendo o bloqueador nº 1. A migration nova desta leva, #14 `migration_dropa_status_followup.sql`, **não deve ser aplicada antes de #11/#12/#13** — não foi aplicada a nenhum banco nesta sessão. |
| 0b | Executada. Rota pública do quiz desativada via `notFound()` em `app/quiz-seguranca/layout.tsx` (novo); `page.tsx`, `painel/page.tsx`, `lib/quiz-seguranca.ts` e a tabela `quiz_respostas` preservados. |
| 1 | Implementada: `components/ui/confirm-provider.tsx` e `confirm-dialog-shell.tsx` (novos), montados uma vez, expondo `useConfirm()`; os 7 `window.confirm` migrados. **A verificação em browser que esta seção pedia — composição do scrim, contenção de `Tab`, `Escape`/clique no overlay resolvendo `false` — não foi feita.** Rodaram apenas lint, typecheck e build. |
| 2 | Implementada: `follow_up_solicitations.status` removida do código (`syncStatus` apagado, `computeStatus` como fonte única) e da migration nova `supabase/migration_dropa_status_followup.sql`. A migration em si cai sob o bloqueio da Etapa 0a — código e migration foram escritos, mas a migration não foi aplicada a banco algum nesta sessão. |
| 3 | Implementada, em rodada paralela por outro agente: lixeira do Follow-up com ações explícitas e rotuladas, ambas passando pela confirmação da Etapa 1. |
| 4 | Implementada: `components/lockers/locker-grid.tsx` com fileira de KPIs em unidade só (armários) e `Total = Ocupados + Livres + Inativos`; vocabulário `Ocupado/Livre/Inativo` acrescentado ao `CONTEXT.md`. |
| 5 | Esta leva de documentação — os quatro arquivos listados no início desta etapa. |

### 10.1 Achados da revisão de código e o que foi corrigido

Três revisões independentes rodaram sobre o diff completo, com mandatos disjuntos (primitiva de confirmação; Follow-up + SQL; documentação, armários e design system). **Nenhum bloqueador.** O que foi corrigido depois delas:

| Severidade | Achado | Correção |
|---|---|---|
| Importante | `confirm()` não tinha guarda de reentrância: uma segunda chamada antes de a primeira resolver sobrescrevia o estado e o `resolve` da primeira Promise deixava de ser referenciado — ela pendurava para sempre, e o `await confirm(...)` daquele call site nunca prosseguia, em silêncio | O `resolve` pendente passou a viver num ref; uma nova chamada resolve a anterior como `false` (superada) antes de tomar o lugar. Cobre também o caso de resolver a mesma Promise duas vezes, que era a única proteção que existia antes |
| Importante | Referência `schema.sql:124` (senha em texto puro / RLS) apontava para linha em branco — erro reintroduzido neste próprio plano | Corrigida para `schema.sql:306` (a coluna) e `schema.sql:747` (as políticas `Allow all`) |
| Importante | Comentários de `confirm-dialog.tsx` e `confirm-dialog-shell.tsx` classificavam a taxonomia de aninhamento errado: diziam que só `simple-crud-dialog` e `locker-sheet` empilham, e listavam `simple-crud-dialog` como "modal pai fechado". Sem efeito em runtime (a autodetecção por DOM é genérica), mas convidava a "otimizar" removendo a detecção | Reescritos. Registram que as 7 confirmações de descarte **também** abrem aninhadas — o Dialog do formulário continua `data-state="open"` enquanto a confirmação está na tela — e que aninhado é o caso comum, não a exceção |
| Importante | Cards de armário ignoram os filtros ativos (correto: são denominador), mas nada na tela dizia isso — quem filtra por "Inativo" podia ler os totais como contradição | Aviso condicional abaixo da barra de filtros, só quando há filtro ativo: "Exibindo N de M armários — os totais acima consideram todos os armários, não o filtro" |
| Menor | `follow_up_solicitations.updated_at` ficou órfão: o `syncStatus` removido era o único `UPDATE` da tabela e não há trigger de `updated_at` nela | Documentado, não consertado — no cabeçalho da migration e no backlog (§9 do plano de 2026-07-29). Criar o trigger ou dropar a coluna são escopos que ninguém decidiu |
| Menor | Citação `(:63-69)` na §9 do plano de 2026-07-29 ficou órfã de nome de arquivo depois da reescrita da seção | Qualificada como `follow-up/page.tsx:63-69` |

Verificação final após as correções: `npx tsc --noEmit` limpo, `npm run lint` com 0 erros, `npm run build` completo. A rota do quiz foi conferida empiricamente contra o servidor de produção (`next start`): `/quiz-seguranca` e `/quiz-seguranca/painel` respondem **HTTP 404**, e o corpo do 404 não contém nada do Supabase. Na mesma checagem confirmou-se que o anon key **segue presente** num chunk cliente do dashboard — a premissa do ADR-0004 foi restaurada, não superada. A verificação em browser da Etapa 1 continua pendente.
