# Plano — Refactor Visual para IBM Carbon

**Data:** 2026-07-29
**Origem:** substituição integral do `DESIGN.md` (sistema dark/amarelo → IBM Carbon) + análise da implementação atual.
**Status:** aprovado, aguardando execução (roda depois da Fase 3 do plano de integridade)
**Plano irmão:** `2026-07-29-dashboard-home-plan.md`

---

## 0. Decisão arquitetural

**Híbrido estrito: tokens oficiais Carbon + runtime Radix/Tailwind.**

Instalar `@carbon/colors`, `@carbon/themes`, `@carbon/type`, `@carbon/layout` (pacotes de token, sem componentes, sem Sass) e **gerar** a camada de CSS custom properties a partir deles. Manter Radix + CVA + Tailwind como runtime de comportamento acessível.

**Por que não `@carbon/react` puro:**
- `components/ui/data-table.tsx` é API config-por-coluna (`DataTableColumn<T>[]`); o DataTable da Carbon é render-prop. 6 call sites com JSX arbitrário nas colunas.
- Sem equivalente core para `Sheet` (o `SidePanel` vive em `@carbon/ibm-products`, pacote à parte) — e `locker-sheet.tsx` tem 446 linhas.
- Sem equivalente para `cmdk` (`command.tsx`, 184 linhas, alimenta o combobox de colaborador).
- `react-hook-form` muda de contrato: `FormLabel`/`FormControl` → props `invalid`/`invalidText`.
- `@carbon/styles` é Sass, com normalize próprio de alta especificidade, e briga com o preflight do Tailwind.
- `@carbon/react` v11 não marca todos os exports com `"use client"` (app é Next 16 App Router).
- Os 19 primitivos carregam `data-slot`, com seletores dependentes em `globals.css:180`, `card.tsx:23`, `select.tsx:40`, `dialog.tsx:64`.

Custo real: reescrita de ~60–70% do JSX, sem ganho funcional, com risco alto de parar no meio e ficar metade-Carbon. A skill (`SKILL.md:8` e §13, linhas 896-901) **tira dashboards e data tables do próprio escopo** e manda usar Carbon — o que ela governa aqui é o token, não o runtime de componente. A Honesty rule ("do not recreate its CSS by hand") é atendida gerando os valores dos pacotes oficiais.

**Condição inegociável:** o cabeçalho de `app/globals.css` declara por escrito que é token oficial Carbon sobre runtime Radix, e **não** `@carbon/react`. Sem isso, o híbrido vira re-tokenização disfarçada.

**Bloqueador a resolver na Etapa 0:** o `DESIGN.md` novo **não tem front matter**. Começa em `## Overview` e referencia ~25 tokens (`{colors.hairline}`, `{colors.blue-60}`, `{spacing.lg}`, `{typography.body}`…) que não têm valor definido em lugar nenhum — só 6 hex aparecem literalmente (`#0f62fe`, `#f4f4f4`, `#e0e0e0`, `#161616`, `#525252`, `#8c8c8c`). Escrever o apêndice de tokens com os valores puxados de `@carbon/themes` (White) antes de qualquer implementação.

---

## 1. Decisões travadas

