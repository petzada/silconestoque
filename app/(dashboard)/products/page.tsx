'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase, fetchAllRows } from '@/lib/supabase';
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
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
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
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfBrandHeader, PDF_HEAD_STYLES, PDF_ALTERNATE_ROW_STYLES } from '@/lib/pdf';
import type { Product, Category, PriceHistory } from '@/lib/types';

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
  category_id: z.string().min(1, 'Selecione uma categoria.'),
  min_stock: z.number().int().min(0, 'Nao pode ser negativo.'),
  max_stock: z.number().int().min(0, 'Nao pode ser negativo.'),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface CSVValidRow {
  row: Record<string, string>;
  categoryName: string;
  initialQty: number;
  costPrice: number | null;
  validUnit: string;
}

interface CSVErrorRow {
  line: number;
  name: string;
  category: string;
  reason: string;
}

interface CSVValidationResult {
  valid: CSVValidRow[];
  errors: CSVErrorRow[];
}

type ProductPdfRow = {
  productId: string;
  name: string;
  currentQty: number;
  costPrice: number | null;
  minStock: number;
  maxStock: number;
};

function slugifyCategoryName(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'categoria'
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      sku_code: '',
      unit: 'unidade',
      category_id: '',
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
      const [productsRes, categoriesRes] = await Promise.all([
        // Traz ativos e desativados: a desativação precisa ter caminho de volta,
        // senão vira porta de mão única. O filtro de status abaixo decide o que
        // aparece na tabela (padrão: só ativos).
        fetchAllRows<Product>(() =>
          supabase
            .from('products')
            .select('*, category:categories(*)')
            .order('name')
        ),
        supabase.from('categories').select('*').order('name'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
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
        category_id: product.category_id,
        min_stock: product.min_stock,
        max_stock: product.max_stock,
      });
    } else {
      setEditingProduct(null);
      form.reset({
        name: '',
        sku_code: '',
        unit: 'unidade',
        category_id: '',
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
      const { data, error } = await fetchAllRows<PriceHistory>(() =>
        supabase
          .from('price_history')
          .select('*')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false })
      );

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
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productToDelete.id);

      if (error) throw error;

      toast.success('Produto desativado com sucesso');
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
      fetchData();
    } catch {
      toast.error('Erro ao desativar produto');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivate = useCallback(async (product: Product) => {
    setReactivatingId(product.id);
    try {
      const { error } = await supabase.from('products').update({ is_active: true }).eq('id', product.id);
      if (error) throw error;
      toast.success('Produto reativado com sucesso');
      fetchData();
    } catch {
      toast.error('Erro ao reativar produto');
    } finally {
      setReactivatingId(null);
    }
  }, []);

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
        category_id: '',
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
        category_id: values.category_id,
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
        category_id: '',
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

      // Aceita tanto o header antigo "setor" quanto o novo "categoria".
      const hasCategoryCol = header.includes('categoria') || header.includes('setor');
      const requiredCols = ['nome', 'unidade'];
      const missingCols = requiredCols.filter(col => !header.includes(col));
      if (!hasCategoryCol) missingCols.push('categoria (ou setor)');
      if (missingCols.length > 0) {
        toast.error(`Colunas obrigatórias faltando: ${missingCols.join(', ')}`);
        setIsValidating(false);
        return;
      }

      const valid: CSVValidRow[] = [];
      const errors: CSVErrorRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';').map(v => v.trim());
        const row: Record<string, string> = {};
        header.forEach((h, idx) => { row[h] = values[idx] || ''; });

        const name = row.nome?.trim() || '';
        const categoryName = (row.categoria?.trim() || row.setor?.trim() || '');

        if (!name) {
          errors.push({ line: i + 1, name: '(vazio)', category: categoryName, reason: 'Nome do produto vazio' });
          continue;
        }

        if (!categoryName) {
          errors.push({ line: i + 1, name, category: '(vazio)', reason: 'Categoria vazia' });
          continue;
        }

        const unit = row.unidade?.toLowerCase() || 'unidade';
        const validUnit = ['unidade', 'caixa', 'pacote'].includes(unit) ? unit : 'unidade';
        const initialQty = parseInt(row.estoque || row.quantidade || row.qty || '0') || 0;
        const costPrice = parseFloat(row.custo || row.cost_price || '0') || null;

        valid.push({ row, categoryName, initialQty, costPrice, validUnit });
      }

      setValidationResult({ valid, errors });
    } catch {
      toast.error('Erro ao processar arquivo CSV');
    } finally {
      setIsValidating(false);
    }
  }, []);

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
      head: [['Linha', 'Produto', 'Categoria', 'Erro']],
      body: validationResult.errors.map(e => [
        e.line.toString(),
        e.name.substring(0, 30) + (e.name.length > 30 ? '...' : ''),
        e.category.substring(0, 20) + (e.category.length > 20 ? '...' : ''),
        e.reason
      ]),
      headStyles: { ...PDF_HEAD_STYLES, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: PDF_ALTERNATE_ROW_STYLES,
    });

    doc.save(`erros_importacao_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('PDF de erros exportado');
  };

  const exportCategoryProductsPDF = async () => {
    if (filterCategory === 'all') {
      toast.error('Selecione uma categoria para extrair o PDF');
      return;
    }

    const selectedCategory = categories.find((category) => category.id === filterCategory);
    const selectedProducts = products.filter(
      (product) => product.is_active && product.category_id === filterCategory
    );

    if (selectedProducts.length === 0) {
      toast.error('Nenhum produto ativo encontrado para esta categoria');
      return;
    }

    setIsExportingPdf(true);
    try {
      const now = new Date();

      const pdfRows: ProductPdfRow[] = selectedProducts
        .map((product) => ({
          productId: product.id,
          name: product.name,
          currentQty: product.current_qty,
          costPrice: product.cost_price,
          minStock: product.min_stock,
          maxStock: product.max_stock,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

      const totalInventoryValue = pdfRows.reduce(
        (sum, row) => sum + row.currentQty * (row.costPrice || 0),
        0
      );

      const doc = new jsPDF();
      drawPdfBrandHeader(doc, 24);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Relatório de Produtos por Categoria', 14, 15);

      doc.setTextColor(10, 10, 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Categoria: ${selectedCategory?.name || 'Categoria'}`, 14, 32);
      doc.text(`Gerado em: ${format(now, 'dd/MM/yyyy HH:mm')}`, 14, 38);

      autoTable(doc, {
        startY: 44,
        head: [['Nome', 'Saldo Atual', 'Custo Unitário', 'Mínimo', 'Máximo']],
        body: pdfRows.map((row) => [
          row.name,
          String(row.currentQty),
          formatCurrency(row.costPrice),
          String(row.minStock),
          String(row.maxStock),
        ]),
        styles: { fontSize: 9 },
        headStyles: { ...PDF_HEAD_STYLES, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: PDF_ALTERNATE_ROW_STYLES,
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
        },
      });

      const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 44;
      const summaryY = tableEndY + 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Total de produtos: ${pdfRows.length}`, 14, summaryY);
      doc.text(`Valor total em estoque: ${formatCurrency(totalInventoryValue)}`, 14, summaryY + 6);

      const fileName = `produtos_${slugifyCategoryName(selectedCategory?.name || 'categoria')}_${format(now, 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(fileName);
      toast.success('PDF exportado com sucesso');
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExportingPdf(false);
    }
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
      // Categorias que ainda não existem são criadas a partir do próprio CSV
      // (comparação por nome, ignorando maiúsculas/minúsculas, para não
      // duplicar uma categoria já cadastrada com grafia diferente).
      const categoryIdByName = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));
      const missingCategoryNames = Array.from(
        new Set(validationResult.valid.map((item) => item.categoryName))
      ).filter((name) => !categoryIdByName.has(name.toLowerCase().trim()));

      if (missingCategoryNames.length > 0) {
        const { data: newCategories, error: categoryError } = await supabase
          .from('categories')
          .insert(missingCategoryNames.map((name) => ({ name })))
          .select();
        if (categoryError) throw categoryError;
        newCategories?.forEach((category) => categoryIdByName.set(category.name.toLowerCase().trim(), category.id));
      }

      for (const item of validationResult.valid) {
        try {
          const categoryId = categoryIdByName.get(item.categoryName.toLowerCase().trim());
          if (!categoryId) throw new Error('Categoria não encontrada');

          const { data: newProduct } = await supabase.from('products').insert({
            name: item.row.nome,
            sku_code: item.row.sku || item.row.codigo || null,
            unit: item.validUnit,
            category_id: categoryId,
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
    const matchesCategory = filterCategory === 'all' || p.category_id === filterCategory;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && p.is_active) ||
      (filterStatus === 'inactive' && !p.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatus = (p: Product) => {
    if (p.current_qty === 0) return { label: 'ZERADO', color: 'bg-destructive text-destructive-foreground' };
    if (p.current_qty < p.min_stock) return { label: 'CRITICO', color: 'bg-warning text-warning-foreground' };
    return { label: 'ESTAVEL', color: 'bg-success-muted text-success' };
  };

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        key: 'sku',
        header: 'SKU',
        sortable: true,
        accessor: (product) => product.sku_code || '',
        cell: (product) => (
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold text-muted-foreground">
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
          <div className="flex items-center gap-2">
            <TruncatedCell
              value={product.name}
              className={cn('max-w-[300px] font-bold text-foreground', !product.is_active && 'opacity-50')}
            />
            {!product.is_active && (
              <Badge variant="outline" className="shrink-0 rounded-md border-none bg-muted px-1.5 py-0 text-[10px] font-bold text-muted-foreground">
                DESATIVADO
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Categoria',
        sortable: true,
        accessor: (product) => product.category?.name || '',
        cell: (product) => (
          <TruncatedCell value={product.category?.name || '-'} className="max-w-[240px] text-xs font-semibold text-muted-foreground" />
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
            <span className="text-sm font-bold text-foreground leading-none">{product.current_qty}</span>
            <span className="mt-0.5 text-xs font-bold uppercase text-muted-foreground">{product.unit}</span>
          </div>
        ),
      },
      {
        key: 'cost_price',
        header: 'Custo Unit',
        sortable: true,
        accessor: (product) => product.cost_price || 0,
        align: 'right',
        cell: (product) => <span className="font-bold text-foreground text-sm">{formatCurrency(product.cost_price)}</span>,
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
            <Badge className={cn('border-none px-2 py-0.5 text-xs font-bold uppercase tracking-wider', status.color)}>
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
              className="h-8 w-8 text-muted-foreground hover:bg-muted"
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
              className="h-8 w-8 text-muted-foreground hover:bg-muted"
              onClick={() => handleOpenDialog(product)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {product.is_active ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Desativar produto"
                aria-label="Desativar produto"
                className="h-8 w-8 text-destructive/70 hover:bg-destructive/10"
                onClick={() => handleOpenDeleteDialog(product)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Reativar produto"
                aria-label="Reativar produto"
                className="h-8 w-8 text-muted-foreground hover:bg-success-muted hover:text-success"
                disabled={reactivatingId === product.id}
                onClick={() => void handleReactivate(product)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [getStatus, handleOpenDeleteDialog, handleOpenDialog, handleOpenHistory, handleReactivate, reactivatingId]
  );

  if (isLoading) return <PageLoading label="Carregando catálogo..." />;

  return (
    <PageContainer>
      <PageHeader
        title="Produtos"
        description="Catálogo de materiais do almoxarifado"
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="h-4 w-4" /> Importar CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void exportCategoryProductsPDF()} disabled={isExportingPdf}>
              <FileDown className="h-4 w-4" /> {isExportingPdf ? 'Extraindo...' : 'Extrair PDF'}
            </Button>
            <Button type="button" size="sm" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 items-center bg-card p-2.5 rounded-lg border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 border-border font-medium text-sm"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[220px] h-10 border-border text-sm font-semibold">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="all" className="font-semibold">Todas as categorias</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
          <SelectTrigger className="w-full sm:w-[170px] h-10 border-border text-sm font-semibold">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="active" className="font-semibold">Ativos</SelectItem>
            <SelectItem value="inactive">Desativados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filteredProducts}
        columns={columns}
        rowKey={(product) => product.id}
        emptyMessage={searchTerm || filterCategory !== 'all' || filterStatus !== 'active' ? 'Nenhum produto encontrado para este filtro.' : 'Nenhum produto cadastrado.'}
        defaultSort={{ key: 'name', direction: 'asc' }}
        initialPageSize={25}
      />

      {/* Dialog: Novo/Editar Produto */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader><DialogTitle className="text-lg font-bold flex items-center gap-2">
            {editingProduct ? <><Pencil className="h-4 w-4 text-muted-foreground" /> Editar Material</> : <><Plus className="h-4 w-4 text-primary" /> Novo Material</>}
          </DialogTitle></DialogHeader>
          <Form {...form}>
            <form className="grid gap-4 pt-4" onSubmit={(event) => void handleSave(event)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nome do Produto</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10 bg-muted" autoFocus />
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
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">SKU</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-10 bg-muted" />
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
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Unid. Medida</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-10 border-border bg-muted"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-lg">{UNIT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Categoria</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-10 border-border bg-muted"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent className="rounded-lg">{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
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
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Minimo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-10 bg-muted"
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
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Maximo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-10 bg-muted"
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
                <Button type="button" variant="ghost" className="h-10 px-6 font-bold" onClick={() => handleDialogOpenChange(false)}>Cancelar</Button>
                <Button type="submit" className="h-10 px-8 font-bold" disabled={isSaving}>Salvar</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Desativar Produto"
        description={`O produto "${productToDelete?.name || ''}" será desativado e deixará de aparecer nas listagens. O histórico de movimentações e de preços será preservado.`}
        onConfirm={handleDeleteProduct}
        confirmLabel="Desativar produto"
        cancelLabel="Cancelar"
        isLoading={isDeleting}
      />

      {/* Dialog: Importar CSV com Validação */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className={cn('p-6', validationResult ? 'max-w-2xl' : 'max-w-md')}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" /> Importar Produtos via CSV
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Colunas: Nome, Categoria (ou Setor), Unidade (obrigatórias) | SKU, Minimo, Maximo, Custo, Estoque (opcionais).
              Categorias novas são criadas automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 border-2 border-dashed border-border bg-muted text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-bold text-muted-foreground">{importFile ? importFile.name : 'Clique para selecionar arquivo'}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Formato CSV separado por ponto e vírgula (;)</p>
              </label>
            </div>

            {isValidating && (
              <div className="text-center py-4">
                <p className="text-sm font-bold text-muted-foreground animate-pulse">Validando arquivo...</p>
              </div>
            )}

            {validationResult && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 p-3 bg-success-muted rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-bold text-success">{validationResult.valid.length} válidos</p>
                      <p className="text-[10px] text-success">Prontos para importar</p>
                    </div>
                  </div>
                  <div className="flex-1 p-3 bg-destructive/10 rounded-lg flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-sm font-bold text-destructive">{validationResult.errors.length} com erro</p>
                      <p className="text-[10px] text-destructive">Verifique abaixo</p>
                    </div>
                  </div>
                </div>

                {validationResult.errors.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-destructive/10 px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-destructive">Linhas com Erro</span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-destructive hover:bg-destructive/15" onClick={exportErrorsPDF}>
                        <FileDown className="h-3 w-3 mr-1" /> Exportar PDF
                      </Button>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted">
                            <TableHead className="py-2 px-3 text-[10px] font-bold w-[60px]">Linha</TableHead>
                            <TableHead className="py-2 px-3 text-[10px] font-bold">Produto</TableHead>
                            <TableHead className="py-2 px-3 text-[10px] font-bold">Categoria</TableHead>
                            <TableHead className="py-2 px-3 text-[10px] font-bold">Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.errors.slice(0, 20).map((e, i) => (
                            <TableRow key={i} className="border-border">
                              <TableCell className="py-1.5 px-3 text-xs font-mono">{e.line}</TableCell>
                              <TableCell className="py-1.5 px-3 text-xs font-medium truncate max-w-[120px]">{e.name}</TableCell>
                              <TableCell className="py-1.5 px-3 text-xs text-muted-foreground">{e.category}</TableCell>
                              <TableCell className="py-1.5 px-3 text-xs text-destructive font-medium">{e.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {validationResult.errors.length > 20 && (
                        <p className="text-center text-[10px] text-muted-foreground py-2">... e mais {validationResult.errors.length - 20} erros. Exporte o PDF para ver todos.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" className="h-10 text-xs font-bold" onClick={handleCloseImportDialog}>Cancelar</Button>
              <Button
                className="h-10 px-8 text-xs font-bold"
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
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-success" /> Histórico de Preços
            </DialogTitle>
            {selectedProductForHistory && (
              <p className="text-sm text-muted-foreground font-medium">{selectedProductForHistory.name}</p>
            )}
          </DialogHeader>
          <div className="pt-4">
            {priceHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto opacity-30 mb-2" />
                <p className="text-xs font-bold">Nenhuma variação de preço registrada</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {priceHistory.map((h) => {
                  const variation = h.old_price ? ((h.new_price - h.old_price) / h.old_price) * 100 : 0;
                  const isIncrease = variation > 0;
                  return (
                    <div key={h.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">NF: {h.invoice_number || '---'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {h.old_price && <p className="text-[10px] text-muted-foreground line-through">{formatCurrency(h.old_price)}</p>}
                          <p className="text-sm font-bold text-foreground">{formatCurrency(h.new_price)}</p>
                        </div>
                        {h.old_price && (
                          <Badge className={cn("font-bold text-[10px] h-6 px-2 border-none", isIncrease ? "bg-destructive/15 text-destructive" : "bg-success-muted text-success")}>
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
