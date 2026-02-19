# Auditoria UI/UX Desktop-First

Projeto auditado: `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque`
Escopo: rotas App Router, layouts, páginas, componentes UI, formulários, tabelas, estados de UI, acessibilidade e consistência visual para uso **apenas desktop**.
Data da auditoria: 2026-02-19

## Suposições
- Uso principal em operação de almoxarifado com alta frequência de consulta/lançamento em tabelas.
- Ambientes-alvo: 1366, 1440 e 1920 px com zoom de navegador entre 90% e 125%.
- Fluxos críticos: `Produtos`, `Movimentações`, `Pedidos`, `Follow-up` e `Setores`.

## 1) Resumo Executivo
- O sistema está funcional e com boa cobertura de fluxos de estoque, mas há riscos importantes de **consistência operacional** e **acessibilidade desktop**.
- Há um risco **P0** no CRUD de movimentações: reversão de estoque em duplicidade na exclusão (lógica da tela + trigger SQL), com impacto direto na confiança dos saldos.
- O padrão visual está relativamente coeso, porém sem padronização forte: larguras de container, densidade tipográfica e botões variam por página.
- Tabelas (núcleo do domínio) não têm ordenação, paginação e sticky header/colunas, reduzindo eficiência em cenários de alto volume.
- Acessibilidade desktop está incompleta: botões icon-only sem `aria-label`/tooltip e ações visíveis apenas em hover prejudicam teclado e discoverability.
- Formulários dependem majoritariamente de validação por toast (sem validação inline), elevando retrabalho de preenchimento.
- Há uso extensivo de cores hardcoded (`#387146` etc.), enfraquecendo tokens e manutenção visual de longo prazo.
- Estados de erro/sucesso são majoritariamente transitórios (toast), sem contexto persistente na tela.
- Há sinais de arquitetura “mobile-first residual” (drawer/hambúrguer) que não agrega para o cenário desktop-only.

## 2) Desktop UX Checklist (Padrão Interno)
Use como checklist de PR/review (marcar Sim/Não).

### Layout e navegação
- [ ] Todas as páginas usam o mesmo container base (`max-width`, `gutter`, `padding-top`) definido em componente único.
- [ ] Layout desktop tem sidebar persistente/colapsável sem padrões mobile desnecessários.
- [ ] Header de página e barra de filtros mantêm posição previsível em scroll longo.
- [ ] Navegação lateral tem foco visível e `aria-current` no item ativo.

### Tabelas/listas
- [ ] Tabelas críticas possuem ordenação por coluna.
- [ ] Tabelas críticas possuem paginação (ou virtualização) com total de registros.
- [ ] Colunas numéricas/monetárias têm alinhamento consistente à direita.
- [ ] Cabeçalho de tabela é sticky quando há alto volume.
- [ ] Células truncadas possuem tooltip/fallback acessível também por teclado.
- [ ] Empty state existe para tabela vazia e para resultado de filtro vazio.

### Formulários e CRUD
- [ ] Campos obrigatórios exibem erro inline (não apenas toast).
- [ ] Labels e inputs estão semanticamente conectados (`htmlFor` + `id`).
- [ ] Campos numéricos têm limites (`min`, `step`) e mensagens claras.
- [ ] Fechamento de modal com formulário sujo pede confirmação.
- [ ] Ações destrutivas sempre usam modal de confirmação padronizado.
- [ ] Rótulos de CTA seguem padrão: `Salvar`, `Cancelar`, `Excluir`.

### Estados e feedback
- [ ] Loading de tabelas/cards usa skeleton contextual.
- [ ] Erros importantes têm exibição persistente na tela (além de toast).
- [ ] Sucesso crítico (ex.: exclusão, importação) deixa rastro visual/contextual.

### Acessibilidade desktop
- [ ] Todos os botões icon-only têm `aria-label` e tooltip.
- [ ] Controles “aparecem no hover” também aparecem em `focus-within`.
- [ ] Ordem de tab é lógica nos modais e barras de ação.
- [ ] Tipografia mínima operacional é legível (evitar corpo em 9-10px).

### Tokens e CSS
- [ ] Cores de marca e estados vêm de tokens (sem hex hardcoded em páginas).
- [ ] Spacing/radius/font-size vêm de escala padronizada.
- [ ] Não há estilos globais de alto risco que vazem para todo o app.

## 3) Achados Detalhados

## Layout & Grid

