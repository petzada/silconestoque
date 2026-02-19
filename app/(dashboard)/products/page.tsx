'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, TruncatedCell, type DataTableColumn } from '@/components/ui/data-table';
import { PageContainer } from '@/components/layout/page-container';
import {
  Plus,
  Pencil,
  Package,
  Upload,
  Search,
  History,
  TrendingUp,
  TrendingDown,
  Trash2,
  FileDown,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product, Sector, PriceHistory } from '@/lib/types';

const UNIT_OPTIONS = [
  { value: 'unidade', label: 'Unidade' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'pacote', label: 'Pacote' },
];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const productFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do produto com pelo menos 2 caracteres.'),
  sku_code: z.string().optional(),
  unit: z.enum(['unidade', 'caixa', 'pacote']),
  sector_id: z.string().min(1, 'Selecione um setor.'),
  min_stock: z.number().int().min(0, 'Nao pode ser negativo.'),
  max_stock: z.number().int().min(0, 'Nao pode ser negativo.'),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface CSVValidRow {
  row: Record<string, string>;
  sectorId: string;
  initialQty: number;
  costPrice: number | null;
  validUnit: string;
}

interface CSVErrorRow {
  line: number;
  name: string;
  sector: string;
  reason: string;
}

interface CSVValidationResult {
  valid: CSVValidRow[];
  errors: CSVErrorRow[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      sku_code: '',
      unit: 'unidade',
      sector_id: '',
      min_stock: 0,
      max_stock: 0,
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [productsRes, sectorsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, sector:sectors(*)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('sectors').select('*').order('name'),
      ]);