| # | Questão | Decisão |
|---|---|---|
| V1 | Cor de série em gráficos | Paleta oficial data-viz Carbon, que **não contém** `#0f62fe` (para não colidir com o token interativo). `--chart-1..5` = `#6929c4` `#1192e8` `#005d5d` `#9f1853` `#fa4d56`, **nesta ordem, nunca reordenar**. Série única = purple-70. Série dupla (Consumo vs Compras) = purple-70 + cyan-50. Ranking por magnitude é **ordinal** → rampa sequencial mono, não N cores categóricas. Estado (alta/queda de preço) usa o alert palette: `#da1e28` `#ff832b` `#f1c21b` `#198038`. Nunca `#0f62fe` em série de dados |
| V2 | Números de KPI (`.text-stat-display`) | `#161616`, weight 300, tabular-nums, **sem cor de marca** — azul gigante viola "treat IBM Blue as scarce" (`DESIGN.md:227,281`). Subir o tamanho ao baixar o peso, senão perde hierarquia (risco E.9) |
| V3 | Sidebar | **Clara** (`#ffffff` ou `#f4f4f4` + hairline). Item ativo com regra esquerda 2px azul + weight 600, **não** fundo azul. Não inverter para charcoal: `DESIGN.md:231` só autoriza inversão no footer e este app não tem footer (risco E.8) |
| V4 | Badges de status | **Reescritos**, não re-tokenizados. Padrão Carbon Tag: fundo pálido + texto escuro (ex.: green-10 `#defbe6` / green-70 `#0e6027`). Cor cheia + texto preto sobre branco é ilegível (risco E.2) |
| V5 | `#8c8c8c` | Proibido para texto de corpo (~3.4:1 contra branco, reprova AA). Terciário vai para `#6f6f6f` (~4.7:1). Afeta `--muted-soft` e todo `text-muted-foreground` — a classe mais usada do repo |
| V6 | Link/acento azul | `#0f62fe` só sobre canvas branco (4.7:1). Sobre `#f4f4f4` cai para ~4.3:1 e reprova → usar `blue-70 #0043ce` |
| V7 | Ícones | **Manter `lucide-react`** — a skill desencoraja mas tem override explícito para projeto que já depende (60+ glifos, 20 arquivos). Padronizar `strokeWidth={2}`. Registrar em ADR |
| V8 | Biblioteca de gráficos | **Manter Recharts**. `@carbon/charts-react` puxaria d3 e a Fase 4 vai criar ~8 gráficos novos — trocar no meio é churn |
| V9 | Variante `dark` | **Remover.** O tema escuro Carbon (Gray-100) não foi extraído (`DESIGN.md:288`). Deixar `@custom-variant dark` órfã é armadilha de bug silencioso (risco E.12/E.18) |
| V10 | Superfícies com alpha | **Toda composição `/NN` vira token liso.** Carbon tem exatamente 2 camadas (`#f4f4f4`, `#e0e0e0`) e nenhuma composição alpha (risco E.14) |
| V11 | Zebra em tabela | **Não adotar.** Colidiria com `hover:bg-muted/50` e `data-[state=selected]` — linha selecionada e linha par ficariam idênticas. Hairline entre linhas já cumpre a função e é mais Carbon (risco E.6) |
| V12 | Tracejado / borda 2px | **Eliminar** dos 7 sites. Em Carbon, 2px é exclusivo de foco (azul) e erro (vermelho); tracejado em dropzone rouba essa assinatura e ensina o significado errado (risco E.16) |

### O que do `DESIGN.md` NÃO se aplica

O documento foi extraído de páginas de **marketing** da IBM e admite no Known Gaps (`:286`) que data tables e componentes de produto não foram cobertos. Ignorar: ritmo hero → logo marquee → CTA banner → footer invertido; `display-xl 76px` e `display-lg 60px` (o maior título do app é `text-2xl`); `hero-card` com padding 48px; gradiente azul de hero. **Não inventar um footer, e a sidebar não é o footer.**

Substituem, das specs Carbon de produto: linha de data table **short 32px** para listagem e header 48px; padding de coluna 16px; header 14px/600 e célula 14px/400; tamanhos de componente 32/40/48; grid de espaçamento 4px.

---

## 2. Etapas

Cada etapa deixa o app rodando e é um commit próprio.

