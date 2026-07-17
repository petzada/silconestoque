# Follow-up de compras desacoplado do estoque

O Follow-up (Solicitação → Pedido de Compra → Recebimento) é acompanhamento financeiro/logístico de compras e **não** movimenta estoque. Registrar um Recebimento não gera Entrada; a entrada física continua sendo registrada manualmente em Movimentações.

Motivos:

1. O Follow-up acompanha compras que nem sempre são produtos estocáveis do catálogo (serviços, itens avulsos, ativos) — itemizar pedidos contra o catálogo não cobriria os casos reais.
2. Quem acompanha compras (administrativo) não é quem dá entrada física no estoque (almoxarifado); a conferência física manual é desejada, não um defeito.
3. Itemizar pedidos é complexidade desproporcional ao tamanho da operação hoje; o custo da digitação dupla é aceitável.

Consequência assumida: estoque pode divergir do que foi comprado se a entrada manual for esquecida. Não "consertar" isso conectando Recebimento a Entrada sem revisitar este ADR.
