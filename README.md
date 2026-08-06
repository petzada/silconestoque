# 🏭 Silcon Ambiental - Sistema de Gestão de Estoque

Sistema completo de gerenciamento de estoque desenvolvido para a **Silcon Ambiental**, empresa especializada em gestão de resíduos hospitalares.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss)

---

## 📋 Funcionalidades

### Dashboard
- **KPIs em tempo real**: Entradas (R$), Saídas (R$), Itens Críticos, Estoque Zerado
- **Filtros dinâmicos**: Por mês, ano e setor
- **Gráfico de Gastos por Setor**: Visualização de consumo financeiro por departamento
- **Consumo por Produto**: Top 8 produtos mais consumidos (por setor)
- **Alertas de Inflação**: Notificação automática quando preço sobe ≥15%
- **Fila de Reposição**: Produtos abaixo do estoque mínimo

### Catálogo de Produtos
- Cadastro completo com SKU, unidade de medida, setor alocado
- Controle de estoque mínimo e máximo
- Status visual: ESTÁVEL, CRÍTICO, ZERADO
- **Importação em massa via CSV**
- **Histórico de preços por produto**
- Exclusão com deleção em cascata

### Movimentações
- Registro de entradas (compras) e saídas (consumo)
- Vinculação com número de Nota Fiscal
- Atualização automática de estoque via triggers SQL
- Rastreamento de preço pago vs custo cadastrado
- Exclusão individual com reversão de estoque

### Setores
- Cadastro de departamentos/setores da empresa
- Vinculação automática com produtos

### Pedidos de Compra
- Geração automática de pedidos emergenciais (estoque zerado)
- Geração de reposição mensal (até estoque máximo)
- Filtro por setor
- **Exportação em PDF**

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Uso |
|------------|-----|
| **Next.js 16** | Framework React com App Router |
| **TypeScript** | Tipagem estática |
| **Tailwind CSS** | Estilização utility-first |
| **Shadcn/UI** | Componentes de interface |
| **Supabase** | Backend (PostgreSQL + Auth) |
| **Recharts** | Gráficos e visualizações |
| **Lucide React** | Ícones |
| **jsPDF** | Geração de PDFs |
| **Sonner** | Notificações toast |
| **date-fns** | Formatação de datas |

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+
- Conta no Supabase

### 1. Clone o repositório
```bash
git clone https://github.com/petzada/silconestoque.git
cd silconestoque
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env.local` na raiz do projeto:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

### 4. Configure o banco de dados
Execute o schema SQL no Supabase SQL Editor (arquivo disponível na documentação do projeto).

### 5. Execute em desenvolvimento
```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## 📦 Deploy

### Vercel (Recomendado)
1. Importe o repositório na [Vercel](https://vercel.com)
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

---

## 🔐 Segurança

- Autenticação individual via Supabase Auth (e-mail + senha; usuários criados no painel)
- Row Level Security: políticas `TO authenticated` — a anon key sozinha não acessa dados
- Proxy Next.js 16 (`proxy.ts` + `@supabase/ssr`) renova a sessão e protege rotas no servidor
- Variáveis de ambiente para URL e anon key; `.gitignore` protege `.env*`

---

## 📁 Estrutura do Projeto

```
silconestoque/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/     # Página principal
│   │   ├── products/      # Catálogo de produtos
│   │   ├── movements/     # Movimentações
│   │   ├── sectors/       # Setores
│   │   └── purchase-orders/ # Pedidos de compra
│   ├── login/             # Autenticação
│   └── layout.tsx         # Layout raiz
├── components/
│   ├── ui/                # Componentes Shadcn
│   ├── sidebar.tsx        # Navegação lateral
│   └── auth-provider.tsx  # Contexto de autenticação
├── lib/
│   ├── supabase.ts        # Cliente Supabase
│   ├── types.ts           # Tipos TypeScript
│   └── utils.ts           # Utilitários
└── public/
    └── logo.png           # Logo da empresa
```

---

## 👨‍💻 Desenvolvido por

Projeto desenvolvido com assistência de IA (Claude/Gemini) para **Silcon Ambiental**.

---

## 📄 Licença

Este projeto é privado e de uso exclusivo da Silcon Ambiental.

_Última atualização de deploy: 03/02/2026 - 11:57_
