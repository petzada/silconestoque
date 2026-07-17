'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
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
import { DataTable, TruncatedCell, type DataTableColumn } from '@/components/ui/data-table';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileDown,
  Search,
  PackageSearch,
  Inbox,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { drawPdfBrandHeader, PDF_HEAD_STYLES, PDF_ALTERNATE_ROW_STYLES } from '@/lib/pdf';
import type { Product, Sector } from '@/lib/types';

type UrgencyFilter = 'all' | 'zerado' | 'critico';
type UrgencyLevel = Exclude<UrgencyFilter, 'all'>;

type ReplenishmentItem = Product & {
  deficit: number;
  targetDeficit: number;
  urgencyLevel: UrgencyLevel;
};

export default function ReplenishmentQueuePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<UrgencyFilter>('all');

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [productsRes, sectorsRes] = await Promise.all([
        supabase.from('products').select('*, sector:sectors(*)').eq('is_active', true),
        supabase.from('sectors').select('*').order('name'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (sectorsRes.error) throw sectorsRes.error;

      setProducts(productsRes.data || []);
      setSectors(sectorsRes.data || []);
    } catch {
      toast.error('Erro ao carregar fila de reposicao');
    } finally {
      setIsLoading(false);
    }
  };

  const replenishmentItems = useMemo<ReplenishmentItem[]>(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products
      .filter((product) => product.current_qty <= product.min_stock)
      .filter((product) => selectedSector === 'all' || product.sector_id === selectedSector)
      .filter((product) => {
        if (selectedUrgency === 'all') return true;
        if (selectedUrgency === 'zerado') return product.current_qty === 0;
        return product.current_qty > 0 && product.current_qty <= product.min_stock;
      })
      .filter((product) => {
        if (!normalizedSearch) return true;
        return [product.name, product.sku_code].some((value) =>
          value?.toLowerCase().includes(normalizedSearch)
        );
      })
      .map((product) => ({
        ...product,
        deficit: product.min_stock - product.current_qty,
        targetDeficit: product.max_stock - product.current_qty,
        urgencyLevel: product.current_qty === 0 ? 'zerado' : 'critico',
      }));
  }, [products, searchTerm, selectedSector, selectedUrgency]);

  const kpis = useMemo(
    () => ({
      total: replenishmentItems.length,
      zeroed: replenishmentItems.filter((item) => item.current_qty === 0).length,
      critical: replenishmentItems.filter((item) => item.current_qty > 0 && item.current_qty <= item.min_stock).length,
    }),
    [replenishmentItems]
  );

  const exportPDF = () => {
    if (replenishmentItems.length === 0) {
      toast.error('Nao ha itens para exportar');
      return;
    }

    try {
      const doc = new jsPDF();
      const now = new Date();
      const timestamp = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;

      drawPdfBrandHeader(doc, 26);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.text('FILA DE REPOSICAO', 14, 17);

      doc.setTextColor(10, 10, 10);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${timestamp}`, 14, 34);

      autoTable(doc, {
        startY: 40,
        head: [[
          'Produto',
          'Setor',
          'Saldo',
          'Min',
          'Max',
          'Deficit',
          'Repor p/ Max',
          'Unid',
          'Prioridade',
        ]],
        body: replenishmentItems.map((item) => [
          item.sku_code ? `${item.name} (${item.sku_code})` : item.name,
          item.sector?.name || '-',
          item.current_qty,
          item.min_stock,
          item.max_stock,
          item.deficit,
          item.targetDeficit,
          item.unit,
          item.urgencyLevel === 'zerado' ? 'ZERADO' : 'CRITICO',
        ]),
        styles: { fontSize: 8 },
        headStyles: PDF_HEAD_STYLES,
        alternateRowStyles: PDF_ALTERNATE_ROW_STYLES,
      });

      doc.save('fila_reposicao.pdf');
      toast.success('PDF exportado');
    } catch {
      toast.error('Erro ao exportar PDF');
    }
  };

  const columns = useMemo<DataTableColumn<ReplenishmentItem>[]>(
    () => [
      {
        key: 'product',
        header: 'Produto',
        sortable: true,
        accessor: (item) => item.name,
        cell: (item) => (
          <div className="flex flex-col">
            <TruncatedCell value={item.name} className="max-w-[260px] font-bold text-foreground" />
            <span className="font-mono text-xs font-bold text-muted-foreground">
              {item.sku_code || '---'}
            </span>
          </div>
        ),
      },
      {
        key: 'sector',
        header: 'Setor',
        sortable: true,
        accessor: (item) => item.sector?.name || '',
        cell: (item) => (
          <TruncatedCell
            value={item.sector?.name || '-'}
            className="max-w-[220px] text-xs font-semibold text-muted-foreground"
          />
        ),
      },
      {
        key: 'current_qty',
        header: 'Saldo Atual',
        sortable: true,
        accessor: (item) => item.current_qty,
        align: 'center',
        cell: (item) => (
          <Badge
            className={cn(
              'border-none px-2 py-0.5 text-xs font-bold',
              item.current_qty === 0 ? 'bg-destructive/15 text-destructive' : 'bg-warning-muted text-warning'
            )}
          >
            {item.current_qty}
          </Badge>
        ),
      },
      {
        key: 'min_stock',
        header: 'Estoque Min.',
        sortable: true,
        accessor: (item) => item.min_stock,
        align: 'center',
        cell: (item) => <span className="text-sm font-bold text-foreground">{item.min_stock}</span>,
      },
      {
        key: 'max_stock',
        header: 'Estoque Max.',
        sortable: true,
        accessor: (item) => item.max_stock,
        align: 'center',
        cell: (item) => <span className="text-sm font-bold text-foreground">{item.max_stock}</span>,
      },
      {
        key: 'deficit',
        header: 'Deficit',
        sortable: true,
        accessor: (item) => item.deficit,
        align: 'center',
        cell: (item) => <span className="text-sm font-bold text-destructive">{item.deficit}</span>,
      },
      {
        key: 'targetDeficit',
        header: 'Repor p/ Max.',
        sortable: true,
        accessor: (item) => item.targetDeficit,
        align: 'center',
        cell: (item) => <span className="text-sm font-bold text-foreground">{item.targetDeficit}</span>,
      },
      {
        key: 'unit',
        header: 'Unidade',
        cell: (item) => (
          <Badge variant="outline" className="text-xs font-bold uppercase">
            {item.unit}
          </Badge>
        ),
        align: 'center',
      },
      {
        key: 'priority',
        header: 'Prioridade',
        sortable: true,
        accessor: (item) => (item.urgencyLevel === 'zerado' ? 0 : 1),
        align: 'center',
        cell: (item) => (
          <Badge
            className={cn(
              'border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              item.urgencyLevel === 'zerado' ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'
            )}
          >
            {item.urgencyLevel === 'zerado' ? 'ZERADO' : 'CRITICO'}
          </Badge>
        ),
      },
    ],
    []
  );

  if (isLoading) {
    return <PageLoading label="Carregando fila de reposição..." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Fila de Reposição"
        description="Materiais abaixo do estoque mínimo"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={exportPDF}>
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <PackageSearch className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-caption-uppercase text-[11px] text-muted-foreground">Total na fila</p>
              <p className="text-stat-display text-3xl">{kpis.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Inbox className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-caption-uppercase text-[11px] text-muted-foreground">Estoque zerado</p>
              <p className="text-stat-display text-3xl">{kpis.zeroed}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <ShieldAlert className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-caption-uppercase text-[11px] text-muted-foreground">Estoque critico</p>
              <p className="text-stat-display text-3xl">{kpis.critical}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-card p-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto ou SKU..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-10 border-border pl-9 text-sm"
            />
          </div>

          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="h-10 w-full border-border text-xs font-bold lg:w-[220px]">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((sector) => (
                <SelectItem key={sector.id} value={sector.id}>
                  {sector.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUrgency} onValueChange={(value) => setSelectedUrgency(value as UrgencyFilter)}>
            <SelectTrigger className="h-10 w-full border-border text-xs font-bold lg:w-[180px]">
              <SelectValue placeholder="Urgencia" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="zerado">Zerado</SelectItem>
              <SelectItem value="critico">Critico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        data={replenishmentItems}
        columns={columns}
        rowKey={(item) => item.id}
        emptyMessage={
          searchTerm || selectedSector !== 'all' || selectedUrgency !== 'all'
            ? 'Nenhum item encontrado para o filtro selecionado.'
            : 'Nao ha itens na fila de reposicao.'
        }
        defaultSort={{ key: 'priority', direction: 'asc' }}
        initialPageSize={25}
      />
    </PageContainer>
  );
}
