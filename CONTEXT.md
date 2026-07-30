# Silcon Estoque

Sistema de gestão de estoque de materiais internos da Silcon Ambiental (gestão de resíduos hospitalares): catálogo de produtos, movimentações de entrada/saída, compras e vestiário de colaboradores.

## Language

### Organização

**Categoria**:
Classificação de um produto pelo tipo de material (EPIs, Copa e Limpeza, ...). Todo produto pertence a exatamente uma Categoria (ver ADR-0003).
_Avoid_: Setor (para produtos), família, grupo

**Setor**:
Departamento real da empresa (Produção, Logística, Manutenção...), onde Colaboradores são lotados.
_Avoid_: Departamento, área

**Colaborador**:
Pessoa do quadro da empresa, com Função e Setor, que pode ser Solicitante de Saídas e ocupar Armários.
_Avoid_: Funcionário, empregado

**Função**:
Cargo do Colaborador (Motorista, Auxiliar de Operação, ...).
_Avoid_: Cargo, papel, role

### Estoque

**Estoque Mínimo**:
Piso de segurança de um produto. Estar exatamente no mínimo é aceitável — ainda não é crítico.

**Item Crítico**:
Produto com saldo **abaixo** do estoque mínimo (`saldo < mínimo`) e acima de zero.
_Avoid_: Item no limite, abaixo do mínimo (como sinônimos informais)

**Zerado**:
Produto com saldo igual a zero. É uma faixa própria, não um subconjunto de Crítico.

**Estável**:
Produto com saldo igual ou acima do estoque mínimo.

**Estoque Máximo**:
Teto de reposição de um produto. As Sugestões de Compra sempre repõem até ele.

**Fila de Reposição**:
Lista de produtos Zerados ou Críticos aguardando compra, ordenada pela urgência.

**Importação Inicial**:
Entrada especial que estabelece o saldo de partida de um produto, sem representar uma compra.

### Vestiário

**Armário**:
Compartimento físico numerado, de um de dois tipos: **de uniforme** (tem tamanho P–SSG) ou **de vestiário**. A numeração é única por tipo.
_Avoid_: Chapa (nome antigo), locker

**Ocupação**:
Vínculo de um Colaborador ativo a um Armário ativo, com início e fim. No máximo um ocupante por armário e uma ocupação ativa por colaborador em cada tipo de armário.
_Avoid_: Atribuição, assignment

**Ocupado**:
Armário ativo com Ocupação em curso.

**Livre**:
Armário ativo sem Ocupação em curso.

**Inativo**:
Armário desativado — não aparece para novas atribuições e o histórico é mantido. Precede os outros dois na classificação: um Armário desativado conta como Inativo mesmo que ainda carregue uma Ocupação registrada (nunca como Ocupado).

### Movimentações

**Entrada**:
Movimentação que aumenta o saldo de um produto (compra ou importação inicial). Pode carregar nota fiscal e valor unitário pago.
_Avoid_: Recebimento (termo do Follow-up), compra (a Entrada registra a chegada física, não o compromisso)

**Saída**:
Movimentação que reduz o saldo de um produto (consumo por um setor/solicitante). Grava o custo unitário vigente no momento do registro (ver ADR-0002).
_Avoid_: Baixa, consumo (como nome da operação)

**Fornecedor**:
Quem vendeu o material numa Entrada. Nome livre — não há cadastro de fornecedores.

**Solicitante**:
Quem retirou o material numa Saída. Preferencialmente um Colaborador cadastrado, mas nome livre é aceito para casos fora do quadro (terceirizados, visitantes, uso geral) — assumindo a fragmentação nos relatórios.
_Avoid_: Requisitante, destinatário

**Custo Cadastrado**:
Último preço de compra conhecido do produto. Atualiza **somente** via Entrada com nota fiscal + valor unitário — a NF é a garantia de valor oficial; entradas informais deliberadamente não mexem no custo nem no Histórico de Preços.
_Avoid_: Preço, valor (sem qualificação)

### Compras

**Sugestão de Compra**:
Lista calculada de itens a repor (Emergencial ou Mensal), gerada sob demanda na tela Sugestões. É um cálculo, não um compromisso — não é persistida. Em ambos os tipos a quantidade sugerida repõe até o Estoque Máximo (`máximo − saldo`); os tipos diferem apenas no filtro de itens.
_Avoid_: Pedido (para a lista gerada), Lista de compras

**Sugestão Emergencial**:
Sugestão de Compra contendo apenas itens Zerados ou Críticos.

**Sugestão Mensal**:
Sugestão de Compra contendo todo item abaixo do Estoque Máximo (reposição programada).

**Pedido de Compra**:
Compromisso real de compra com um fornecedor, persistido no Follow-up, com número de PO, fornecedor e entrega estimada. Pode incluir itens fora do catálogo de produtos (serviços, avulsos).
_Avoid_: Ordem de compra, OC, PO (como termo em prosa; a sigla PO aparece apenas no campo `po_number`)

**Solicitação**:
Pedido interno de compra registrado no Follow-up (número, data, descrição livre), que pode originar um ou mais Pedidos de Compra.
_Avoid_: Requisição

**Recebimento**:
Confirmação de que um Pedido de Compra foi entregue (fornecedor, valor da nota). É acompanhamento financeiro/logístico — não movimenta estoque (ver ADR-0001).
_Avoid_: Entrada (Recebimento ≠ Entrada de estoque)
