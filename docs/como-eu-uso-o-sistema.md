# Silcon Estoque — como eu uso no dia a dia

Sistema interno de gestão do almoxarifado da Silcon Ambiental. Controla o material que a empresa
consome para operar: EPIs, uniformes, produtos de copa e limpeza e afins. Não é o sistema de
resíduos — é o estoque interno que sustenta a operação.

Este documento não é manual técnico. É o relato de como eu opero a ferramenta, o que ela resolve e
por que ela foi construída assim.

---

## 1. O problema que ele resolve

Antes, o controle vivia em planilha. Três coisas quebravam sempre:

- **Ninguém sabia o que estava acabando** até faltar. A descoberta era o pedido do encarregado, não
  um número.
- **Não dava para responder "quanto o setor X gastou no mês"** sem refazer conta na mão.
- **Preço de compra não tinha memória.** O fornecedor subia 30% e passava batido.

O sistema existe para essas três perguntas terem resposta em segundos, e para o registro do que
entra e sai ser feito uma vez só, no momento em que acontece.

---

## 2. Minha rotina — o que faço todo dia

### Abro no Dashboard

A home tem duas abas, e elas respondem perguntas diferentes:

**Operação** — a foto de agora. O que precisa da minha atenção hoje:

- Quantos produtos estão **zerados** e quantos estão **críticos** (abaixo do mínimo).
- **Cobertura em dias**: com o ritmo de consumo dos últimos 90 dias, quantos dias ainda dura o saldo
  atual de cada item. É o número que mais uso — ele antecipa a falta em vez de anunciá-la.
- **Itens por urgência**: zerados primeiro, depois os críticos ordenados por quanto falta em relação
  ao mínimo.
- **Pedidos em atraso**: compras já colocadas cuja entrega estimada já passou.

**Análise** — o comportamento no período. Consumo em R$, compras em R$, número de movimentações e
valor imobilizado em estoque, cada um comparado com o período anterior. Abaixo, a série diária de
consumo e compras, e a quebra por categoria, por setor e por produto.

Filtro por categoria, setor e intervalo de datas. O filtro fica na URL, então mando o link pronto
para quem me pediu o número.

### Registro as movimentações

É o que mais faço no dia. Duas operações, na tela **Movimentações**:

**Entrada** — chegou material. Lanço produto, quantidade, fornecedor e, quando existe, o número da
nota fiscal e o valor unitário pago. O saldo sobe na hora.

**Saída** — alguém retirou material. Lanço produto, quantidade e o solicitante. O solicitante é,
preferencialmente, um colaborador cadastrado — assim a saída herda o setor dele e entra no relatório
de consumo por setor. Aceito nome livre para terceirizado, visitante ou uso geral, sabendo que esse
caso não agrega por setor.

Tenho filtro por tipo, mês, ano, categoria e colaborador, e consigo excluir uma movimentação lançada
errado — a exclusão reverte o saldo, não deixa rastro inconsistente.

### Ponto importante: quando o custo é atualizado

O custo cadastrado de um produto só muda por **entrada com nota fiscal e valor unitário**. Entrada
informal, sem NF, não mexe no preço nem no histórico.

Isso é decisão de projeto, não limitação. A nota fiscal é a garantia de que aquele valor é oficial.
Se qualquer entrada pudesse alterar o custo, o histórico de preços viraria ruído e o relatório
financeiro perderia o sentido.

---

## 3. O que faço na semana — reposição e compras

O fluxo de compra tem quatro telas, e cada uma é um estágio:

**Fila de Reposição** — a lista do que está zerado ou crítico, ordenada por urgência. Exporto em PDF
e é isso que circula com o setor de compras.

**Sugestões de Compra** — o sistema calcula a quantidade a pedir. Dois tipos:

- *Emergencial*: só o que está zerado ou crítico.
- *Mensal*: tudo que está abaixo do estoque máximo, para reposição programada.

Em ambos a quantidade sugerida repõe até o estoque máximo (`máximo − saldo`). A diferença entre os
dois é só o filtro de itens. Também sai em PDF.

A sugestão é **um cálculo, não um compromisso**. Ela não fica salva. Serve para eu decidir, não para
eu obedecer.

**Follow-up** — aqui sim, o compromisso real. Registro a Solicitação (o pedido interno), dela nascem
um ou mais Pedidos de Compra (com número de PO, fornecedor e entrega estimada) e, quando chega, o
Recebimento com fornecedor e valor da nota. É o que me permite responder "cadê aquele pedido de três
semanas atrás".

**Variação de Preço** — a tela que uso para negociar. Ela mostra, por produto, a variação de custo
entre compras, com gráfico da série de preços. O corte padrão é 15%, mas ajusto o limiar. É onde eu
vejo que um item subiu 40% sem ninguém ter notado.

