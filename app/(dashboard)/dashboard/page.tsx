'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { supabase, fetchAllRows } from '@/lib/supabase';
// Force UI Update
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  RotateCw,
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(String(currentDate.getMonth()));
  const [filterYear, setFilterYear] = useState<string>(String(currentDate.getFullYear()));
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const availableYears = useMemo(() => {
    const yearsInData = new Set(
      data.movements.map(m => new Date(m.created_at).getFullYear())
    );

    // Garante que o ano atual e o ano selecionado sempre apareçam, mesmo sem dados.
    yearsInData.add(currentDate.getFullYear());
    const parsedFilterYear = parseInt(filterYear);
    if (!Number.isNaN(parsedFilterYear)) {
      yearsInData.add(parsedFilterYear);
    }

    return Array.from(yearsInData)
      .sort((a, b) => b - a)
      .map(y => String(y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.movements, filterYear]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [productsRes, movementsRes, categoriesRes] = await Promise.all([
        // Sem `category:categories(*)`: o dashboard filtra produto por
        // `category_id` e nunca lê `p.category`, então trazer a categoria
        // aninhada em cada produto era payload puro.
        fetchAllRows(() => supabase.from('products').select('*').eq('is_active', true)),
        // O produto e a categoria aninhados vêm só com as colunas que os
        // gráficos leem. Antes era `product:products(*, category:categories(*))`,
        // que repetia o registro inteiro do produto e da categoria dentro de CADA
        // movimentação — em alguns milhares de linhas isso vira megabytes de JSON
        // redundante para calcular meia dúzia de totais.
        fetchAllRows(() =>
          supabase
            .from('movements')
            .select('*, product:products(id, name, category_id, category:categories(id, name))')
            .order('created_at', { ascending: false })
            // Desempate estável: sem uma segunda chave de ordenação, linhas com
            // o mesmo instante podem trocar de página e ser puladas ou repetidas.
            .order('id', { ascending: false })
        ),
        fetchAllRows(() => supabase.from('categories').select('*').order('name')),
      ]);

      if (productsRes.error || movementsRes.error || categoriesRes.error) {
        throw productsRes.error || movementsRes.error || categoriesRes.error;
      }

      setData({
        products: productsRes.data || [],
        // O supabase-js infere relação aninhada como array quando o `select`
        // lista colunas explicitamente; em runtime um vínculo muitos-para-um
        // volta como objeto. Mesmo padrão de conversão já usado em
        // `employees/page.tsx` para as retiradas.
        movements: (movementsRes.data || []) as unknown as Movement[],
        categories: categoriesRes.data || [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido ao consultar o banco de dados.';
      setLoadError(message);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Estatísticas financeiras - IGNORA movimentações de import inicial
  const financeStats = useMemo(() => {
    const selectedMonth = parseInt(filterMonth);
    const selectedYear = parseInt(filterYear);

    // Todas as movimentações do período (mês/ano), ANTES de excluir import inicial.
    // Usado só para a linha de transparência abaixo dos KPIs — explica por que um
    // período pode aparecer zerado (sem movimentação, sem valor unitário, ou tudo
    // import inicial) em vez de deixar os três casos visualmente idênticos.
    const periodMovements = data.movements.filter(m => {
      const d = new Date(m.created_at);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    const initialImportCount = periodMovements.filter(m => m.is_initial_import).length;
    const nonInitialPeriodMovements = periodMovements.filter(m => !m.is_initial_import);
    const noUnitValueCount = nonInitialPeriodMovements.filter(m => !m.unit_value || m.unit_value === 0).length;

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
      countOuts: outs.length,
      periodTotal: periodMovements.length,
      initialImportCount,
      noUnitValueCount,
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

  // Linha de transparência: explica por que um período pode aparecer zerado nos
  // KPIs — sem movimentação, sem valor unitário gravado, ou tudo import inicial
  // (excluído de propósito). Evita que os três cenários pareçam idênticos.
  const transparencyText = (() => {
    if (financeStats.periodTotal === 0) {
      return 'Nenhuma movimentação registrada neste período.';
    }

    const parts: string[] = [
      financeStats.periodTotal === 1
        ? '1 movimentação no período'
        : `${financeStats.periodTotal} movimentações no período`,
    ];

    if (financeStats.noUnitValueCount > 0) {
      parts.push(
        financeStats.noUnitValueCount === 1
          ? '1 sem valor unitário'
          : `${financeStats.noUnitValueCount} sem valor unitário`
      );
    }

    if (financeStats.initialImportCount > 0) {
      parts.push(
        financeStats.initialImportCount === 1
          ? '1 de importação inicial (não contabilizada)'
          : `${financeStats.initialImportCount} de importação inicial (não contabilizadas)`
      );
    }

    return parts.join(' · ');
  })();

  if (isLoading) {
    return <PageLoading label="Analisando dados do estoque..." />;
  }

  if (loadError) {
    return (
      <PageContainer>
        <PageHeader
          title="Dashboard"
          description="Visão geral do estoque e consumo por categoria"
        />
        <Card>
          <CardContent className="p-10 flex flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle className="h-10 w-10 text-danger" />
            <div>
              <p className="text-sm font-semibold text-foreground">Não foi possível carregar os dados do dashboard</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">{loadError}</p>
            </div>
            <Button onClick={fetchData} size="sm" className="mt-2 gap-1.5">
              <RotateCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
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

      <p className="text-xs text-muted-foreground -mt-2 px-1">{transparencyText}</p>

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