| # | Etapa | Toca |
|---|---|---|
| **0** | Preflight: instalar pacotes `@carbon/*` de token; IBM Plex Sans via `next/font/google` (300/400/600); **escrever o apêndice de tokens no `DESIGN.md`**; ADR `0006-carbon-tokens-sobre-radix.md` registrando a decisão e o override de lucide | `package.json`, `app/layout.tsx`, `DESIGN.md`, `docs/adr/` |
| **1** | Camada de token — o maior salto com o menor risco. Remover `className="dark"`; reescrever a paleta; zerar os raios; Plex Sans + `letter-spacing: 0.16px`; `.text-display` weight 300; `.text-stat-display` sem cor; `.text-caption-uppercase` → sentence case; `--chart-1..5`; `sonner` para light; `lib/chart.ts` e `lib/pdf.ts` | `app/globals.css` inteiro, `layout.tsx:28`, `sonner.tsx`, `lib/chart.ts`, `lib/pdf.ts` |
| **2** | Purga de raio — 141 ocorrências em 35 arquivos. Zerar o token resolve ~135, mas as classes saem mesmo assim (deixar `rounded-lg` que resolve para 0 é mentira documental). 9 `rounded-full` manuais; `radius={[0,4,4,0]}` do Recharts; remover `backdrop-blur` (3 sites) | 35 arquivos |
| **2b** | **Purga de superfície alpha** — 20+ sites `/NN` viram token liso; 7 sites de tracejado/2px viram hairline sólida | primitivos + telas |
| **3** | Re-spec dos 19 primitivos, nesta ordem: button → input → label → badge → card → table → alert → select → tabs → dialog → sheet → dropdown-menu → popover → command → form → separator → sonner → confirm-dialog → data-table. **Foco Carbon** (borda interna 2px via `box-shadow: inset`, nunca `border`, para não causar reflow); 5 variantes de botão; input com `border-bottom` que vira underline 2px no foco; label 12px/400; tabs com underline em vez de cápsula; footer de modal 50/50 colado | `components/ui/**` |
| **4** | Sistema de gráficos — aplicar V1; extrair eixo/grid/tick/paleta para `lib/chart.ts` para que a série dupla da Fase 4 nasça certa | `lib/chart.ts`, `dashboard`, `price-variation` |
| **5** | Densidade e shell — `max-w-[1700px]` → `1584px` nos **dois** lugares (`page-container` e `page-loading`, senão o skeleton desalinha); `page-header` 24px/400; sidebar clara | `components/layout/**`, `sidebar.tsx`, `(dashboard)/layout.tsx` |
| **5b** | **Extrair duplicação antes da varredura** — `components/layout/filter-bar.tsx` a partir de 6 sites idênticos; corrigir as tabs pílula (2 telas, incluindo a **aba vermelha** de `movements:517-520`); normalizar 31 alturas fora da escala e ~20 espaçamentos fora da grade 4px | novo componente + 8 arquivos |
| **6** | Varredura de telas, por custo real: **6a** `follow-up` (a mais cara: 14 `h-9`, 4 eyebrows, dropzone tracejado, `bg-primary` em status) · **6b** `products` + `movements` · **6c** `price-variation` + `replenishment-queue` + `purchase-orders` · **6d** `employees` + `components/employees/**` + `components/lockers/**` · **6e** `dashboard` + `settings` + `login` + `app/page.tsx` · **6f** só verificar (`categories`, `sectors`, `vestiario`, `lockers`, `lockers-panel` — sem dívida própria) | 17 rotas |
| **7** | Quiz: fim da ilha de tema — remover `ACCENT = '#0B576F'` (segunda cor de marca, banida por `DESIGN.md:14,238`) e os 8 usos, ~25 `neutral-*` crus, hex `#16a34a`/`#dc2626` | `app/quiz-seguranca/**` |
| **8** | Estados — skeleton Carbon (`#e0e0e0`, raio 0); empty sem card/tracejado/ícone gigante; erro inline com underline 2px vermelho e bloco com borda esquerda 3px; toast com accent lateral; overlay `rgba(22,22,22,0.5)` (hoje `bg-black/50`, preto puro proibido); PDF nas 4 telas exportadoras | `page-loading`, `alert`, `sonner`, `lib/pdf.ts` + 4 telas |
| **9** | Auditoria final, checklist mecânico (§4) | — |

