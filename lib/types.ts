// Database Types for Silcon Ambiental

// Setor do colaborador (departamento real da empresa onde ele é lotado). Ver
// ADR-0003. Não usado diretamente pelo código hoje — `Department` (abaixo) é
// a implementação em uso; mantido por compatibilidade.
export type Sector = {
  id: string;
  name: string;
};

// Categoria de produto (classificação por tipo de material). Distinta de
// `Sector`, que é o departamento real onde colaboradores são lotados. Ver ADR-0003.
export type Category = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  sku_code: string | null;
  name: string;
  unit: 'unidade' | 'caixa' | 'pacote';
  category_id: string;
  current_qty: number;
  min_stock: number;
  max_stock: number;
  cost_price: number | null;
  is_active: boolean;
  category?: Category;
};

export type MovementType = 'IN' | 'OUT';

export type Movement = {
  id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  entity_name: string | null;
  unit_value: number | null;
  invoice_number: string | null;
  created_at: string;
  is_initial_import: boolean;
  employee_id: string | null;
  product?: Product;
  employee?: Employee;
};

export type PriceHistory = {
  id: string;
  product_id: string;
  old_price: number | null;
  new_price: number;
  invoice_number: string | null;
  created_at: string;
  product?: Product;
};

// Form types
export type ProductFormData = {
  sku_code?: string;
  name: string;
  unit: 'unidade' | 'caixa' | 'pacote';
  category_id: string;
  current_qty: number;
  min_stock: number;
  max_stock: number;
  cost_price?: number;
};

export type MovementFormData = {
  product_id: string;
  type: MovementType;
  quantity: number;
  entity_name?: string;
  unit_value?: number;
  invoice_number?: string;
  is_initial_import?: boolean;
  employee_id?: string;
};

export type MovementFilters = {
  searchTerm: string;
  type: MovementType | 'all';
  month: string;
  year: string;
  categoryId: string;
  employeeId: string;
};

// Purchase Order types
export type PurchaseOrderType = 'emergency' | 'monthly';

export type PurchaseOrderItem = {
  product_id: string;
  product_name: string;
  sku_code: string | null;
  unit: string;
  category_name: string;
  current_qty: number;
  min_stock: number;
  max_stock: number;
  order_qty: number;
  cost_price: number | null;
  total_cost: number | null;
};

// Follow-up types
export type FollowUpStatus = 'pendente' | 'em_andamento' | 'recebido';

export type FollowUpReceipt = {
  id: string;
  purchase_order_id: string;
  supplier_name: string;
  invoice_value: number | null;
  received_at: string;
  created_at: string;
};

export type FollowUpPurchaseOrder = {
  id: string;
  solicitation_id: string;
  po_number: string;
  supplier_name: string;
  estimated_delivery: string | null;
  created_at: string;
  receipt?: FollowUpReceipt[];
};

export type FollowUpSolicitation = {
  id: string;
  request_number: string;
  request_date: string;
  description: string;
  created_at: string;
  updated_at: string;
  purchase_orders?: FollowUpPurchaseOrder[];
};

export type SolicitationFormData = {
  request_number: string;
  request_date: string;
  description: string;
};

export type PurchaseOrderFormData = {
  po_number: string;
  supplier_name: string;
  estimated_delivery?: string;
};

export type ReceiptFormData = {
  supplier_name: string;
  invoice_value?: number;
};

// Armários / Colaboradores types
export type LockerKind = 'uniforme' | 'vestiario';

export type LockerSize = 'P' | 'M' | 'G' | 'GG' | 'XG' | 'SSG';

export const LOCKER_SIZES: LockerSize[] = ['P', 'M', 'G', 'GG', 'XG', 'SSG'];

export type Role = {
  id: string;
  name: string;
  created_at: string;
};

// Setor do colaborador (departamento real da empresa onde ele é lotado). Ver
// ADR-0003. `Department`/`departments` é a implementação em uso hoje; o tipo
// `Sector` (topo deste arquivo) representa o mesmo conceito mas não está mais
// ligado a nenhuma tabela consumida pelo código — mantido apenas por
// compatibilidade.
export type Department = {
  id: string;
  name: string;
  created_at: string;
};

export type Employee = {
  id: string;
  full_name: string;
  department_id: string;
  role_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department;
  role?: Role;
};

export type Locker = {
  id: string;
  kind: LockerKind;
  number: number;
  size: LockerSize | null;
  is_active: boolean;
  created_at: string;
};

export type LockerAssignment = {
  id: string;
  locker_id: string;
  employee_id: string;
  locker_kind: LockerKind;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  employee?: Employee;
  locker?: Locker;
};

// Form types
export type EmployeeFormData = {
  full_name: string;
  department_id: string;
  role_id: string;
};

