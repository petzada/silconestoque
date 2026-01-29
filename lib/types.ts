// Database Types for Silcon Ambiental

export type Sector = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  sku_code: string | null;
  name: string;
  unit: 'unidade' | 'caixa' | 'pacote';
  sector_id: string;
  current_qty: number;
  min_stock: number;
  max_stock: number;
  cost_price: number | null;
  is_active: boolean;
  sector?: Sector;
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
  product?: Product;
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
  sector_id: string;
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
};

// Purchase Order types
export type PurchaseOrderType = 'emergency' | 'monthly';

export type PurchaseOrderItem = {
  product_id: string;
  product_name: string;
  sku_code: string | null;
  unit: string;
  sector_name: string;
  current_qty: number;
  min_stock: number;
  max_stock: number;
  order_qty: number;
  cost_price: number | null;
  total_cost: number | null;
};
