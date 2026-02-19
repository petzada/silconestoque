'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, TruncatedCell, type DataTableColumn } from '@/components/ui/data-table';
import { PageContainer } from '@/components/layout/page-container';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PriceHistory, Product, Sector } from '@/lib/types';

type DirectionFilter = 'all' | 'increases' | 'decreases';

type PriceVariationItem = PriceHistory & {
  variationPercent: number;
  product?: Product;
};

const THRESHOLD_OPTIONS = ['0', '5', '10', '15', '20', '30', '50'] as const;

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function PriceVariationPage() {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<DirectionFilter>('all');
  const [minThreshold, setMinThreshold] = useState<string>('15');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [priceHistoryRes, sectorsRes] = await Promise.all([
        supabase
          .from('price_history')
          .select('*, product:products(*, sector:sectors(*))')
          .order('created_at', { ascending: false }),
        supabase.from('sectors').select('*').order('name'),
      ]);

      if (priceHistoryRes.error) throw priceHistoryRes.error;
      if (sectorsRes.error) throw sectorsRes.error;

      setPriceHistory(priceHistoryRes.data || []);
      setSectors(sectorsRes.data || []);
    } catch {
      toast.error('Erro ao carregar variacoes de preco');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHistory = useMemo<PriceVariationItem[]>(() => {
    const threshold = Number(minThreshold);
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    return priceHistory
      .filter((history) => history.old_price && history.old_price !== 0)
      .filter((history) => {
        const variation = ((history.new_price - history.old_price!) / history.old_price!) * 100;
        if (Math.abs(variation) < threshold) return false;

        if (selectedDirection === 'increases' && variation <= 0) return false;
        if (selectedDirection === 'decreases' && variation >= 0) return false;

        if (selectedSector !== 'all' && history.product?.sector_id !== selectedSector) return false;

        if (normalizedSearch) {
          const values = [history.product?.name, history.invoice_number];
          const matches = values.some((value) => value?.toLowerCase().includes(normalizedSearch));
          if (!matches) return false;
        }

        const createdAt = new Date(history.created_at);
        if (from && createdAt < from) return false;
        if (to && createdAt > to) return false;

        return true;
      })
      .map((history) => ({
        ...history,
        variationPercent: ((history.new_price - history.old_price!) / history.old_price!) * 100,
      }));
  }, [
    priceHistory,
    minThreshold,
    selectedDirection,
    selectedSector,
    searchTerm,
    dateFrom,
    dateTo,
  ]);

  const averageVariation = useMemo(() => {
    if (filteredHistory.length === 0) return 0;
    const total = filteredHistory.reduce((sum, item) => sum + Math.abs(item.variationPercent), 0);
    return total / filteredHistory.length;
  }, [filteredHistory]);

  const mostAffectedSector = useMemo(() => {
    if (filteredHistory.length === 0) return '-';
    const counter = new Map<string, number>();

    filteredHistory.forEach((item) => {
      const sectorName = item.product?.sector?.name || 'Sem setor';
      counter.set(sectorName, (counter.get(sectorName) || 0) + 1);
    });

    const sorted = Array.from(counter.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '-';
  }, [filteredHistory]);

  const selectedProductHistory = useMemo(() => {
    if (!selectedProductId) return [];
    return priceHistory
      .filter((history) => history.product_id === selectedProductId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [priceHistory, selectedProductId]);

  const chartData = useMemo(
    () =>
      [...selectedProductHistory]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((history) => ({
          date: format(new Date(history.created_at), 'dd/MM/yy HH:mm'),
          price: history.new_price,
        })),
    [selectedProductHistory]
  );

  const selectedProductName = selectedProductHistory[0]?.product?.name || '-';

  const columns = useMemo<DataTableColumn<PriceVariationItem>[]>(
    () => [
      {
        key: 'created_at',
        header: 'Data',
        sortable: true,
        accessor: (item) => new Date(item.created_at),
        cell: (item) => (
          <span className="whitespace-nowrap text-xs font-bold text-slate-500">
            {format(new Date(item.created_at), 'dd/MM/yy HH:mm')}
          </span>
        ),
      },
      {
        key: 'product',
        header: 'Produto',
        sortable: true,
        accessor: (item) => item.product?.name || '',
        cell: (item) => (
          <div className="flex flex-col">
            <TruncatedCell value={item.product?.name || '-'} className="max-w-[280px] font-bold text-slate-800" />
            <TruncatedCell
              value={item.product?.sector?.name || '-'}
              className="max-w-[280px] text-xs font-bold uppercase tracking-wide text-slate-400"
            />
          </div>
        ),
      },
      {
        key: 'invoice_number',
        header: 'NF',
        sortable: true,
        accessor: (item) => item.invoice_number || '',
        align: 'center',
        cell: (item) => (
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-500">
            {item.invoice_number || '---'}
          </span>
        ),
      },
      {
        key: 'old_price',
        header: 'Preco Anterior',
        sortable: true,
        accessor: (item) => item.old_price || 0,
        align: 'right',
        cell: (item) => (
          <span className="text-xs font-bold text-slate-500 line-through">
            {formatCurrency(item.old_price)}
          </span>
        ),
      },
      {
        key: 'new_price',
        header: 'Preco Novo',
        sortable: true,
        accessor: (item) => item.new_price,
        align: 'right',
        cell: (item) => (
          <span className="text-sm font-black text-slate-900">
            {formatCurrency(item.new_price)}
          </span>
        ),
      },
      {
        key: 'variation',
        header: 'Variacao',
        sortable: true,
        accessor: (item) => item.variationPercent,
        align: 'center',
        cell: (item) => {
          const isIncrease = item.variationPercent > 0;
          return (
            <Badge
              className={cn(
                'border-none px-2 py-0.5 text-[10px] font-black uppercase',
                isIncrease ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
              )}
            >
              {isIncrease ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {Math.abs(item.variationPercent).toFixed(1)}%
            </Badge>
          );
        },
      },
      {
        key: 'actions',
        header: 'Acoes',
        align: 'center',
        cell: (item) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[11px] font-bold"
            onClick={() => {
              setSelectedProductId(item.product_id);
              setIsHistoryDialogOpen(true);
            }}
          >
            Ver Historico
          </Button>
        ),
      },
    ],
    []
  );

  if (isLoading) {
    return <div className="py-20 text-center font-bold text-slate-400">Carregando variacao de preco...</div>;
  }

  return (
    <PageContainer className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Variacao de Preco</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total de alertas</p>
              <p className="text-xl font-black text-slate-900">{filteredHistory.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Variacao media</p>
              <p className="text-xl font-black text-amber-600">{averageVariation.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CalendarRange className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Setor mais afetado</p>
              <p className="text-base font-black text-emerald-700">{mostAffectedSector}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por produto ou NF..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-10 rounded-lg border-slate-200 pl-9 text-sm"
            />
          </div>

          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="h-10 rounded-lg border-slate-200 text-xs font-bold">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((sector) => (
                <SelectItem key={sector.id} value={sector.id}>
                  {sector.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedDirection}
            onValueChange={(value) => setSelectedDirection(value as DirectionFilter)}
          >
            <SelectTrigger className="h-10 rounded-lg border-slate-200 text-xs font-bold">
              <SelectValue placeholder="Direcao" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="increases">Aumentos</SelectItem>
              <SelectItem value="decreases">Reducoes</SelectItem>
            </SelectContent>
          </Select>

          <Select value={minThreshold} onValueChange={setMinThreshold}>
            <SelectTrigger className="h-10 rounded-lg border-slate-200 text-xs font-bold">
              <SelectValue placeholder="Limite minimo" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {THRESHOLD_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-10 rounded-lg border-slate-200 text-sm"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-10 rounded-lg border-slate-200 text-sm"
          />
        </div>
      </div>

      <DataTable
        data={filteredHistory}
        columns={columns}
        rowKey={(item) => item.id}
        emptyMessage={
          searchTerm ||
          selectedSector !== 'all' ||
          selectedDirection !== 'all' ||
          minThreshold !== '0' ||
          dateFrom ||
          dateTo
            ? 'Nenhum alerta encontrado para os filtros selecionados.'
            : 'Nao ha variacoes de preco registradas.'
        }
        defaultSort={{ key: 'created_at', direction: 'desc' }}
        initialPageSize={25}
      />

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl rounded-2xl border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Evolucao de Preco</DialogTitle>
            <p className="text-sm font-medium text-slate-500">{selectedProductName}</p>
          </DialogHeader>

          {selectedProductHistory.length === 0 ? (
            <div className="py-8 text-center text-sm font-semibold text-slate-400">
              Nenhum historico encontrado para este produto.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="h-[260px] rounded-xl border border-slate-100 bg-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(value) => formatCurrency(Number(value))}
                      width={90}
                    />
                    <Tooltip
                      formatter={(value: unknown) => [formatCurrency(Number(value)), 'Preco']}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#0f172a"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#0f172a' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                {selectedProductHistory.map((history) => {
                  const hasOldPrice = Boolean(history.old_price && history.old_price !== 0);
                  const variation = hasOldPrice
                    ? ((history.new_price - history.old_price!) / history.old_price!) * 100
                    : 0;
                  const isIncrease = variation > 0;
                  return (
                    <div
                      key={history.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">
                          {format(new Date(history.created_at), 'dd/MM/yy HH:mm')}
                        </p>
                        <p className="text-xs text-slate-500">NF: {history.invoice_number || '---'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {hasOldPrice && (
                            <p className="text-[10px] font-bold text-slate-400 line-through">
                              {formatCurrency(history.old_price)}
                            </p>
                          )}
                          <p className="text-sm font-black text-slate-900">
                            {formatCurrency(history.new_price)}
                          </p>
                        </div>
                        {hasOldPrice && (
                          <Badge
                            className={cn(
                              'border-none px-2 py-0.5 text-[10px] font-black',
                              isIncrease ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            )}
                          >
                            {isIncrease ? (
                              <TrendingUp className="mr-1 h-3 w-3" />
                            ) : (
                              <TrendingDown className="mr-1 h-3 w-3" />
                            )}
                            {Math.abs(variation).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