### A01. Containers e gutters inconsistentes entre páginas
- Severidade: **P1 alto**
- Impacto no usuário: sensação de “tela mudando de estrutura” entre módulos, perda de previsibilidade visual e de varredura.
- Evidência no código:
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/dashboard/page.tsx:253` (`max-w-[1700px]`)
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/products/page.tsx:445` (`max-w-[1700px]`)
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/movements/page.tsx:199` (`max-w-[1700px]`)
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/purchase-orders/page.tsx:133` (`max-w-[1700px]`)
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/sectors/page.tsx:98` (`max-w-[1200px]`)
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/settings/page.tsx:111` (`max-w-[1000px]`)
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/follow-up/page.tsx:399` (sem `max-w`, apenas `space-y-6`)
- Recomendação objetiva de correção:
  - Criar componente base `PageContainer` com largura única por tipo de tela (`data-dense` vs `form-centric`).
  - Padronizar gutters (ex.: `px-6` desktop) e aplicar em todas as páginas.
  - Validação: comparar alinhamento horizontal entre 1366/1440/1920 (zoom 90/100/125%).
- Regra padrão sugerida:
  - “Toda rota de dashboard deve iniciar com `PageContainer` + `PageHeader`.”

### A02. Padding horizontal duplicado entre layout e páginas
- Severidade: **P2 médio**
- Impacto no usuário: área útil de tabela reduzida desnecessariamente; aumenta scroll horizontal/vertical em dados densos.
- Evidência no código:
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/layout.tsx:40` (`p-4 lg:p-8`)
  - Somado a padding interno de páginas, ex.: `app/(dashboard)/products/page.tsx:445`, `app/(dashboard)/movements/page.tsx:199`.
- Recomendação objetiva de correção:
  - Centralizar espaçamento em um único nível (layout ou página, não ambos).
  - Validação: medir largura útil das tabelas antes/depois em 1366 @125%.

### A03. Estratégia desktop-first incompleta (padrões mobile residuais)
- Severidade: **P3 baixo**
- Impacto no usuário: não quebra desktop, mas adiciona complexidade e dívida de manutenção em layout focado exclusivamente em desktop.
- Evidência no código:
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/components/sidebar.tsx:91-109` (hambúrguer/drawer mobile)
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/layout.tsx:40` (`pt-16` para compensar menu mobile)
- Recomendação objetiva de correção:
  - Em modo desktop-only, simplificar para sidebar persistente com opção colapsável.
  - Validação: remover dependência de offset para menu mobile e verificar consistência do topo.

## Navegação

### N01. Itens da sidebar sem estilo explícito de foco visível
- Severidade: **P1 alto**
- Impacto no usuário: navegação por teclado sem indicador claro de foco ativo.
- Evidência no código:
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/components/sidebar.tsx:142`
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/components/sidebar.tsx:169`
  - Classes incluem hover/active, mas sem `focus-visible:*` nos links.
- Recomendação objetiva de correção:
  - Adicionar `focus-visible:ring-*` e `focus-visible:outline-*` nos links de navegação.
  - Adicionar `aria-current="page"` no item ativo.
  - Validação: percorrer sidebar somente com `Tab`.
- Regra padrão sugerida:
  - “Todo elemento navegável deve ter estados `hover`, `active` e `focus-visible`.”

### N02. Regra de rota ativa frágil para sub-rotas
- Severidade: **P3 baixo**
- Impacto no usuário: futuras sub-rotas podem perder destaque de navegação ativa.
- Evidência no código:
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/components/sidebar.tsx:138` (`pathname === item.href`)
- Recomendação objetiva de correção:
  - Usar comparação por prefixo controlada (`startsWith`) para seções com sub-rotas.

## Tabelas/Listas

### T01. Tabelas críticas sem ordenação por coluna
- Severidade: **P1 alto**
- Impacto no usuário: lentidão para localizar outliers (ex.: maior consumo, menor saldo, últimas entradas).
- Evidência no código:
  - Cabeçalhos estáticos em:
    - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/products/page.tsx:484-490`
    - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/movements/page.tsx:236-243`
    - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/sectors/page.tsx:110-111`
- Recomendação objetiva de correção:
  - Adotar `DataTable` base com sort por coluna e indicador visual de ordenação.
  - Validação: ordenar por saldo, custo e data/hora em cenário real.
- Regra padrão sugerida:
  - “Toda tabela operacional com mais de 5 colunas deve suportar sorting.”

