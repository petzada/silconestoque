'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Check,
  ChevronsUpDown,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import type { Movement, Product, MovementFormData } from '@/lib/types';

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const initialFormData: MovementFormData = {
  product_id: '',
  type: 'IN',
  quantity: 1,
  entity_name: '',
  unit_value: undefined,
  invoice_number: '',
  is_initial_import: false,
};

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<Movement | null>(null);
  const [formData, setFormData] = useState<MovementFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === formData.product_id) || null;
  }, [formData.product_id, products]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [movementsRes, productsRes] = await Promise.all([
        supabase
          .from('movements')
          .select('*, product:products(*, sector:sectors(*))')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('products')
          .select('*, sector:sectors(*)')
          .eq('is_active', true)
          .order('name'),
      ]);

      setMovements(movementsRes.data || []);
      setProducts(productsRes.data || []);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (type: 'IN' | 'OUT') => {
    setFormData({ ...initialFormData, type });
    setIsDialogOpen(true);
  };

  const handleOpenDeleteDialog = (movement: Movement) => {
    setMovementToDelete(movement);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteMovement = async () => {
    if (!movementToDelete) return;

    try {
      // Reverter a quantidade no produto
      const product = movementToDelete.product;
      if (product) {
        const newQty = movementToDelete.type === 'IN'
          ? product.current_qty - movementToDelete.quantity
          : product.current_qty + movementToDelete.quantity;

        await supabase
          .from('products')
          .update({ current_qty: Math.max(0, newQty) })
          .eq('id', product.id);
      }

      // Deletar a movimentação
      const { error } = await supabase.from('movements').delete().eq('id', movementToDelete.id);
      if (error) throw error;

      toast.success('Movimentação excluída e estoque revertido');
      setIsDeleteDialogOpen(false);
      setMovementToDelete(null);
      fetchData();
    } catch {
      toast.error('Erro ao excluir movimentação');
    }
  };

  const handleSave = async () => {
    if (!formData.product_id || formData.quantity <= 0) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setIsSaving(true);
    try {
      const movementData = {
        product_id: formData.product_id,
        type: formData.type,
        quantity: formData.quantity,
        entity_name: formData.entity_name?.trim() || null,
        unit_value: formData.type === 'IN' && formData.invoice_number ? formData.unit_value || null : null,
        invoice_number: formData.type === 'IN' ? formData.invoice_number?.trim() || null : null,
      };

      const { error } = await supabase.from('movements').insert(movementData);
      if (error) throw error;

      toast.success('Registrado com sucesso');
      setIsDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message.includes('stock') ? 'Estoque insuficiente' : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMovements = movements.filter((m) => {
    const matchesSearch = m.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || m.type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) return <div className="text-center py-20 text-slate-400 font-bold">Carregando movimentações...</div>;

  return (
    <div className="max-w-[1700px] mx-auto space-y-4 px-4 md:px-6 pt-2 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Movimentações de Estoque</h1>
          <p className="text-xs text-slate-500 font-medium">Histórico auditável de entradas e saídas.</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-[#387146] hover:bg-[#2b5836] h-9 text-xs font-bold px-4" onClick={() => handleOpenDialog('IN')}>
            <ArrowDownCircle className="h-3.5 w-3.5 mr-2" /> Registrar Entrada
          </Button>
          <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-9 text-xs font-bold px-4" onClick={() => handleOpenDialog('OUT')}>
            <ArrowUpCircle className="h-3.5 w-3.5 mr-2" /> Registrar Saída
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-center bg-white p-2.5 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Produto, fornecedor ou NF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 border-slate-200 rounded-lg text-sm"
          />
        </div>
        <Tabs value={filterType} onValueChange={setFilterType} className="shrink-0">
          <TabsList className="h-10 p-1 bg-slate-100 rounded-lg">
            <TabsTrigger value="all" className="text-xs font-bold px-4 h-8 rounded-md">TODAS</TabsTrigger>
            <TabsTrigger value="IN" className="text-xs font-bold px-4 h-8 rounded-md data-[state=active]:bg-[#387146] data-[state=active]:text-white">ENTRADAS</TabsTrigger>
            <TabsTrigger value="OUT" className="text-xs font-bold px-4 h-8 rounded-md data-[state=active]:bg-red-600 data-[state=active]:text-white">SAÍDAS</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="py-3 px-6 font-bold text-slate-500 uppercase text-[10px] tracking-wider w-[150px]">Data/Hora</TableHead>
                <TableHead className="py-3 px-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Produto</TableHead>
                <TableHead className="py-3 px-4 text-center font-bold text-slate-500 uppercase text-[10px] tracking-wider">Qtd</TableHead>
                <TableHead className="py-3 px-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Envolvido</TableHead>
                <TableHead className="py-3 px-4 text-right font-bold text-slate-500 uppercase text-[10px] tracking-wider">Unit.</TableHead>
                <TableHead className="py-3 px-4 text-right font-bold text-slate-500 uppercase text-[10px] tracking-wider">Total</TableHead>
                <TableHead className="py-3 px-4 text-center font-bold text-slate-500 uppercase text-[10px] tracking-wider">NF</TableHead>
                <TableHead className="py-3 px-6 text-center font-bold text-slate-500 uppercase text-[10px] tracking-wider">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((m) => (
                <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                  <TableCell className="px-6 py-2.5 whitespace-nowrap text-[11px] font-bold text-slate-400">
                    {format(new Date(m.created_at), 'dd/MM/yy HH:mm')}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 max-w-[250px]">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-sm block truncate" title={m.product?.name}>{m.product?.name}</span>
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider ">{m.product?.sector?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-center">
                    <Badge variant="outline" className={cn(
                      "rounded-md font-black text-xs px-2 py-0 border-none",
                      m.type === 'IN' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    )}>
                      {m.type === 'IN' ? '+' : '-'}{m.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs font-semibold text-slate-500 truncate max-w-[120px]">
                    {m.entity_name || '---'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right font-bold text-slate-700 text-xs">
                    {formatCurrency(m.unit_value)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <span className={cn("font-bold text-sm", m.type === 'IN' ? "text-emerald-700" : "text-slate-400")}>
                      {formatCurrency((m.unit_value || m.product?.cost_price || 0) * m.quantity)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-center">
                    <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">
                      {m.invoice_number || '---'}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-2.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:bg-red-50 rounded-lg"
                      onClick={() => handleOpenDeleteDialog(m)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialog: Confirmar Exclusão de Movimentação */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-6 shadow-2xl border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Excluir Movimentação
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 pt-2">
              Esta ação irá excluir a movimentação e <strong className="text-slate-700">reverter o estoque</strong> do produto <strong className="text-slate-700">{movementToDelete?.product?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" className="h-10 px-6 rounded-lg font-bold" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 h-10 px-8 rounded-lg font-bold text-white" onClick={handleDeleteMovement}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 shadow-2xl border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {formData.type === 'IN' ? <ArrowDownCircle className="h-4 w-4 text-emerald-600" /> : <ArrowUpCircle className="h-4 w-4 text-red-600" />}
              {formData.type === 'IN' ? 'Lançar Entrada' : 'Lançar Saída'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-4 text-xs font-semibold text-slate-600 uppercase text-[10px] tracking-widest">
            <div className="space-y-1.5">
              <Label className="pl-1">Produto *</Label>
              <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between h-10 bg-slate-50 border-slate-200 rounded-lg px-3 text-[12px] font-bold">
                    {formData.product_id ? products.find((p) => p.id === formData.product_id)?.name : "Pesquisar produto..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 rounded-xl shadow-2xl overflow-hidden">
                  <Command>
                    <CommandInput placeholder="Digite para buscar..." className="h-10 text-sm" />
                    <CommandList>
                      <CommandEmpty>Nenhum produto.</CommandEmpty>
                      <CommandGroup>
                        {products.map((p) => (
                          <CommandItem key={p.id} value={p.name} onSelect={() => { setFormData({ ...formData, product_id: p.id }); setIsComboboxOpen(false); }} className="text-xs font-bold py-2 px-4 cursor-pointer">
                            <Check className={cn("mr-2 h-3.5 w-3.5 text-emerald-600", formData.product_id === p.id ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{p.name}</span>
                            <span className="text-[9px] text-slate-400">ESTOQUE: {p.current_qty}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="pl-1">Quantidade *</Label>
                <Input type="number" className="h-10 bg-slate-50 rounded-lg" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label className="pl-1">{formData.type === 'IN' ? 'Fornecedor' : 'Solicitante'}</Label>
                <Input className="h-10 bg-slate-50 rounded-lg" value={formData.entity_name} onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })} />
              </div>
            </div>

            {formData.type === 'IN' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <Label className="pl-1">Número da NF</Label>
                  <Input placeholder="Opcional. Ativa o campo de preço." className="h-10 bg-slate-50 rounded-lg" value={formData.invoice_number} onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })} />
                </div>
                {formData.invoice_number?.trim() && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                    <Label className="pl-1 text-emerald-700">Preço Pago (Unitário R$)</Label>
                    <Input type="number" step="0.01" className="h-10 bg-emerald-50 border-emerald-100 rounded-lg font-bold" value={formData.unit_value || ''} onChange={(e) => setFormData({ ...formData, unit_value: parseFloat(e.target.value) || undefined })} />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" className="h-10 px-6 rounded-lg font-bold" onClick={() => setIsDialogOpen(false)}>Sair</Button>
              <Button className={cn("h-10 px-8 rounded-lg font-bold text-white", formData.type === 'IN' ? "bg-[#387146] hover:bg-[#2b5836]" : "bg-red-600 hover:bg-red-700")} onClick={handleSave} disabled={isSaving}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
