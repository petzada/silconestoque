# Categoria de produto separada de Setor de colaborador

"Setor" nomeava dois conceitos distintos: a classificação do produto (EPIs, Copa e Limpeza — tabela `sectors`) e o departamento de lotação do colaborador (Produção, Logística — que já vivia na tabela própria `departments`, mas continuava se chamando "Setor" na UI junto com o setor de produto). Decidimos separá-los também na linguagem e no modelo do produto: produto passa a ter **Categoria** (nova tabela `categories`); **Setor** fica reservado ao departamento real da empresa, onde colaboradores são lotados (`departments`).

Consequências:

- O gráfico "Gasto por Setor" do dashboard media, na verdade, gasto por categoria de material — passou a chamar-se "Gasto por Categoria".
- Abre caminho para um futuro "Consumo por Setor" verdadeiro, derivado do setor do colaborador solicitante na Saída.
- Migração: nova tabela `categories` populada a partir dos setores referenciados por produtos, `products.category_id` substitui `sector_id`, e renomeação nas telas de Produtos, Sugestões, Dashboard, Movimentações e filtros. A tela "Setores" passa a gerenciar `departments`; a tabela `sectors` vira legado não referenciado, mantida apenas para instalações existentes.

Alternativas rejeitadas: manter a tabela única documentando a ambiguidade (barato, mas o gráfico continuaria com nome enganoso e a lista continuaria misturando conceitos); atribuir gasto pelo setor do solicitante (exigiria solicitante identificado em toda saída, que decidimos não obrigar).
