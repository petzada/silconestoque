# Fase 2 — Colaborador como Solicitante na Saída de Materiais — Design

**Data:** 2026-07-13
**Status:** Aprovado pelo usuário (brainstorming concluído)
**Pré-requisito:** módulo Chapas & Armários + Colaboradores implementado
(`docs/superpowers/specs/2026-07-13-chapas-armarios-design.md`) — depende das
tabelas `employees`/`roles` e das páginas `/employees`.

## Objetivo

Na SAÍDA de material, permitir selecionar o solicitante a partir do cadastro global
de colaboradores, mantendo a opção de texto livre (visitantes/terceiros) e o caráter
opcional do campo. Habilitar filtro de movimentações por colaborador e histórico de
retiradas no cadastro do colaborador.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Comportamento do campo | Combobox com busca em colaboradores ativos **+ texto livre**; continua opcional |
| Entrada (Fornecedor) | Sem mudança — permanece Input de texto livre |
| Armazenamento | FK `employee_id` em `movements` + snapshot do nome em `entity_name` |
| Backfill | Nenhum — movimentações antigas ficam com `employee_id` nulo |
| Usos habilitados | Filtro por colaborador na tela de Movimentações; histórico de retiradas na página Colaboradores |

## Banco de dados

Migração aditiva e idempotente (padrão do projeto):

```sql
ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movements_employee ON movements(employee_id);
```

- `ON DELETE SET NULL`: se um colaborador for removido (caso extremo — o fluxo
  normal é desligar), a movimentação sobrevive com o nome preservado em
  `entity_name`.
- Sem alteração em triggers existentes (estoque/preço/estorno não dependem de
  `employee_id`).

## Comportamento

### Formulário de movimentação (`app/(dashboard)/movements/page.tsx`)

- **Tipo OUT:** o Input "Solicitante" vira combobox com busca (`Command` +
  `Popover`, já existentes no projeto):
  - Digitação filtra colaboradores **ativos** por nome.
  - Selecionar um colaborador grava `employee_id` e copia `full_name` para
    `entity_name` (snapshot histórico).
  - Item "Usar '<texto digitado>'" grava apenas `entity_name`
    (`employee_id = NULL`) — cobre visitantes e terceirizados.
  - Campo vazio continua permitido (opcional, comportamento atual).
- **Tipo IN:** campo "Fornecedor" inalterado (Input texto livre;
  `employee_id` sempre `NULL`).

### Tela de Movimentações

- Novo filtro "Colaborador" junto aos filtros existentes (`MovementFilters` ganha
  `employeeId`): filtra por `employee_id` — não por texto — para resultado
  confiável com homônimos. Lista de opções: **todos os colaboradores, inclusive
  desligados** (permite consultar retiradas de ex-colaboradores), ordenados por
  nome, desligados ao final com sufixo "(desligado)".
- Coluna "Envolvido" inalterada (exibe `entity_name`); ganha um ícone discreto
  (ex.: `UserCheck`) quando `employee_id` está preenchido, distinguindo vínculo
  real de texto livre. Tooltip: "Colaborador cadastrado".

### Página Colaboradores (`app/(dashboard)/employees/page.tsx`)

- Nova ação "Retiradas" por linha: abre **Sheet** com o histórico de saídas do
  colaborador (`movements` com `type = 'OUT'` e `employee_id = X`), colunas Data,
  Produto, Quantidade, ordenado do mais recente. Colaborador desligado mantém o
  histórico acessível.

## Types (`lib/types.ts`)

- `Movement`: + `employee_id: string | null` e `employee?: Employee`.
- `MovementFormData`: + `employee_id?: string`.
- `MovementFilters`: + `employeeId: string` (`'all'` = sem filtro).

## Tratamento de erros e bordas

- Colaborador desligado após a saída: histórico e vínculo permanecem; combobox só
  oferece ativos para novas saídas.
- Exclusão de movimentação: fluxo atual inalterado (triggers de estorno não tocam
  `employee_id`).
- Falha de FK (colaborador removido entre a busca e o submit): toast amigável e
  refetch da lista.

## Fora do escopo

- Cadastro/lista de fornecedores (entrada permanece texto livre).
- Relatórios agregados de consumo por colaborador (apenas o histórico simples no
  Sheet).
- Backfill de movimentações antigas por casamento de nome.

## Verificação

Saída com colaborador da lista → conferir `employee_id` + nome na coluna; saída com
texto livre → `employee_id` nulo; saída sem solicitante → aceita; filtro por
colaborador retorna apenas as vinculadas; Sheet "Retiradas" lista o histórico
correto; entrada (IN) segue idêntica; dark mode ok.
