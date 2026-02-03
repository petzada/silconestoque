'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
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
  LayoutDashboard,
  Filter,
  Package,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Product, Movement, Sector, PriceHistory } from '@/lib/types';

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

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
    sectors: [] as Sector[],
    priceHistory: [] as PriceHistory[],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<PriceHistory | null>(null);

  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(String(currentDate.getMonth()));
  const [filterYear, setFilterYear] = useState<string>(String(currentDate.getFullYear()));
  const [filterSector, setFilterSector] = useState<string>('all');

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
      const [productsRes, movementsRes, sectorsRes, priceHistoryRes] = await Promise.all([
        supabase.from('products').select('*, sector:sectors(*)').eq('is_active', true),
        supabase.from('movements').select('*, product:products(*, sector:sectors(*))').order('created_at', { ascending: false }),
        supabase.from('sectors').select('*').order('name'),
        supabase.from('price_history').select('*, product:products(*)').order('created_at', { ascending: false }).limit(20)
      ]);

      setData({
        products: productsRes.data || [],
        movements: movementsRes.data || [],
        sectors: sectorsRes.data || [],
        priceHistory: priceHistoryRes.data || [],
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

    // Filtrar por setor se selecionado
    if (filterSector !== 'all') {
      filteredMovements = filteredMovements.filter(m => m.product?.sector_id === filterSector);
    }

    const ins = filteredMovements.filter(m => m.type === 'IN');
    const outs = filteredMovements.filter(m => m.type === 'OUT');

    const totalInValue = ins.reduce((sum, m) => {
      const price = m.unit_value || m.product?.cost_price || 0;
      return sum + (m.quantity * price);
    }, 0);

    const totalOutValue = outs.reduce((sum, m) => {
      const price = m.unit_value || m.product?.cost_price || 0;
      return sum + (m.quantity * price);
    }, 0);

    // Gráfico de Barras: SEMPRE mostra todos os setores (independente do filtro)
    const allOuts = data.movements.filter(m => {
      if (m.is_initial_import) return false;
      const d = new Date(m.created_at);
      return m.type === 'OUT' && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const sectorMap = new Map<string, number>();
    data.sectors.forEach(s => sectorMap.set(s.name, 0));

    allOuts.forEach(m => {
      const sectorName = m.product?.sector?.name;
      if (sectorName) {
        const price = m.unit_value || m.product?.cost_price || 0;
        sectorMap.set(sectorName, (sectorMap.get(sectorName) || 0) + (m.quantity * price));
      }
    });

    const barData = Array.from(sectorMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Lista de consumo por produto (só quando setor selecionado)
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
  }, [data, filterMonth, filterYear, filterSector]);

  const priceAlerts = useMemo(() => {
    return data.priceHistory
      .filter(h => h.old_price && ((h.new_price - h.old_price) / h.old_price) >= 0.15)
      .slice(0, 5);
  }, [data.priceHistory]);

  const filteredProducts = useMemo(() => {
    if (filterSector === 'all') return data.products;
    return data.products.filter(p => p.sector_id === filterSector);
  }, [data.products, filterSector]);

  const kpis = [
    {
      title: 'Entradas (R$)',
      value: formatCurrency(financeStats.totalInValue),
      sub: `${financeStats.countIns} entradas realizadas`,
      icon: TrendingUp,
      color: 'text-[#86efac]',
      bg: 'bg-[#387146]',
    },
    {
      title: 'Saídas (R$)',
      value: formatCurrency(financeStats.totalOutValue),
      sub: `${financeStats.countOuts} baixas de estoque`,
      icon: TrendingDown,
      color: 'text-red-100',
      bg: 'bg-red-600',
    },
    {
      title: 'Itens Críticos',
      value: filteredProducts.filter(p => p.current_qty <= p.min_stock && p.current_qty > 0).length,
      sub: 'Abaixo do saldo mínimo',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Estoque Zerado',
      value: filteredProducts.filter(p => p.current_qty === 0).length,
      sub: 'Necessita reposição',
      icon: Inbox,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400 font-medium">Analisando dados do estoque...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1700px] mx-auto space-y-4 pb-10 px-4 md:px-6">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg"><LayoutDashboard className="h-5 w-5 text-slate-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Visão Geral</h1>
            <p className="text-xs text-slate-500 font-medium">{format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
          <Filter className="h-4 w-4 text-slate-400 ml-2" />
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[130px] border-none shadow-none text-xs font-bold h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[90px] border-none shadow-none text-xs font-bold h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="w-px h-6 bg-slate-200" />
          <Select value={filterSector} onValueChange={setFilterSector}>
            <SelectTrigger className="w-[160px] border-none shadow-none text-xs font-bold h-8">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="font-bold">Todos os Setores</SelectItem>
              {data.sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <Card key={idx} className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", kpi.bg)}>
                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{kpi.title}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-slate-900 truncate">{kpi.value}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium truncate">{kpi.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfico de Barras: Gasto por Setor */}
        <Card className="border-none shadow-sm rounded-xl bg-white">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm font-bold flex items-center gap-2">Gasto por Setor</CardTitle>
            <CardDescription className="text-[10px]">Valor financeiro consumido por departamento</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeStats.barData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="#f1f5f9" vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                    formatter={(value: unknown) => [formatCurrency(Number(value) || 0), 'Total']}
                  />
                  <Bar
                    dataKey="value"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                    label={{
                      position: 'right',
                      formatter: (v: unknown) => (Number(v) || 0) > 0 ? formatCurrency(Number(v)) : '',
                      fontSize: 9,
                      fontWeight: 700,
                      fill: '#334155',
                      offset: 5
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Consumo por Produto (substitui Pie Chart) */}
        <Card className="xl:col-span-2 border-none shadow-sm rounded-xl bg-white overflow-hidden">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm font-bold">Consumo por Produto</CardTitle>
            <CardDescription className="text-[10px]">Top 8 produtos mais consumidos no período</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {filterSector === 'all' ? (
              // Aviso para selecionar setor
              <div className="h-[280px] flex flex-col items-center justify-center text-slate-300 gap-3">
                <Package className="h-12 w-12 opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-400">Selecione um setor</p>
                  <p className="text-[10px] text-slate-400 mt-1">Para visualizar o consumo detalhado por produto</p>
                </div>
              </div>
            ) : financeStats.productListData.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-slate-300 gap-3">
                <CheckCircle2 className="h-12 w-12 opacity-30" />
                <p className="text-sm font-bold text-slate-400">Nenhum consumo registrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {financeStats.productListData.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-slate-600 w-[140px] truncate" title={item.name}>
                      {item.name.length > 18 ? `${item.name.substring(0, 18)}...` : item.name}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(item.value / financeStats.maxProductValue) * 100}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-[50px] text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Alertas de Inflação */}
        <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
          <CardHeader className="p-4 bg-slate-50/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Var. de Preço (+15%)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {priceAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-2">
                <CheckCircle2 className="h-8 w-8 opacity-20" />
                <p className="text-xs font-bold">Nenhuma variação atípica</p>
              </div>
            ) : (
              <div className="space-y-2">
                {priceAlerts.map((alert) => {
                  const variation = ((alert.new_price - alert.old_price!) / alert.old_price!) * 100;
                  return (
                    <div
                      key={alert.id}
                      onClick={() => setSelectedAlert(alert)}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-[12px] truncate">{alert.product?.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium tracking-tight">NF: {alert.invoice_number}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 line-through leading-none">{formatCurrency(alert.old_price)}</p>
                          <p className="text-[12px] font-bold text-red-600 leading-tight">{formatCurrency(alert.new_price)}</p>
                        </div>
                        <Badge className="bg-red-100 text-red-700 border-none font-bold text-[10px] h-6 px-2">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {variation.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fila de Reposição */}
        <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
          <CardHeader className="p-4 bg-slate-50/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">Fila de Reposição</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {filteredProducts
                .filter(p => p.current_qty <= p.min_stock)
                .slice(0, 5)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-700 text-[12px] truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.sector?.name}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 block">SALDO</span>
                        <span className={cn("text-xs font-black", p.current_qty === 0 ? "text-red-600" : "text-amber-600")}>
                          {p.current_qty} {p.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhe do Alerta */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" /> Detalhes da Variação
            </DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="pt-4 space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Produto</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{selectedAlert.product?.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Preço Anterior</p>
                  <p className="text-lg font-bold text-slate-600">{formatCurrency(selectedAlert.old_price)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Preço Atualizado</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(selectedAlert.new_price)}</p>
                </div>
              </div>
              <div className="p-4 border border-red-100 bg-red-50 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-red-800">Variação Real</span>
                <span className="text-xl font-black text-red-600">
                  +{(((selectedAlert.new_price - selectedAlert.old_price!) / selectedAlert.old_price!) * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-[10px] text-center text-slate-400 font-medium pt-2">Registrado em {format(new Date(selectedAlert.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