export type LockerFormData = {
  number: number;
  size: LockerSize;
};

export type RoleFormData = {
  name: string;
};

export type DepartmentFormData = {
  name: string;
};

// =====================
// Dashboard analítico (Fase 3 — supabase/migration_fase3_analitico.sql)
// =====================
// Estes tipos espelham exatamente as colunas/campos devolvidos pelos RPCs.
// Nenhuma tela consome ainda — contrato para a Fase 4 (nova home). Ver o
// comentário de cada função em migration_fase3_analitico.sql para o
// detalhe normativo de cada campo (zerado/crítico/estável, exclusão de
// is_initial_import, etc. — CONTEXT.md é a fonte das definições).

// dashboard_operacao(p_category_id) — foto instantânea, devolve JSONB.
export type DashboardUrgenciaItem = {
  product_id: string;
  product_name: string;
  sku_code: string | null;
  current_qty: number;
  min_stock: number;
  faixa: 'zerado' | 'critico';
  // NULL para faixa === 'zerado' (ver comentário do RPC): zerado já vem
  // sempre primeiro na ordenação, o déficit não é calculado para ele.
  deficit_relativo: number | null;
};

export type DashboardCoberturaItem = {
  product_id: string;
  product_name: string;
  sku_code: string | null;
  current_qty: number;
  // NULL = cobertura infinita (produto sem nenhuma saída nos últimos 90
  // dias). Nunca aparece em `cobertura_criticos` (que só lista finitas).
  cobertura_dias: number | null;
};

export type DashboardPedidoAtraso = {
  po_id: string;
  po_number: string;
  supplier_name: string;
  estimated_delivery: string;
  dias_atraso: number;
};

export type DashboardOperacao = {
  zerados: number;
  criticos: number;
  estaveis: number;
  total_ativos: number;
  cobertura_abaixo_15_dias: number;
  // Top 10: zerados primeiro, depois críticos por déficit relativo desc.
  top_urgencia: DashboardUrgenciaItem[];
  // Top 15 com cobertura finita, ASC (mais urgente primeiro).
  cobertura_criticos: DashboardCoberturaItem[];
  // NÃO filtrado por categoria (follow_up_purchase_orders não tem FK de produto/categoria).
  pedidos_atraso: DashboardPedidoAtraso[];
};

// dashboard_analise_kpis(p_from, p_to, p_category_id, p_department_id) —
// TABLE de uma linha só. `.rpc(...)` devolve um array; consumir `[0]`.
export type DashboardAnaliseKpis = {
  consumo_atual: number;
  consumo_anterior: number;
  // NULL quando há filtro de setor ativo: Entradas nunca carregam
  // department_id (só Saídas têm employee_id), então "compras deste setor"
  // não é uma pergunta com resposta — e zero diria, falsamente, que nada foi
  // comprado. A UI deve renderizar "—" e explicar o recorte, nunca R$ 0,00.
  compras_atual: number | null;
  compras_anterior: number | null;
  // BIGINT no Postgres — PostgREST serializa como number em JSON para
  // contagens deste porte; não tratar como string.
  movimentacoes_atual: number;
  movimentacoes_anterior: number;
  // Snapshot (Σ current_qty × cost_price sobre produtos ativos): não tem
  // período nem valor anterior.
  valor_imobilizado: number;
};

// dashboard_serie(p_from, p_to, p_category_id, p_department_id) — um item
// por dia entre p_from e p_to inclusive, sem buracos (dia sem movimento
// vem com consumo/compras = 0).
export type DashboardSerieItem = {
  dia: string;
  consumo: number;
  compras: number;
};

export type DashboardDimensao = 'categoria' | 'setor' | 'produto';

// dashboard_dimensao(p_from, p_to, p_dim, p_category_id, p_department_id, p_limit)
export type DashboardDimensaoItem = {
  // NULL quando p_dim = 'setor' e o grupo é "Sem solicitante" (movimentação
  // sem employee_id/department_id).
  dim_id: string | null;
  dim_label: string;
  consumo_atual: number;
  consumo_anterior: number;
};

export type DashboardDestaqueTipo =
  | 'maior_alta_custo'
  | 'setor_acima_media'
  | 'categoria_maior_share'
  | 'encalhe';

// dashboard_destaques(p_from, p_to, p_category_id, p_department_id) — 0 a 4
// linhas, ordem fixa por tipo (ver comentário do RPC): maior_alta_custo,
// setor_acima_media e categoria_maior_share são omitidos sem dado
// qualificado no período; encalhe está sempre presente (mesmo com valor 0).
export type DashboardDestaque = {
  tipo: DashboardDestaqueTipo;
  texto: string;
  valor: number;
};
