'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import {
  AlertTriangle,
  Calendar,
  FileDown,
  Filter,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from "@/lib/utils";
import { drawPdfBrandHeader, PDF_HEAD_STYLES } from '@/lib/pdf';
import type { PurchaseOrderItem, PurchaseOrderType, Category } from '@/lib/types';

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function PurchaseOrdersPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [orderType, setOrderType] = useState<PurchaseOrderType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const generateOrder = async (type: PurchaseOrderType) => {
    setIsLoading(true);
    setOrderType(type);

    try {
      let query = supabase.from('products').select('*, category:categories(*)').eq('is_active', true);
      if (selectedCategory !== 'all') query = query.eq('category_id', selectedCategory);

      const { data: products } = await query;
      const filtered = products?.filter(p => type === 'emergency' ? p.current_qty === 0 || p.current_qty < p.min_stock : p.current_qty < p.max_stock) || [];

      const items: PurchaseOrderItem[] = filtered.map(p => ({
        product_id: p.id,
        product_name: p.name,
        sku_code: p.sku_code,
        unit: p.unit,
        category_name: p.category?.name || '',
        current_qty: p.current_qty,
        min_stock: p.min_stock,
        max_stock: p.max_stock,
        order_qty: p.max_stock - p.current_qty,
        cost_price: p.cost_price,
        total_cost: p.cost_price ? p.cost_price * (p.max_stock - p.current_qty) : null,
      })).sort((a, b) => a.category_name.localeCompare(b.category_name) || a.product_name.localeCompare(b.product_name));

      setOrderItems(items);
      setIsDialogOpen(true);
    } catch (e) {
      toast.error('Erro ao gerar sugestão');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      drawPdfBrandHeader(doc, 30);
      doc.setTextColor(255);
      doc.setFontSize(18);
      doc.text('SILCON AMBIENTAL', 14, 20);

      doc.setTextColor(0);
      doc.setFontSize(14);
      doc.text(orderType === 'emergency' ? 'SUGESTÃO EMERGENCIAL' : 'SUGESTÃO MENSAL', 14, 45);

      autoTable(doc, {
        startY: 55,
        head: [['SKU', 'PRODUTO', 'CATEGORIA', 'UND', 'SALDO', 'PEDIR', 'CUSTO', 'TOTAL']],
        body: orderItems.map(i => [i.sku_code || '-', i.product_name, i.category_name, i.unit.substring(0, 2).toUpperCase(), i.current_qty, i.order_qty, formatCurrency(i.cost_price), formatCurrency(i.total_cost)]),
        styles: { fontSize: 8 },
        headStyles: PDF_HEAD_STYLES
      });

      doc.save(orderType === 'emergency' ? 'sugestao_emergencial.pdf' : 'sugestao_mensal.pdf');
      toast.success('PDF gerado');
    } catch (e) {
      toast.error('Erro ao exportar PDF');
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Sugestões de Compra"
        description="Sugestões de compra emergenciais e programadas"
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
            <Filter className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 w-[200px] border-none text-xs font-semibold shadow-none">
                <SelectValue placeholder="Filtrar Categoria" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="all" className="font-semibold">Todos os produtos</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Emergencial */}
        <Card className="overflow-hidden py-0">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center text-destructive"><AlertTriangle className="h-5 w-5" /></div>
              <h2 className="text-display text-lg text-foreground">Sugestão Emergencial</h2>
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-6 flex-1">Itens abaixo do estoque mínimo de segurança.</p>
            <Button className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 text-xs font-semibold rounded-md" onClick={() => generateOrder('emergency')} disabled={isLoading}>
              Gerar Lista de Críticos <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>

        {/* Mensal */}
        <Card className="overflow-hidden py-0">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center text-primary"><Calendar className="h-5 w-5" /></div>
              <h2 className="text-display text-lg text-foreground">Sugestão Mensal</h2>
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-6 flex-1">Reposição programada para atingir o estoque máximo.</p>
            <Button className="w-full h-10 text-xs font-semibold rounded-md" onClick={() => generateOrder('monthly')} disabled={isLoading}>
              Gerar Reposição Total <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Preview Dialog: Compact */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className={cn('px-8 py-6', orderType === 'emergency' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}>
            <DialogTitle className="text-xl font-bold mb-1">Prévia da Sugestão</DialogTitle>
            <p className="text-xs font-medium opacity-90">{orderItems.length} itens identificados para compra.</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border italic">
                  <TableHead className="font-bold text-[10px] uppercase">Material</TableHead>
                  <TableHead className="text-center font-bold text-[10px] uppercase">Saldo</TableHead>
                  <TableHead className="text-center font-bold text-[10px] uppercase">Comprar</TableHead>
                  <TableHead className="text-right font-bold text-[10px] uppercase">Estimado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map(i => (
                  <TableRow key={i.product_id} className="border-border">
                    <TableCell className="py-2.5"><span className="font-bold text-foreground text-sm">{i.product_name}</span></TableCell>
                    <TableCell className="text-center text-xs font-bold text-muted-foreground">{i.current_qty}</TableCell>
                    <TableCell className="text-center"><span className="inline-block px-2.5 py-1 bg-foreground text-background rounded-md text-xs font-bold">{i.order_qty}</span></TableCell>
                    <TableCell className="text-right font-bold text-foreground text-sm">{formatCurrency(i.total_cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 bg-muted flex justify-end gap-2 border-t">
            <Button variant="ghost" className="h-10 text-xs font-bold" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            {orderItems.length > 0 && (
              <Button className="h-10 px-8 text-xs" onClick={generatePDF}>
                <FileDown className="h-3.5 w-3.5 mr-2" /> Exportar PDF
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