**Ordem de execução global:** este plano roda **depois da Fase 3** do plano de integridade e **antes da Fase 4** (home nova) — para que a home nasça já em Carbon, e não seja construída sobre tokens que estamos deletando. A Etapa 6e pula `dashboard/page.tsx`, que a Fase 4 reescreve. A Etapa 9 fecha depois da Fase 4.

---

## 3. Riscos

| # | Risco |
|---|---|
| E.1 | `#8c8c8c` reprova AA (~3.4:1). Ver V5 |
| E.2 | Badges invertem: cor cheia + texto preto sobre branco fica ilegível. Ver V4 |
| E.3 | `#0f62fe` sobre `#f4f4f4` reprova (~4.3:1). Ver V6 |
| E.4 | Foco Carbon muda a **caixa** dos controles, não só a cor — usar `box-shadow: inset`, não `border`, senão o conteúdo salta 2px. E o input perde borda nos 4 lados em favor de `border-bottom`, o que muda a leitura de **todos** os formulários |
| E.5 | Recharts: `stroke="var(--border)"` era quase preto e vira `#e0e0e0`; `cursor={{ fill: 'var(--muted)' }}` fica invisível; tooltip com `background: var(--popover)` vira branco sobre branco e precisa de hairline visível |
| E.6 | Zebra colidiria com hover e seleção. Ver V11 |
| E.7 | **Card branco sobre canvas branco desaparece** — hoje a hierarquia é por luminância. Todo `<div className="bg-card">` solto perde definição; auditar um a um |
| E.8 | Sidebar: a tentação de inverter para charcoal quebra o Page Theme Lock. Ver V3 |
| E.9 | `.text-stat-display` em weight 300 sem subir o tamanho perde presença — as 4 telas de KPI ficam sem hierarquia |
| E.10 | Manter lucide precisa ser **declarado** em ADR, senão vira falha silenciosa de pre-flight |
| E.11 | Em-dash em string visível é falha binária pela skill; já existe em `quiz-seguranca/painel/page.tsx:207` |
| E.12 / E.18 | Variantes `dark:` órfãs (ex.: `dropdown-menu.tsx:77`) nunca disparam depois que a classe sai do `<html>`; grep antes de fechar a Etapa 3 |
| E.13 | **Risco de processo:** as Etapas 2 e 6 são varreduras grandes. Parar no meio deixa o app metade-Carbon, pior que qualquer um dos dois estados. Cada sub-lote da 6 é commit próprio; a 2 é feita de uma vez |
| E.14 | Superfície alpha é a regressão **silenciosa** mais provável: o app parece funcionar e só falha quando o usuário tenta distinguir a linha sob o cursor. Exige a Etapa 2b explícita |
| E.15 | Label 14px→12px muda a altura de ~40 campos; dialogs com altura fixa (`purchase-orders:187` `h-[85vh]`) mudam o ponto de scroll. Testar os 8 dialogs |
| E.16 | Tracejado compete com a assinatura de foco. Ver V12 |
| E.17 | `categories` e `sectors` são gêmeas de 283 linhas; tocar uma só cria divergência entre telas irmãs. Tratar como item único |

---

## 4. Checklist de auditoria (Etapa 9)

```
rg 'rounded-(?!none)' --glob '*.tsx'          → só exceções documentadas
rg '#[0-9a-fA-F]{3,8}' --glob '*.tsx'         → vazio (cor só em token)
rg 'faff69|0B576F|neutral-|slate-|zinc-'      → vazio
rg 'bg-(muted|accent|primary|destructive)/\d' → vazio
rg 'border-dashed|border-2'                   → vazio
rg 'uppercase tracking'                       → vazio
rg 'h-7\b|h-9\b|h-11\b|size-9\b|p-2\.5'       → vazio
rg 'dark:' components/ui/                     → vazio
rg 'backdrop-blur|shadow-(?!none)'            → vazio
```
Mais: contraste WCAG AA nos pares de E.1/E.2/E.3; um tema, um acento, um raio.
