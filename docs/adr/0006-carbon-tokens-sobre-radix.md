# Tokens oficiais Carbon sobre runtime Radix/Tailwind

O `DESIGN.md` da raiz foi substituído por completo: saiu o sistema dark/amarelo e entrou o IBM Carbon (canvas branco, IBM Blue `#0f62fe` como único acento, IBM Plex Sans, raio 0px). Decidimos importar os **tokens oficiais** da Carbon (`@carbon/colors`, `@carbon/themes`, `@carbon/type`, `@carbon/layout`) e gerar a camada de CSS custom properties a partir deles, mantendo Radix + CVA + Tailwind como runtime de comportamento acessível. **Não** adotamos `@carbon/react` nem `@carbon/styles`.

Motivos para não migrar para `@carbon/react`:

1. `components/ui/data-table.tsx` é uma API config-por-coluna (`DataTableColumn<T>[]`); o `DataTable` da Carbon é render-prop — os 6 call sites com JSX arbitrário nas colunas exigiriam reescrita completa.
2. Não há equivalente core para `Sheet` — o `SidePanel` da Carbon vive em `@carbon/ibm-products`, pacote à parte — e `locker-sheet.tsx` tem 446 linhas.
3. Não há equivalente para `cmdk` (`command.tsx`, 184 linhas, alimenta o combobox de colaborador).
4. `react-hook-form` muda de contrato sob Carbon: `FormLabel`/`FormControl` viram props `invalid`/`invalidText`.
5. `@carbon/styles` é Sass, com normalize próprio de alta especificidade, e briga com o preflight do Tailwind.
6. `@carbon/react` v11 não marca todos os exports com `"use client"`, e o app é Next 16 App Router.
7. Os 19 primitivos atuais carregam `data-slot`, com seletores dependentes em `globals.css`, `card.tsx`, `select.tsx`, `dialog.tsx` — trocar o runtime quebraria esses seletores.

Custo real estimado: reescrita de 60–70% do JSX do app, sem ganho funcional, com risco alto de parar no meio e ficar metade-Carbon (pior que qualquer um dos dois estados). O híbrido — token oficial + runtime próprio — atende a regra de honestidade da skill de design (não recriar a paleta/tipografia Carbon "a mão": os valores vêm dos pacotes oficiais, inspecionados em `node_modules` e documentados no apêndice de tokens do `DESIGN.md`), sem forçar a reescrita de componente que a skill não cobre (dashboards e data tables de produto estão fora do escopo dela).

Decisões derivadas:

- **Manter `lucide-react`** (override explícito). A skill de design desencoraja bibliotecas de ícone genéricas em favor de um sistema de ícone dedicado, mas ela mesma permite a exceção quando o projeto já depende de uma — este app usa mais de 60 glifos em 20 arquivos. Trocar para `@carbon/icons-react` seria puramente cosmético (ambos são glifos-linha de peso comparável) e reintroduziria o mesmo custo de reescrita rejeitado acima. Padronizar `strokeWidth={2}` em todos os usos.
- **Manter Recharts.** `@carbon/charts-react` puxaria `d3` como dependência nova, e a Fase 4 (home do dashboard) vai criar ~8 gráficos adicionais sobre a base atual — trocar de biblioteca no meio do trabalho de gráficos seria puro churn. A paleta de série (`--chart-1..5`) e o estilo do tooltip (`lib/chart.ts`) são re-tokenizados para a paleta data-viz oficial da Carbon; o componente em si continua sendo Recharts.
- **Remover a variante `dark` (`@custom-variant dark` e `className="dark"` em `layout.tsx`).** O tema escuro da Carbon (Gray-100) não foi extraído no novo `DESIGN.md` — o próprio arquivo admite isso em "Known Gaps". Deixar a variante órfã no CSS depois que a classe some do `<html>` é uma armadilha de bug silencioso: qualquer `dark:` residual (ex. `dropdown-menu.tsx`) nunca mais dispara, e ninguém percebe até o dia em que alguém reintroduz a classe sem saber que o tema escuro nunca foi implementado. Melhor eliminar a variante agora e tratar cada `dark:` residual como dívida explícita (relatada, corrigida na Etapa 3) do que manter código morto que finge suportar dois temas.

Alternativas rejeitadas:

- **`@carbon/react` puro** — ver custo real acima; rejeitado por reescrita desproporcional ao ganho.
- **Re-tokenizar sem pacote oficial** (só copiar os hex do `DESIGN.md` para `globals.css` na mão) — rejeitada porque o `DESIGN.md` novo não define valor para ~25 dos tokens que referencia; copiar às cegas seria adivinhação, não implementação. Os valores vêm dos pacotes de token instalados, com a origem (pacote + export) registrada no apêndice do `DESIGN.md`.
- **Trocar `lucide-react` por `@carbon/icons-react`** — rejeitada por custo (20 arquivos) sem ganho visual real, com override registrado acima.
- **Extrair o tema Gray-100 da Carbon e manter uma variante dark** — rejeitada porque o `DESIGN.md` novo não documenta esse tema (é `Known Gap` explícito); manter uma variante que não foi desenhada é pior que não ter variante nenhuma.