      setProducts(productsRes.data || []);
      setSectors(sectorsRes.data || []);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      form.reset({
        name: product.name,
        sku_code: product.sku_code || '',
        unit: product.unit,
        sector_id: product.sector_id,
        min_stock: product.min_stock,
        max_stock: product.max_stock,
      });
    } else {
      setEditingProduct(null);
      form.reset({
        name: '',
        sku_code: '',
        unit: 'unidade',
        sector_id: '',
        min_stock: 0,
        max_stock: 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleOpenHistory = async (product: Product) => {
    setSelectedProductForHistory(product);
    setIsHistoryDialogOpen(true);
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPriceHistory(data || []);
    } catch {
      toast.error('Erro ao carregar histórico de preços');
    }
  };

  const handleOpenDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      await supabase.from('price_history').delete().eq('product_id', productToDelete.id);
      await supabase.from('movements').delete().eq('product_id', productToDelete.id);
      const { error } = await supabase.from('products').delete().eq('id', productToDelete.id);

      if (error) throw error;

      toast.success('Produto excluído com sucesso');
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
      fetchData();
    } catch {
      toast.error('Erro ao excluir produto');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && form.formState.isDirty) {
      const shouldClose = window.confirm('Descartar alteracoes nao salvas?');
      if (!shouldClose) return;
    }

    if (!open) {
      setEditingProduct(null);
      form.reset({
        name: '',
        sku_code: '',
        unit: 'unidade',
        sector_id: '',
        min_stock: 0,
        max_stock: 0,
      });
    }

    setIsDialogOpen(open);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      const productData = {
        name: values.name.trim(),
        sku_code: values.sku_code?.trim() || null,
        unit: values.unit,
        sector_id: values.sector_id,
        min_stock: values.min_stock || 0,
        max_stock: values.max_stock || 0,
      };

      if (editingProduct) {
        await supabase.from('products').update(productData).eq('id', editingProduct.id);
      } else {
        await supabase.from('products').insert({ ...productData, current_qty: 0 });
      }

      toast.success(editingProduct ? 'Atualizado' : 'Criado');
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset({
        name: '',
        sku_code: '',
        unit: 'unidade',
        sector_id: '',
        min_stock: 0,
        max_stock: 0,
      });
      fetchData();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  });

  const validateCSV = useCallback(async (file: File) => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        text = decoder.decode(buffer);
      } catch {
        text = new TextDecoder('windows-1252').decode(buffer);
      }
      const lines = text.split('\n').filter(line => line.trim());
      const header = lines[0].split(';').map(h => h.trim().toLowerCase());

      const requiredCols = ['nome', 'setor', 'unidade'];
      const missingCols = requiredCols.filter(col => !header.includes(col));
      if (missingCols.length > 0) {
        toast.error(`Colunas obrigatórias faltando: ${missingCols.join(', ')}`);
        setIsValidating(false);
        return;
      }

      const sectorMap = new Map(sectors.map(s => [s.name.toLowerCase().trim(), s.id]));
      const valid: CSVValidRow[] = [];
      const errors: CSVErrorRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';').map(v => v.trim());
        const row: Record<string, string> = {};
        header.forEach((h, idx) => { row[h] = values[idx] || ''; });

        const name = row.nome?.trim() || '';
        const sectorName = row.setor?.trim() || '';
        const sectorId = sectorMap.get(sectorName.toLowerCase());

        if (!name) {
          errors.push({ line: i + 1, name: '(vazio)', sector: sectorName, reason: 'Nome do produto vazio' });
          continue;
        }

        if (!sectorId) {
          errors.push({ line: i + 1, name, sector: sectorName || '(vazio)', reason: `Setor "${sectorName}" não existe` });
          continue;
        }

        const unit = row.unidade?.toLowerCase() || 'unidade';
        const validUnit = ['unidade', 'caixa', 'pacote'].includes(unit) ? unit : 'unidade';
        const initialQty = parseInt(row.estoque || row.quantidade || row.qty || '0') || 0;
        const costPrice = parseFloat(row.custo || row.cost_price || '0') || null;

        valid.push({ row, sectorId, initialQty, costPrice, validUnit });
      }

      setValidationResult({ valid, errors });
    } catch {
      toast.error('Erro ao processar arquivo CSV');
    } finally {
      setIsValidating(false);
    }
  }, [sectors]);

  const handleFileSelect = (file: File | null) => {
    setImportFile(file);
    setValidationResult(null);
    if (file) {
      validateCSV(file);
    }
  };

  const exportErrorsPDF = () => {
    if (!validationResult || validationResult.errors.length === 0) return;

    const doc = new jsPDF();
    const now = format(new Date(), 'dd/MM/yyyy HH:mm');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SILCON AMBIENTAL', 14, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Erros - Importação CSV', 14, 28);
    doc.setFontSize(9);
    doc.text(`Data: ${now}`, 14, 35);

    doc.setFontSize(10);
    doc.text(`Total de linhas: ${(validationResult.valid.length + validationResult.errors.length)}`, 14, 45);
    doc.text(`Válidas: ${validationResult.valid.length}`, 14, 51);
    doc.setTextColor(220, 38, 38);
    doc.text(`Com erro: ${validationResult.errors.length}`, 14, 57);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 65,
      head: [['Linha', 'Produto', 'Setor', 'Erro']],
      body: validationResult.errors.map(e => [
        e.line.toString(),
        e.name.substring(0, 30) + (e.name.length > 30 ? '...' : ''),
        e.sector.substring(0, 20) + (e.sector.length > 20 ? '...' : ''),
        e.reason
      ]),
      headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`erros_importacao_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('PDF de erros exportado');
  };

  const handleImportValidRows = async () => {
    if (!validationResult || validationResult.valid.length === 0) {
      toast.error('Nenhum item válido para importar');
      return;
    }

    setIsImporting(true);
    let imported = 0;
    let errors = 0;

    try {
      for (const item of validationResult.valid) {
        try {
          const { data: newProduct } = await supabase.from('products').insert({
            name: item.row.nome,
            sku_code: item.row.sku || item.row.codigo || null,
            unit: item.validUnit,
            sector_id: item.sectorId,
            current_qty: 0,
            min_stock: parseInt(item.row.minimo || item.row.min_stock || '0') || 0,
            max_stock: parseInt(item.row.maximo || item.row.max_stock || '0') || 0,
            cost_price: item.costPrice,
          }).select().single();

          if (item.initialQty > 0 && newProduct) {
            await supabase.from('movements').insert({
              product_id: newProduct.id,
              type: 'IN',
              quantity: item.initialQty,
              entity_name: 'Importação CSV',
              unit_value: item.costPrice,
              is_initial_import: true,
            });
          }

          imported++;
        } catch {
          errors++;
        }
      }

      toast.success(`Importados: ${imported} | Erros: ${errors}`);
      setIsImportDialogOpen(false);
      setImportFile(null);
      setValidationResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchData();
    } catch {
      toast.error('Erro ao importar produtos');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseImportDialog = () => {
    setIsImportDialogOpen(false);
    setImportFile(null);
    setValidationResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = filterSector === 'all' || p.sector_id === filterSector;
    return matchesSearch && matchesSector;
  });

  const getStatus = (p: Product) => {
    if (p.current_qty === 0) return { label: 'ZERADO', color: 'bg-red-500' };
    if (p.current_qty <= p.min_stock) return { label: 'CRITICO', color: 'bg-amber-600' };
    return { label: 'ESTAVEL', color: 'bg-brand-primary' };
  };

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        key: 'sku',
        header: 'SKU',
        sortable: true,
        accessor: (product) => product.sku_code || '',
        cell: (product) => (
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-600">
            {product.sku_code || '---'}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Nome',
        sortable: true,
        accessor: (product) => product.name,
        cell: (product) => (
          <TruncatedCell value={product.name} className="max-w-[300px] font-bold text-slate-800" />
        ),
      },
      {
        key: 'sector',
        header: 'Setor',
        sortable: true,
        accessor: (product) => product.sector?.name || '',
        cell: (product) => (
          <TruncatedCell value={product.sector?.name || '-'} className="max-w-[240px] text-xs font-semibold text-slate-500" />
        ),
      },
      {
        key: 'current_qty',
        header: 'Saldo',
        sortable: true,
        accessor: (product) => product.current_qty,
        align: 'center',
        cell: (product) => (
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-slate-900 leading-none">{product.current_qty}</span>
            <span className="mt-0.5 text-xs font-bold uppercase text-slate-400">{product.unit}</span>
          </div>
        ),
      },
      {
        key: 'cost_price',
        header: 'Custo Unit',
        sortable: true,
        accessor: (product) => product.cost_price || 0,
        align: 'right',
        cell: (product) => <span className="font-bold text-slate-700 text-sm">{formatCurrency(product.cost_price)}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        accessor: (product) => getStatus(product).label,
        align: 'center',
        cell: (product) => {
          const status = getStatus(product);
          return (
            <Badge className={cn('border-none px-2 py-0.5 text-xs font-black uppercase tracking-wider', status.color)}>
              {status.label}
            </Badge>
          );
        },
      },
      {
        key: 'actions',
        header: 'Acoes',
        align: 'right',
        cell: (product) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Ver historico de precos"
              aria-label="Ver historico de precos"
              className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100"
              onClick={() => handleOpenHistory(product)}
            >
              <History className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Editar produto"
              aria-label="Editar produto"
              className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100"
              onClick={() => handleOpenDialog(product)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Excluir produto"
              aria-label="Excluir produto"
              className="h-8 w-8 rounded-lg text-red-400 hover:bg-red-50"
              onClick={() => handleOpenDeleteDialog(product)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [filteredProducts]
  );

  if (isLoading) return <div className="text-center py-20 text-slate-400 font-bold">Carregando catálogo...</div>;

  return (
    <PageContainer>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Produtos</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="h-9 text-xs font-bold px-4" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-2" /> Importar CSV
          </Button>
          <Button className="bg-brand-primary hover:bg-brand-primary-hover h-9 text-xs font-bold px-4 shadow-sm" onClick={() => handleOpenDialog()}>
            <Plus className="h-3.5 w-3.5 mr-2" /> Novo Produto
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-center bg-white p-2.5 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 border-slate-200 rounded-lg font-medium text-sm"
          />
        </div>
        <Select value={filterSector} onValueChange={setFilterSector}>
          <SelectTrigger className="w-full sm:w-[220px] h-10 border-slate-200 rounded-lg text-sm font-semibold">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="font-bold">Todos os setores</SelectItem>
            {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filteredProducts}
        columns={columns}
        rowKey={(product) => product.id}
        emptyMessage={searchTerm || filterSector !== 'all' ? 'Nenhum produto encontrado para este filtro.' : 'Nenhum produto cadastrado.'}
        defaultSort={{ key: 'name', direction: 'asc' }}
        initialPageSize={25}
      />

      {/* Dialog: Novo/Editar Produto */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md rounded-2xl p-6 shadow-2xl border-none">
          <DialogHeader><DialogTitle className="text-lg font-bold flex items-center gap-2">
            {editingProduct ? <><Pencil className="h-4 w-4 text-slate-600" /> Editar Material</> : <><Plus className="h-4 w-4 text-brand-primary" /> Novo Material</>}
          </DialogTitle></DialogHeader>
          <Form {...form}>
            <form className="grid gap-4 pt-4" onSubmit={(event) => void handleSave(event)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Nome do Produto</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10 bg-slate-50 rounded-lg" autoFocus />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">SKU</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-10 bg-slate-50 rounded-lg" />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Unid. Medida</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-10 border-slate-200 rounded-lg bg-slate-50"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">{UNIT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="sector_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Setor Alocado</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-10 border-slate-200 rounded-lg bg-slate-50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent className="rounded-xl">{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Minimo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-10 bg-slate-50 rounded-lg"
                          value={field.value ?? ''}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Maximo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-10 bg-slate-50 rounded-lg"
                          value={field.value ?? ''}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" className="h-10 px-6 rounded-lg font-bold" onClick={() => handleDialogOpenChange(false)}>Cancelar</Button>
                <Button type="submit" className="bg-brand-primary hover:bg-brand-primary-hover h-10 px-8 rounded-lg font-bold" disabled={isSaving}>Salvar</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Confirmar Exclusao"
        description={`Esta acao ira excluir o produto "${productToDelete?.name || ''}" e todas as suas movimentacoes associadas.`}
        onConfirm={handleDeleteProduct}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        isLoading={isDeleting}
      />

      {/* Dialog: Importar CSV com Validação */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className={cn("rounded-2xl p-6 shadow-2xl border-none", validationResult ? "max-w-2xl" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-600" /> Importar Produtos via CSV
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Colunas: Nome, Setor, Unidade (obrigatórias) | SKU, Minimo, Maximo, Custo, Estoque (opcionais)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600">{importFile ? importFile.name : 'Clique para selecionar arquivo'}</p>
                <p className="text-[10px] text-slate-400 mt-1">Formato CSV separado por ponto e vírgula (;)</p>
              </label>
            </div>

            {isValidating && (
              <div className="text-center py-4">
                <p className="text-sm font-bold text-slate-500 animate-pulse">Validando arquivo...</p>
              </div>
            )}

            {validationResult && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{validationResult.valid.length} válidos</p>
                      <p className="text-[10px] text-emerald-600">Prontos para importar</p>
                    </div>
                  </div>
                  <div className="flex-1 p-3 bg-red-50 rounded-lg flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm font-bold text-red-700">{validationResult.errors.length} com erro</p>
                      <p className="text-[10px] text-red-600">Verifique abaixo</p>
                    </div>
                  </div>
                </div>

                {validationResult.errors.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-red-50 px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-red-700">Linhas com Erro</span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-red-700 hover:bg-red-100" onClick={exportErrorsPDF}>
                        <FileDown className="h-3 w-3 mr-1" /> Exportar PDF
                      </Button>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="py-2 px-3 text-[10px] font-bold w-[60px]">Linha</TableHead>
                            <TableHead className="py-2 px-3 text-[10px] font-bold">Produto</TableHead>
                            <TableHead className="py-2 px-3 text-[10px] font-bold">Setor</TableHead>
                            <TableHead className="py-2 px-3 text-[10px] font-bold">Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.errors.slice(0, 20).map((e, i) => (
                            <TableRow key={i} className="border-slate-100">
                              <TableCell className="py-1.5 px-3 text-xs font-mono">{e.line}</TableCell>
                              <TableCell className="py-1.5 px-3 text-xs font-medium truncate max-w-[120px]">{e.name}</TableCell>
                              <TableCell className="py-1.5 px-3 text-xs text-slate-500">{e.sector}</TableCell>
                              <TableCell className="py-1.5 px-3 text-xs text-red-600 font-medium">{e.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {validationResult.errors.length > 20 && (
                        <p className="text-center text-[10px] text-slate-400 py-2">... e mais {validationResult.errors.length - 20} erros. Exporte o PDF para ver todos.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" className="h-10 text-xs font-bold" onClick={handleCloseImportDialog}>Cancelar</Button>
              <Button
                className="bg-brand-primary hover:bg-brand-primary-hover h-10 px-8 text-xs font-bold rounded-lg"
                onClick={handleImportValidRows}
                disabled={isImporting || !validationResult || validationResult.valid.length === 0}
              >
                {isImporting ? 'Importando...' : `Importar ${validationResult?.valid.length || 0} Válidos`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico de Preços */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6 shadow-2xl border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-600" /> Histórico de Preços
            </DialogTitle>
            {selectedProductForHistory && (
              <p className="text-sm text-slate-500 font-medium">{selectedProductForHistory.name}</p>
            )}
          </DialogHeader>
          <div className="pt-4">
            {priceHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <History className="h-12 w-12 mx-auto opacity-30 mb-2" />
                <p className="text-xs font-bold">Nenhuma variação de preço registrada</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {priceHistory.map((h) => {
                  const variation = h.old_price ? ((h.new_price - h.old_price) / h.old_price) * 100 : 0;
                  const isIncrease = variation > 0;
                  return (
                    <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">NF: {h.invoice_number || '---'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {h.old_price && <p className="text-[10px] text-slate-400 line-through">{formatCurrency(h.old_price)}</p>}
                          <p className="text-sm font-bold text-slate-900">{formatCurrency(h.new_price)}</p>
                        </div>
                        {h.old_price && (
                          <Badge className={cn("font-bold text-[10px] h-6 px-2 border-none", isIncrease ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>
                            {isIncrease ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                            {Math.abs(variation).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
