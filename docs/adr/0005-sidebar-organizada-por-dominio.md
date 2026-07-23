# Sidebar organizada por domínio

A sidebar misturava dois critérios de agrupamento: "Cadastro" era funcional (o que você faz), "Pessoal" era de domínio (sobre o que é), e "Controle" era um agrupamento residual. Consequências práticas: Setores (departamento de colaboradores desde a ADR-0003) morava ao lado de Produtos; a cadeia de compras estava fatiada em dois grupos (Fila de Reposição e Follow-up em "Controle", Sugestões sozinha em "Relatórios"); e o grupo "Estoque" tinha um único item. Decidimos que o critério de domínio manda na sidebar inteira: **Estoque**, **Compras** e **Pessoal**, com Dashboard solto no topo. Os cadastros vivem dentro do domínio a que pertencem.

Decisões derivadas:

- **Compras agrupa o fluxo inteiro, na ordem do fluxo**: Fila de Reposição → Sugestões de Compra → Follow-up → Variação de Preço. A Fila é a origem da compra (itens Zerados/Críticos), não um relatório; Variação de Preço fica no fim como apoio à decisão de compra (conferir/negociar fornecedor). Os grupos "Controle" e "Relatórios" deixam de existir.
- **Movimentações primeiro em Estoque**: a operação mais frequente do dia fica no topo do grupo; o catálogo (Produtos, Categorias) vem depois.
- **Setores muda para Pessoal**, ao lado de Colaboradores, consolidando a ADR-0003 na navegação.
- **Armários vira uma tela única com abas** (Uniformes / Vestiário): as duas telas usavam os mesmos componentes sobre o mesmo conceito (Armário, com dois tipos — ver glossário). A distinção uniforme × vestiário é um filtro, não duas telas. A rota `/vestiario` redireciona para `/lockers?tab=vestiario`. O termo "Chapa" (proibido pelo glossário) sai da UI.

Alternativas rejeitadas: agrupamento por função (Cadastro/Operação/Análise — espalharia cada domínio por três grupos e manteria a ambiguidade do Setores); manter a Fila de Reposição em Estoque (é um estado do estoque, mas o operador a usa como gatilho de compra); duas entradas renomeadas para armários (corrigiria os rótulos mas manteria a duplicação de tela e de item na sidebar).
