'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase, fetchAllRows } from '@/lib/supabase';
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
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
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
import { CHART_TOOLTIP_STYLE } from '@/lib/chart';
import type { PriceHistory, Product, Category } from '@/lib/types';

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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
      const [priceHistoryRes, categoriesRes] = await Promise.all([
        fetchAllRows<PriceHistory>(() =>
          supabase
            .from('price_history')
            .select('*, product:products(*, category:categories(*))')
            .order('created_at', { ascending: false })
            // Desempate estável: sem uma segunda chave, variações no mesmo
            // instante podem ser puladas ou repetidas entre páginas do range().
            .order('id', { ascending: false })
        ),
        supabase.from('categories').select('*').order('name'),
      ]);

      if (priceHistoryRes.error) throw priceHistoryRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setPriceHistory(priceHistoryRes.data || []);
      setCategories(categoriesRes.data || []);
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

        if (selectedCategory !== 'all' && history.product?.category_id !== selectedCategory) return false;

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
    selectedCategory,
    searchTerm,
    dateFrom,
    dateTo,
  ]);

  const averageVariation = useMemo(() => {
    if (filteredHistory.length === 0) return 0;
    const total = filteredHistory.reduce((sum, item) => sum + Math.abs(item.variationPercent), 0);
    return total / filteredHistory.length;
  }, [filteredHistory]);

  const mostAffectedCategory = useMemo(() => {
    if (filteredHistory.length === 0) return '-';
    const counter = new Map<string, number>();

    filteredHistory.forEach((item) => {
      const categoryName = item.product?.category?.name || 'Sem categoria';
      counter.set(categoryName, (counter.get(categoryName) || 0) + 1);
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
          <span className="whitespace-nowrap text-xs font-bold text-muted-foreground">
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
            <TruncatedCell value={item.product?.name || '-'} className="max-w-[280px] font-bold text-foreground" />
            <TruncatedCell
              value={item.product?.category?.name || '-'}
              className="max-w-[280px] text-xs font-bold uppercase tracking-wide text-muted-foreground"
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
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground">
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
          <span className="text-xs font-bold text-muted-foreground line-through">
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
          <span className="text-sm font-bold text-foreground">
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
                'border-none px-2 py-0.5 text-[10px] font-bold uppercase',
                isIncrease ? 'bg-destructive/15 text-destructive' : 'bg-success-muted text-success'
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
    return <PageLoading label="Carregando variação de preço..." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Variação de Preço"
        description="Alertas de variação de custo entre compras"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-caption-uppercase text-[11px] text-muted-foreground">Total de alertas</p>
              <p className="text-stat-display text-3xl">{filteredHistory.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-caption-uppercase text-[11px] text-muted-foreground">Variacao media</p>
              <p className="text-stat-display text-3xl">{averageVariation.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <CalendarRange className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-caption-uppercase text-[11px] text-muted-foreground">Categoria mais afetada</p>
              <p className="text-display text-base text-foreground">{mostAffectedCategory}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-card p-2.5">
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto ou NF..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-10 border-border pl-9 text-sm"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-10 border-border text-xs font-bold">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedDirection}
            onValueChange={(value) => setSelectedDirection(value as DirectionFilter)}
          >
            <SelectTrigger className="h-10 border-border text-xs font-bold">
              <SelectValue placeholder="Direcao" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="increases">Aumentos</SelectItem>
              <SelectItem value="decreases">Reducoes</SelectItem>
            </SelectContent>
          </Select>

          <Select value={minThreshold} onValueChange={setMinThreshold}>
            <SelectTrigger className="h-10 border-border text-xs font-bold">
              <SelectValue placeholder="Limite minimo" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
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
            className="h-10 border-border text-sm"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-10 border-border text-sm"
          />
        </div>
      </div>

      <DataTable
        data={filteredHistory}
        columns={columns}
        rowKey={(item) => item.id}
        emptyMessage={
          searchTerm ||
          selectedCategory !== 'all' ||
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
        <DialogContent className="max-w-4xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Evolucao de Preco</DialogTitle>
            <p className="text-sm font-medium text-muted-foreground">{selectedProductName}</p>
          </DialogHeader>

          {selectedProductHistory.length === 0 ? (
            <div className="py-8 text-center text-sm font-semibold text-muted-foreground">
              Nenhum historico encontrado para este produto.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="h-[260px] rounded-lg border border-border bg-card p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(value) => formatCurrency(Number(value))}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value: unknown) => [formatCurrency(Number(value)), 'Preco']}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--primary)' }}
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
                      className="flex items-center justify-between rounded-lg border border-border bg-muted p-3"
                    >
                      <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                          {format(new Date(history.created_at), 'dd/MM/yy HH:mm')}
                        </p>
                        <p className="text-xs text-muted-foreground">NF: {history.invoice_number || '---'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {hasOldPrice && (
                            <p className="text-[10px] font-bold text-muted-foreground line-through">
                              {formatCurrency(history.old_price)}
                            </p>
                          )}
                          <p className="text-sm font-bold text-foreground">
                            {formatCurrency(history.new_price)}
                          </p>
                        </div>
                        {hasOldPrice && (
                          <Badge
                            className={cn(
                              'border-none px-2 py-0.5 text-[10px] font-bold',
                              isIncrease ? 'bg-destructive/15 text-destructive' : 'bg-success-muted text-success'
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