### Uma escolha que sempre explico

**Registrar um Recebimento no Follow-up não dá entrada no estoque.** São coisas separadas, de
propósito, por três motivos:

1. O Follow-up acompanha compras que muitas vezes não são produtos estocáveis — serviços, itens
   avulsos, ativos. Itemizar tudo contra o catálogo não cobriria o caso real.
2. Quem acompanha compra (administrativo) não é quem confere material na doca (almoxarifado). A
   conferência física manual é o controle, não um retrabalho.
3. Amarrar os dois seria complexidade desproporcional ao tamanho da operação hoje.

O custo assumido é a digitação dupla, e ela é consciente.

---

## 4. Os cadastros que sustentam tudo

**Produtos** — catálogo do almoxarifado: SKU, unidade, categoria, estoque mínimo e máximo. Cada
produto mostra o status visual (Estável / Crítico / Zerado) e tem histórico de preços próprio.
Importo em massa por CSV quando é carga inicial. Produto não se apaga: desativa, e o histórico
permanece.

**Categorias** — classificação do produto pelo tipo de material (EPIs, Copa e Limpeza…). Todo
produto pertence a exatamente uma.

**Setores** — os departamentos reais da empresa, onde os colaboradores são lotados.

Categoria e Setor são coisas diferentes e não se misturam: categoria classifica *material*, setor
identifica *quem consome*. Manter os dois separados é o que permite perguntar "quanto a Produção
gastou de EPI" — as duas dimensões cruzam.

**Colaboradores** — nome, setor e função. Importo por CSV. Cada colaborador tem a própria tela de
retiradas: abro e vejo tudo que aquela pessoa tirou do almoxarifado.

**Armários** — controle do vestiário. Dois tipos: armário de uniforme (tem tamanho, P a SSG) e
armário de vestiário. Vejo em grade quais estão ocupados, livres ou inativos, e vinculo colaborador
a armário com data de início e fim. O sistema impede dois ocupantes no mesmo armário e duas
ocupações ativas do mesmo colaborador no mesmo tipo. Crio armários em faixa (do 1 ao 120 de uma vez)
e importo por CSV.

---

## 5. Como está construído

| Camada | Escolha |
|---|---|
| Aplicação | Next.js 16 + React 19 + TypeScript |
| Banco | PostgreSQL (Supabase) |
| Interface | Tailwind CSS, componentes próprios sobre Radix, design system baseado em IBM Carbon |
| Relatórios | jsPDF (exportação em PDF com identidade da empresa) |
| Hospedagem | Vercel, deploy automático a cada push |

**A regra de negócio mora no banco, não na tela.** Saldo é atualizado por trigger SQL; os
indicadores do dashboard são funções (RPCs) do Postgres. A versão anterior baixava a tabela inteira
de movimentações e somava no navegador — o custo crescia junto com o histórico, e a definição de
"item crítico" estava duplicada em três telas. Hoje a definição existe em um lugar só.

**Vocabulário fechado e escrito.** O projeto tem um glossário versionado (`CONTEXT.md`) que define o
que é Entrada, Saída, Item Crítico, Zerado, Solicitante, Pedido de Compra. Termos ambíguos estão
marcados como proibidos. É o que impede a tela dizer "baixa", o relatório dizer "consumo" e a
conversa dizer "saída" para a mesma coisa.

**Decisões registradas.** Toda escolha estrutural — custo congelado na saída, follow-up desacoplado,
categoria separada de setor — está documentada com o motivo e a consequência assumida (`docs/adr/`).
Quem pegar esse código depois de mim sabe *por que* está assim antes de tentar "consertar".

---

## 6. O que ainda não está resolvido

Sou direto sobre isso porque é o que mais importa numa avaliação de TI:

**Autenticação.** Login individual com e-mail e senha (Supabase Auth). Os usuários são criados
pelo desenvolvedor no painel do Supabase — não há tela de cadastro nem recuperação de senha na
app. O banco exige sessão autenticada (RLS); a chave anônima sozinha não lê nem escreve dados.
Movimentações novas gravam `created_by` com o usuário que lançou (rastreabilidade no banco;
exibição na UI ainda não está nesta versão).

**Quiz de segurança.** Rota permanentemente desativada.

**Entrada dupla no follow-up.** Descrita acima. É consciente e custa pouco na escala de hoje; se a
operação crescer, revisita.

---

## Resumo

O sistema faz o almoxarifado deixar de ser memória de uma pessoa e passar a ser um registro
consultável. No dia a dia eu lanço entrada e saída; toda semana leio a fila de reposição, gero a
sugestão de compra e acompanho o que foi pedido; todo mês olho consumo por setor e variação de
preço. As decisões estruturais estão escritas, o vocabulário é fechado, e o que está pendente está
pendente por escolha, com o gatilho de revisão definido.