### T02. Ausência de paginação/virtualização e limite silencioso de dados
- Severidade: **P1 alto**
- Impacto no usuário: perda de histórico visível (`movements` limita 100 registros) e degradação de performance em listas grandes.
- Evidência no código:
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/(dashboard)/movements/page.tsx:102` (`.limit(100)`)
  - Renderização total em memória:
    - `app/(dashboard)/products/page.tsx:430-432`, `:494`
    - `app/(dashboard)/movements/page.tsx:190-193`, `:247`
- Recomendação objetiva de correção:
  - Paginação server-side com total de registros e estado de página.
  - Virtualização para cenários > 500 linhas simultâneas.
  - Validação: benchmark de render e navegação com base de dados volumosa.

### T03. Empty state ausente nas tabelas principais
- Severidade: **P2 médio**
- Impacto no usuário: tabela vazia sem explicação parece falha do sistema.
- Evidência no código:
  - `products`: `app/(dashboard)/products/page.tsx:494` (apenas `filteredProducts.map`)
  - `movements`: `app/(dashboard)/movements/page.tsx:247` (apenas `filteredMovements.map`)
  - `sectors`: `app/(dashboard)/sectors/page.tsx:115` (apenas `sectors.map`)
- Recomendação objetiva de correção:
  - Exibir mensagem contextual + CTA quando coleção filtrada/vazia.

### T04. Dupla camada de scroll horizontal em tabelas
- Severidade: **P2 médio**
- Impacto no usuário: comportamento de scroll inconsistente e possível scrollbar duplicada.
- Evidência no código:
  - Wrapper no componente base: `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/components/ui/table.tsx:11`
  - Wrapper adicional nas páginas:
    - `app/(dashboard)/products/page.tsx:480`
    - `app/(dashboard)/movements/page.tsx:232`
- Recomendação objetiva de correção:
  - Manter apenas um container de scroll horizontal no `DataTable` base.

### T05. Conteúdo truncado sem padrão de tooltip acessível
- Severidade: **P2 médio**
- Impacto no usuário: perda de informação (descrição, entidade, fornecedor) em inspeção rápida.
- Evidência no código:
  - Truncado sem `title/tooltip`:
    - `app/(dashboard)/follow-up/page.tsx:460`
    - `app/(dashboard)/movements/page.tsx:266`
  - Há uso parcial de `title` em outras telas (inconsistente):
    - `app/(dashboard)/products/page.tsx:502`
    - `app/(dashboard)/movements/page.tsx:254`
- Recomendação objetiva de correção:
  - Componente padrão `TruncatedCell` com tooltip em hover e foco.

### T06. Falta de sticky header em telas data-dense
- Severidade: **P2 médio**
- Impacto no usuário: perda de contexto de coluna durante scroll longo.
- Evidência no código:
  - Não há uso de classes `sticky` em `app/` e `components/` para tabelas.
- Recomendação objetiva de correção:
  - Aplicar sticky header nas tabelas principais (`products`, `movements`).

## Formulários

### F01. Labels sem associação semântica na maioria dos formulários
- Severidade: **P1 alto**
- Impacto no usuário: pior acessibilidade e menor área de clique no rótulo.
- Evidência no código:
  - Labels sem `htmlFor` em formulários críticos:
    - `app/(dashboard)/products/page.tsx:546-576`
    - `app/(dashboard)/movements/page.tsx:328-375`
    - `app/(dashboard)/follow-up/page.tsx:639-746`
  - Apenas dois casos com `htmlFor` encontrados:
    - `app/login/page.tsx:85`
    - `app/(dashboard)/sectors/page.tsx:135`
- Recomendação objetiva de correção:
  - Padronizar formulário com `FormField/FormLabel/FormControl` e `id` obrigatório.

### F02. Validação apenas por toast (sem erro inline)
- Severidade: **P1 alto**
- Impacto no usuário: usuário não identifica rapidamente qual campo corrigir.
- Evidência no código:
  - `app/(dashboard)/products/page.tsx:216-217`
  - `app/(dashboard)/movements/page.tsx:160-161`
  - `app/(dashboard)/follow-up/page.tsx:232`, `:275`, `:319`
- Recomendação objetiva de correção:
  - Exibir erro por campo e focar automaticamente no primeiro inválido.
- Regra padrão sugerida:
  - “Toast não substitui validação inline em formulário de entrada de dados.”

### F03. Campos numéricos sem restrições mínimas
- Severidade: **P1 alto**
- Impacto no usuário: entradas inválidas (negativas/zero) com coerção silenciosa para `0`.
- Evidência no código:
  - `app/(dashboard)/movements/page.tsx:359`
  - `app/(dashboard)/products/page.tsx:572`, `:576`
  - Parse com fallback silencioso: `parseInt(...) || 0`
- Recomendação objetiva de correção:
  - Definir `min`, `step`, validação de domínio e mensagem contextual.

### F04. Máscara de data permissiva sem validação de calendário
- Severidade: **P2 médio**
- Impacto no usuário: datas inválidas podem ser aceitas no input e só falhar depois.
- Evidência no código:
  - `app/(dashboard)/follow-up/page.tsx:54-67` (`applyDateMask`/`parseDateInput`)
  - Uso em inputs: `:651-653`, `:709-711`
- Recomendação objetiva de correção:
  - Substituir por date picker desktop-friendly ou parser robusto com mensagem inline.

### F05. Rótulos de CTA inconsistentes
- Severidade: **P3 baixo**
- Impacto no usuário: fricção cognitiva entre fluxos semelhantes.
- Evidência no código:
  - `Finalizar`: `app/(dashboard)/products/page.tsx:581`
  - `Confirmar`: `app/(dashboard)/movements/page.tsx:384`
  - `Salvar`: `app/(dashboard)/sectors/page.tsx:140`
  - `Sair`: `app/(dashboard)/movements/page.tsx:383`, `app/(dashboard)/sectors/page.tsx:139`
  - `Fechar`: `app/(dashboard)/purchase-orders/page.tsx:210`
- Recomendação objetiva de correção:
  - Definir guideline textual único para ações primárias/secundárias.

### F06. Fechamento de modal sem prevenção de perda de dados
- Severidade: **P2 médio**
- Impacto no usuário: perda de preenchimento ao clicar fora/ESC.
- Evidência no código:
  - Diálogos com `onOpenChange` direto, sem guard de dirty form:
    - `app/(dashboard)/products/page.tsx:539`
    - `app/(dashboard)/movements/page.tsx:318`
    - `app/(dashboard)/follow-up/page.tsx:629`, `:678`, `:727`
- Recomendação objetiva de correção:
  - Implementar `isDirty` + confirmação antes de fechar.

## Componentes (modals/dropdowns/tooltips/toasts)

### C01. Botões icon-only sem `aria-label` e sem tooltip
- Severidade: **P1 alto**
- Impacto no usuário: ação não é autodescritiva para teclado/leitores de tela.
- Evidência no código:
  - `app/(dashboard)/products/page.tsx:519-525`
  - `app/(dashboard)/movements/page.tsx:285-289`
  - `app/(dashboard)/sectors/page.tsx:120-121`
  - `app/(dashboard)/follow-up/page.tsx:489-490`, `:558-559`
  - Não há ocorrência de `aria-label` nas páginas auditadas.
- Recomendação objetiva de correção:
  - Adicionar `aria-label` em todos os icon buttons e `Tooltip` padronizado.
- Regra padrão sugerida:
  - “Qualquer botão sem texto visível deve ter `aria-label` + tooltip.”

### C02. Ações destrutivas com padrões inconsistentes
- Severidade: **P1 alto**
- Impacto no usuário: risco de exclusão acidental e experiência inconsistente.
- Evidência no código:
  - Uso de `confirm()` nativo: `app/(dashboard)/sectors/page.tsx:84`
  - Deleção de recebimento sem confirmação modal dedicada: `app/(dashboard)/follow-up/page.tsx:561-562`
  - Outras telas usam `Dialog` de confirmação (padrão divergente).
- Recomendação objetiva de correção:
  - Centralizar em `ConfirmDialog` único (mensagem, risco, CTA destrutivo).

### C03. Popover de busca com largura fixa rígida
- Severidade: **P2 médio**
- Impacto no usuário: clipping/overflow em zoom 125% ou janelas menores.
- Evidência no código:
  - `app/(dashboard)/movements/page.tsx:336` (`w-[400px]`)
- Recomendação objetiva de correção:
  - Usar `min-w`/`max-w` responsivo e posicionamento adaptativo.

### C04. Texto acessível (sr-only) em inglês em app PT-BR
- Severidade: **P3 baixo**
- Impacto no usuário: inconsistência de idioma para tecnologias assistivas.
- Evidência no código:
  - `components/ui/dialog.tsx:76` (`Close`)
  - `components/ui/sheet.tsx:80` (`Close`)
- Recomendação objetiva de correção:
  - Padronizar strings acessíveis em PT-BR por token.

## Estados de UI (loading/empty/error)

### U01. Loading states simples (texto pulsante), sem skeleton contextual
- Severidade: **P2 médio**
- Impacto no usuário: percepção de lentidão e layout shift.
- Evidência no código:
  - `app/(dashboard)/products/page.tsx:442`
  - `app/(dashboard)/movements/page.tsx:196`
  - `app/(dashboard)/dashboard/page.tsx:247`
  - `app/(dashboard)/layout.tsx:27`
- Recomendação objetiva de correção:
  - Introduzir skeletons por contexto (cards, tabela, formulário).

### U02. Erros/sucesso quase sempre só por toast
- Severidade: **P2 médio**
- Impacto no usuário: feedback desaparece rápido e sem rastro no contexto da tela.
- Evidência no código:
  - Padrão recorrente em `catch`: ex. `app/(dashboard)/products/page.tsx:142`, `:205`, `:252`, `:417`
  - `app/(dashboard)/movements/page.tsx:113`, `:155`, `:184`
- Recomendação objetiva de correção:
  - Exibir `Alert` persistente próximo ao bloco afetado quando erro impedir tarefa.

## Acessibilidade (teclado/foco/aria)

### AC01. Controles aparecem apenas em hover
- Severidade: **P1 alto**
- Impacto no usuário: teclado não tem discoverability equivalente ao mouse.
- Evidência no código:
  - `app/(dashboard)/sectors/page.tsx:119` (`opacity-0 group-hover:opacity-100`)
  - `app/(dashboard)/follow-up/page.tsx:559` (mesmo padrão)
- Recomendação objetiva de correção:
  - Adicionar `group-focus-within:opacity-100` e foco visual consistente.

### AC02. Densidade tipográfica excessiva (9-10px em pontos críticos)
- Severidade: **P2 médio**
- Impacto no usuário: baixa legibilidade em monitor/zoom operacional.
- Evidência no código:
  - Ocorrências amplas de `text-[9px]`/`text-[10px]` em tabelas e labels:
    - `app/(dashboard)/movements/page.tsx:236-243`, `:255`, `:278`
    - `app/(dashboard)/products/page.tsx:484-490`, `:508`, `:515`
    - `app/(dashboard)/follow-up/page.tsx:76`, `:475`, `:639` etc.
- Recomendação objetiva de correção:
  - Definir mínimo tipográfico para operação desktop (ex.: 12px em microcopy funcional).

### AC03. Ausência de atalhos de teclado em fluxos frequentes
- Severidade: **P3 baixo**
- Impacto no usuário: menor eficiência para usuários avançados de almoxarifado.
- Evidência no código:
  - Não há handlers de hotkey (`onKeyDown`, `metaKey`, `ctrlKey`) nas páginas auditadas.
- Recomendação objetiva de correção:
  - Definir atalhos para ações frequentes (novo item, buscar, salvar, confirmar saída).

## CSS/Theme/Tokens

### CS01. Cores hardcoded espalhadas (sem semântica de token)
- Severidade: **P2 médio**
- Impacto no usuário: inconsistência visual e manutenção cara.
- Evidência no código:
  - Exemplos com `#387146`/`#2b5836`:
    - `components/sidebar.tsx:108`, `:144`, `:151`, `:171`
    - `app/login/page.tsx:60`, `:67`, `:96`, `:105`
    - `app/(dashboard)/products/page.tsx:452`, `:581`, `:699`
    - `app/(dashboard)/movements/page.tsx:203`, `:225`, `:384`
