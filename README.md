# Silcon Estoque

![Status](https://img.shields.io/badge/status-em%20desenvolvimento%20ativo-brightgreen) ![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)

Sistema web de **controle de estoque do almoxarifado** da Silcon Ambiental (gestão de resíduos hospitalares): substitui planilhas por um painel com saldos, custos, alertas de reposição e pedidos de compra.

🔗 **Em produção:** [silconestoque.vercel.app](https://silconestoque.vercel.app)

## Índice

- [Status do projeto](#status-do-projeto)
- [Demonstração](#demonstração)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Pré-requisitos e instalação](#pré-requisitos-e-instalação)
- [Como utilizar](#como-utilizar)
- [Segurança](#segurança)
- [Testes](#testes)
- [Contribuição](#contribuição)
- [Licença](#licença)
- [Autor e contato](#autor-e-contato)

## Status do projeto

🟢 **Em desenvolvimento ativo**: em uso pela empresa, com melhorias e correções contínuas.

## Demonstração

**Painel (dashboard)**
- KPIs de entradas e saídas em R$, itens críticos e estoque zerado, com filtros por mês, ano e setor.
- Gráfico de gastos por setor e ranking dos produtos mais consumidos.
- **Alerta de inflação** quando o preço de um item sobe 15% ou mais e projeção de dias até atingir o estoque mínimo.
- Fila de reposição com os produtos abaixo do mínimo.

**Catálogo de produtos**
- Cadastro com SKU, unidade, categoria, setor, estoque mínimo e máximo.
- Status visual **ESTÁVEL**, **CRÍTICO** e **ZERADO**, importação em massa por CSV e histórico de preços.

**Movimentações**
- Entradas (compras com nota fiscal) e saídas (consumo por solicitante), com saldo atualizado por *triggers* SQL e custo congelado no momento da saída.

**Outros módulos**
- **Pedidos de compra** emergenciais e de reposição mensal, com exportação em **PDF**.
- **Colaboradores** (importação por CSV), **armários** e **quiz de segurança** do trabalho.
- Setores e categorias.

## Tecnologias utilizadas

| Tecnologia | Uso |
|---|---|
| **Next.js 16** + **React 19** + **TypeScript** | Aplicação web (App Router) |
| **Tailwind CSS** + **shadcn/ui** (Radix) | Interface |
| **Supabase** (Postgres + Auth + RLS) | Banco, autenticação e regras de acesso |
| **Recharts** | Gráficos |
| **jsPDF** + jspdf-autotable | Geração de PDFs |
| **React Hook Form** + **Zod** | Formulários e validação |
| **Vercel** | Hospedagem |

## Pré-requisitos e instalação

**Pré-requisitos**

- **Node.js 18** ou superior e npm
- Um projeto no [Supabase](https://supabase.com)

**Instalação**

```bash
git clone https://github.com/petzada/silconestoque.git
cd silconestoque
npm install
```

Crie o arquivo `.env.local` na raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
```

No **SQL Editor** do Supabase, rode `supabase/schema.sql` e depois as migrations da pasta `supabase/` na ordem descrita em [`supabase/README.md`](supabase/README.md). Crie os usuários em **Authentication → Users** (o acesso é por e-mail e senha).

## Como utilizar

```bash
npm run dev       # http://localhost:3000
npm run build     # build de produção
npm run start     # serve o build
```

1. Entre com um usuário criado no Supabase.
2. Cadastre setores e produtos (ou importe um CSV).
3. Registre entradas e saídas e acompanhe o painel.
4. Gere o pedido de compra em PDF na tela de pedidos.

O passo a passo de uso diário está em [`docs/como-eu-uso-o-sistema.md`](docs/como-eu-uso-o-sistema.md). Na Vercel, basta importar o repositório e configurar as duas variáveis de ambiente.

## Segurança

- Autenticação individual pelo Supabase Auth; usuários criados só pelo painel.
- **Row Level Security** com políticas `TO authenticated`: a chave anônima sozinha não lê nenhum dado.
- `proxy.ts` (Next.js 16 + `@supabase/ssr`) renova a sessão e protege as rotas no servidor.

## Testes

O projeto ainda **não tem testes automatizados**. A verificação disponível é o lint:

```bash
npm run lint
```

As regras de integridade de saldo ficam no banco (triggers e constraints) e há um script de diagnóstico em `supabase/diagnostico_movimentacoes.sql`.

## Contribuição

Contribuições são bem-vindas! Para propor uma melhoria:

1. Abra uma **issue** descrevendo o problema ou a ideia antes de começar algo grande.
2. Faça um **fork** e crie um branch a partir da `main`: `<tipo>/<nome-kebab>` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
3. Use **commits semânticos** em português: `<tipo>(<escopo>): <descrição no imperativo>`.
4. Rode lint e testes antes de enviar (veja [Testes](#testes)).
5. Abra o **Pull Request** em *draft*, explicando o quê e o porquê. O merge é feito pelo autor.

Não inclua segredos (`.env`, chaves de API, tokens) em commits ou PRs.

## Licença

Distribuído sob a licença **MIT**, de código aberto. Isso significa que você **pode** usar, copiar, modificar, mesclar, publicar, distribuir, sublicenciar e até vender cópias do código, inclusive em projetos comerciais, **desde que** mantenha o aviso de copyright e o texto da licença. O software é fornecido "no estado em que se encontra", **sem garantias**, e o autor não se responsabiliza por danos decorrentes do uso.

Texto completo em [`LICENSE`](LICENSE).

## Autor e contato

**Marcio Petigrosso** ("petzada"): idealização e desenvolvimento.

- GitHub: [@petzada](https://github.com/petzada)
- LinkedIn: [in/petigrosso](https://www.linkedin.com/in/petigrosso)
