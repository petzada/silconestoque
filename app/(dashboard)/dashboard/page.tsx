'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
// Force UI Update
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Inbox,
  Filter,
  Package,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart';
import type { Product, Movement, Category } from '@/lib/types';

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const MONTHS = [
  { value: '0', label: 'Janeiro' },
  { value: '1', label: 'Fevereiro' },
  { value: '2', label: 'Março' },
  { value: '3', label: 'Abril' },
  { value: '4', label: 'Maio' },
  { value: '5', label: 'Junho' },
  { value: '6', label: 'Julho' },
  { value: '7', label: 'Agosto' },
  { value: '8', label: 'Setembro' },
  { value: '9', label: 'Outubro' },
  { value: '10', label: 'Novembro' },
  { value: '11', label: 'Dezembro' },
];

export default function DashboardPage() {
  const [data, setData] = useState({
    products: [] as Product[],
    movements: [] as Movement[],
    categories: [] as Category[],
  });
  const [isLoading, setIsLoading] = useState(true);

  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(String(currentDate.getMonth()));
  const [filterYear, setFilterYear] = useState<string>(String(currentDate.getFullYear()));
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const availableYears = useMemo(() => {
    const years = [];
    for (let i = 0; i < 3; i++) {
      years.push(String(currentDate.getFullYear() - i));
    }
    return years;
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [productsRes, movementsRes, categoriesRes] = await Promise.all([
        supabase.from('products').select('*, category:categories(*)').eq('is_active', true),
        supabase.from('movements').select('*, product:products(*, category:categories(*))').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
      ]);

      setData({
        products: productsRes.data || [],
        movements: movementsRes.data || [],
        categories: categoriesRes.data || [],
      });
    } catch {
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Estatísticas financeiras - IGNORA movimentações de import inicial
  const financeStats = useMemo(() => {
    const selectedMonth = parseInt(filterMonth);
    const selectedYear = parseInt(filterYear);

    // Filtrar movimentações: mês/ano E excluir is_initial_import
    let filteredMovements = data.movements.filter(m => {
      if (m.is_initial_import) return false; // Ignora imports iniciais
      const d = new Date(m.created_at);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    // Filtrar por categoria se selecionada
    if (filterCategory !== 'all') {
      filteredMovements = filteredMovements.filter(m => m.product?.category_id === filterCategory);
    }

    const ins = filteredMovements.filter(m => m.type === 'IN');
    const outs = filteredMovements.filter(m => m.type === 'OUT');

    const totalInValue = ins.reduce((sum, m) => {
      const price = m.unit_value || 0;
      return sum + (m.quantity * price);
    }, 0);

    const totalOutValue = outs.reduce((sum, m) => {
      const price = m.unit_value || 0;
      return sum + (m.quantity * price);
    }, 0);

    // Gráfico de Barras: SEMPRE mostra todas as categorias (independente do filtro)
    const allOuts = data.movements.filter(m => {
      if (m.is_initial_import) return false;
      const d = new Date(m.created_at);
      return m.type === 'OUT' && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const categoryMap = new Map<string, number>();
    data.categories.forEach(c => categoryMap.set(c.name, 0));

    allOuts.forEach(m => {
      const categoryName = m.product?.category?.name;
      if (categoryName) {
        const price = m.unit_value || 0;
        categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + (m.quantity * price));
      }
    });

    const barData = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Lista de consumo por produto (só quando categoria selecionada)
    const productMap = new Map<string, number>();
    outs.forEach(m => {
      const name = m.product?.name || 'Insumo';
      productMap.set(name, (productMap.get(name) || 0) + m.quantity);
    });

    const productListData = Array.from(productMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const maxProductValue = productListData.length > 0 ? Math.max(...productListData.map(p => p.value)) : 1;

    return {
      totalInValue,
      totalOutValue,
      barData,
      productListData,
      maxProductValue,
      countIns: ins.length,
      countOuts: outs.length
    };
  }, [data, filterMonth, filterYear, filterCategory]);

  const filteredProducts = useMemo(() => {
    if (filterCategory === 'all') return data.products;
    return data.products.filter(p => p.category_id === filterCategory);
  }, [data.products, filterCategory]);

  const kpis = [
    {
      title: 'Entradas (R$)',
      value: formatCurrency(financeStats.totalInValue),
      sub: `${financeStats.countIns} entradas realizadas`,
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      title: 'Saídas (R$)',
      value: formatCurrency(financeStats.totalOutValue),
      sub: `${financeStats.countOuts} baixas de estoque`,
      icon: TrendingDown,
      color: 'text-danger',
    },
    {
      title: 'Itens Críticos',
      value: filteredProducts.filter(p => p.current_qty < p.min_stock && p.current_qty > 0).length,
      sub: 'Abaixo do saldo mínimo',
      icon: AlertTriangle,
      color: 'text-warning',
    },
    {
      title: 'Estoque Zerado',
      value: filteredProducts.filter(p => p.current_qty === 0).length,
      sub: 'Necessita reposição',
      icon: Inbox,
      color: 'text-danger',
    },
  ];

  if (isLoading) {
    return <PageLoading label="Analisando dados do estoque..." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Visão geral do estoque e consumo por categoria"
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1.5">
            <Filter className="ml-2 h-4 w-4 text-muted-foreground" />
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="h-8 w-[130px] border-none bg-transparent text-xs font-semibold shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="h-8 w-[90px] border-none bg-transparent text-xs font-semibold shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="h-6 w-px bg-border" />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-[160px] border-none bg-transparent text-xs font-semibold shadow-none">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-semibold">Todas as Categorias</SelectItem>
                {data.categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <Card key={idx} className="gap-0 py-0 overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-md bg-muted flex items-center justify-center shrink-0">
                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-caption-uppercase text-[11px] text-muted-foreground mb-0.5">{kpi.title}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-stat-display text-3xl truncate">{kpi.value}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{kpi.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfico de Barras: Gasto por Categoria */}
        <Card className="py-0 gap-0">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">Gasto por Categoria</CardTitle>
            <CardDescription className="text-xs">Valor financeiro consumido por categoria de material</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeStats.barData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="var(--border)" vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 500, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: unknown) => [formatCurrency(Number(value) || 0), 'Total']}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--brand)"
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                    label={{
                      position: 'right',
                      formatter: (v: unknown) => (Number(v) || 0) > 0 ? formatCurrency(Number(v)) : '',
                      fontSize: 10,
                      fontWeight: 600,
                      fill: 'var(--muted-foreground)',
                      offset: 5
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Consumo por Produto (substitui Pie Chart) */}
        <Card className="xl:col-span-2 py-0 gap-0 overflow-hidden">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm font-semibold">Consumo por Produto</CardTitle>
            <CardDescription className="text-xs">Top 8 produtos mais consumidos no período</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {filterCategory === 'all' ? (
              // Aviso para selecionar categoria
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Package className="h-12 w-12 opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Selecione uma categoria</p>
                  <p className="text-xs text-muted-foreground mt-1">Para visualizar o consumo detalhado por produto</p>
                </div>
              </div>
            ) : financeStats.productListData.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <CheckCircle2 className="h-12 w-12 opacity-30" />
                <p className="text-sm font-semibold text-foreground">Nenhum consumo registrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {financeStats.productListData.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-[140px] truncate" title={item.name}>
                      {item.name.length > 18 ? `${item.name.substring(0, 18)}...` : item.name}
                    </span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{
                          width: `${(item.value / financeStats.maxProductValue) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-[50px] text-right tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