- Recomendação objetiva de correção:
  - Promover tokens semânticos (`--brand-primary`, `--brand-primary-hover`, etc.) e classes utilitárias comuns.
- Regra padrão sugerida:
  - “Não usar hex em página; usar apenas token semântico.”

### CS02. Estilo global agressivo no seletor universal
- Severidade: **P2 médio**
- Impacto no usuário: risco de vazamento de estilo (borda/outline/font) em elementos de terceiros.
- Evidência no código:
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/app/globals.css:119-121`
- Recomendação objetiva de correção:
  - Restringir estilos base a elementos específicos (body, form controls) e evitar `*` para outline.

### CS03. Estilo de scrollbar injetado via `style jsx global` no componente
- Severidade: **P3 baixo**
- Impacto no usuário: acoplamento e comportamento inconsistente entre engines.
- Evidência no código:
  - `c:/Users/MARCIO.PETIGROSSO/Desktop/silconestoque/components/sidebar.tsx:196-198`
- Recomendação objetiva de correção:
  - Mover para arquivo global de tema com classe utilitária documentada.

## Consistência Geral

### G01. Padrões de CRUD divergentes entre módulos
- Severidade: **P2 médio**
- Impacto no usuário: curva de aprendizagem maior e erros operacionais por mudança de padrão.
- Evidência no código:
  - Confirmação destrutiva com `Dialog`: `products/page.tsx:588`, `movements/page.tsx:300`, `follow-up/page.tsx:768`
  - Confirmação destrutiva com `confirm()` nativo: `sectors/page.tsx:84`
  - CTAs variam (`Salvar`, `Finalizar`, `Confirmar`, `Sair`, `Fechar`) em múltiplas telas.
- Recomendação objetiva de correção:
  - Definir guideline único de CRUD e extrair componentes base de ação.

### G02. Risco funcional crítico no fluxo de exclusão de movimentação (afeta UX de confiança)
- Severidade: **P0 crítico**
- Impacto no usuário: saldo de estoque pode ficar incorreto após exclusão, comprometendo decisões de compra/baixa.
- Evidência no código:
  - Ajuste manual de estoque antes de excluir: `app/(dashboard)/movements/page.tsx:142`
  - Exclusão da movimentação em seguida: `app/(dashboard)/movements/page.tsx:147`
  - Trigger SQL já reverte estoque no `DELETE`: `supabase/schema.sql:163-207`
- Recomendação objetiva de correção:
  - Escolher **uma única fonte de verdade** para reversão (UI ou trigger; idealmente trigger).
  - Validação: teste de exclusão de entrada/saída verificando saldo final esperado.

## 4) Itens Recomendados para Padronização

### 4.1 Componentes base
- Criar `PageContainer` (largura/gutter/padding padrão desktop).
- Criar `PageHeader` (título, ações primárias e secundárias).
- Criar `FilterBar` (busca + filtros com spacing e altura padrão).
- Criar `DataTable` base com: sort, paginação, empty state, sticky header, célula truncada com tooltip.
- Criar `ConfirmDialog` único para ações destrutivas.
- Criar `FormDialog` base com footer padrão (`Cancelar`/`Salvar`) e proteção de dirty state.

### 4.2 Design tokens e guidelines
- Definir tokens semânticos de cor de marca e estados (`success`, `warning`, `critical`, `info`).
- Definir escala tipográfica mínima para operação (evitar corpo operacional em 9-10px).
- Definir escala de espaçamento por contexto (`compact`, `comfortable`, `data-dense`).
- Definir guideline de nomenclatura de CTA (ex.: `Salvar`, `Cancelar`, `Excluir`).

### 4.3 Acessibilidade operacional
- Política para icon-only: obrigatório `aria-label` + tooltip.
- Política para hover-only: sempre par com `focus-within`.
- Política de tab order: fluxo previsível em modal e tabela.

## 5) Plano de Ação Priorizado

### Quick wins (baixo esforço / alto impacto)
1. Padronizar labels de botões (`Salvar/Cancelar/Excluir`) em todos os modais.
2. Adicionar `aria-label` nos botões icon-only e incluir tooltip padrão.
3. Remover ações somente em hover (usar `focus-within`).
4. Incluir empty state nas tabelas de `Produtos`, `Movimentações` e `Setores`.
5. Reduzir hardcoded de cor mais repetido (`#387146`) via token semântico inicial.
6. Ajustar tipografia mínima de cabeçalhos/células críticas para legibilidade desktop.

### Refactors necessários (médio/alto esforço)
1. Criar `PageContainer` e unificar largura/gutters em todas as rotas do dashboard.
2. Criar `DataTable` padrão com sort + paginação + sticky header.
3. Migrar validações para padrão inline (react-hook-form + zod + mensagens por campo).
4. Implementar guard de formulário sujo em modais.
5. Unificar padrão de confirmação destrutiva com `ConfirmDialog` reutilizável.
6. Resolver o fluxo de exclusão de movimentação para evitar reversão dupla de estoque (P0).

### Dívidas técnicas (monitorar)
1. Revisar uso de seletor universal em `globals.css` para reduzir vazamento de estilo.
2. Revisar estilos globais de scrollbar e estratégia cross-browser.
3. Revisar limite fixo de histórico (`movements.limit(100)`) conforme crescimento de dados.

---

## Observação final
A base atual já entrega os fluxos principais de almoxarifado, porém o ganho de produtividade desktop virá principalmente da padronização de tabelas/formulários e da correção dos pontos críticos de consistência operacional e acessibilidade.
