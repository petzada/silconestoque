'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, TruncatedCell, type DataTableColumn } from '@/components/ui/data-table';
import { PageContainer } from '@/components/layout/page-container';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Check,
  ChevronsUpDown,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Movement, MovementFilters, Product, Sector } from '@/lib/types';

const movementSchema = z
  .object({
    product_id: z.string().min(1, 'Selecione um produto.'),
    type: z.enum(['IN', 'OUT']),
    quantity: z.number().int().min(1, 'Quantidade deve ser maior que zero.'),
    entity_name: z.string().optional(),
    invoice_number: z.string().optional(),
    unit_value: z.number().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'IN' && values.invoice_number?.trim() && (!values.unit_value || values.unit_value <= 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['unit_value'],
        message: 'Informe um valor unitario maior que zero.',
      });
    }
  });

type MovementFormValues = z.infer<typeof movementSchema>;

const initialFormValues: MovementFormValues = {
  product_id: '',
  type: 'IN',
  quantity: 1,
  entity_name: '',
  invoice_number: '',
  unit_value: undefined,
};

const MONTHS = [
  { value: '0', label: 'Janeiro' },
  { value: '1', label: 'Fevereiro' },
  { value: '2', label: 'Marco' },
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

const initialMovementFilters: MovementFilters = {
  searchTerm: '',
  type: 'all',
  month: 'all',
  year: 'all',
  sectorId: 'all',
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<Movement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filters, setFilters] = useState<MovementFilters>(initialMovementFilters);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const saveLockRef = useRef(false);

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: initialFormValues,
  });

  const movementType = form.watch('type');
  const invoiceNumber = form.watch('invoice_number');

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [movementsRes, productsRes, sectorsRes] = await Promise.all([
        supabase
          .from('movements')
          .select('*, product:products(*, sector:sectors(*))')
          .order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('*, sector:sectors(*)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('sectors').select('*').order('name'),
      ]);

      if (movementsRes.error) throw movementsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (sectorsRes.error) throw sectorsRes.error;

      setMovements(movementsRes.data || []);
      setProducts(productsRes.data || []);
      setSectors(sectorsRes.data || []);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (type: 'IN' | 'OUT') => {
    form.reset({ ...initialFormValues, type });
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && form.formState.isDirty) {
      const shouldClose = window.confirm('Descartar alteracoes nao salvas?');
      if (!shouldClose) return;
    }

    if (!open) {
      form.reset(initialFormValues);
      setIsComboboxOpen(false);
    }

    setIsDialogOpen(open);
  };

  const openDeleteDialog = useCallback((movement: Movement) => {
    setMovementToDelete(movement);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDeleteMovement = async () => {
    if (!movementToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('movements').delete().eq('id', movementToDelete.id);
      if (error) throw error;

      toast.success('Movimentacao excluida com sucesso');
      setIsDeleteDialogOpen(false);
      setMovementToDelete(null);
      await fetchData();
    } catch {
      toast.error('Erro ao excluir movimentacao');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = form.handleSubmit(async (values) => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSaving(true);
    try {
      const movementData = {
        product_id: values.product_id,
        type: values.type,
        quantity: values.quantity,
        entity_name: values.entity_name?.trim() || null,
        unit_value: values.type === 'IN' && values.invoice_number ? values.unit_value || null : null,
        invoice_number: values.type === 'IN' ? values.invoice_number?.trim() || null : null,
      };

      const { error } = await supabase.from('movements').insert(movementData);
      if (error) throw error;

      toast.success('Movimentacao registrada com sucesso');
      setIsDialogOpen(false);
      form.reset(initialFormValues);
      await fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message.includes('stock') ? 'Estoque insuficiente' : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
      saveLockRef.current = false;
    }
  });

  const availableYears = useMemo(
    () =>
      Array.from(new Set(movements.map((movement) => String(new Date(movement.created_at).getFullYear())))).sort(
        (a, b) => Number(b) - Number(a)
      ),
    [movements]
  );

  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        const normalizedSearch = filters.searchTerm.trim().toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          [movement.product?.name, movement.entity_name, movement.invoice_number].some((value) =>
            value?.toLowerCase().includes(normalizedSearch)
          );

        const movementDate = new Date(movement.created_at);
        const matchesType = filters.type === 'all' || movement.type === filters.type;
        const matchesMonth = filters.month === 'all' || String(movementDate.getMonth()) === filters.month;
        const matchesYear = filters.year === 'all' || String(movementDate.getFullYear()) === filters.year;
        const matchesSector = filters.sectorId === 'all' || movement.product?.sector_id === filters.sectorId;

        return matchesSearch && matchesType && matchesMonth && matchesYear && matchesSector;
      }),
    [movements, filters]
  );

  const columns = useMemo<DataTableColumn<Movement>[]>(
    () => [
      {
        key: 'created_at',
        header: 'Data/Hora',
        sortable: true,
        accessor: (movement) => new Date(movement.created_at),
        cell: (movement) => (
          <span className="whitespace-nowrap text-xs font-bold text-slate-400">
            {format(new Date(movement.created_at), 'dd/MM/yy HH:mm')}
          </span>
        ),
      },
      {
        key: 'product',
        header: 'Produto',
        sortable: true,
        accessor: (movement) => movement.product?.name || '',
        cell: (movement) => (
          <div className="flex flex-col">
            <TruncatedCell value={movement.product?.name || '-'} className="max-w-[260px] font-bold text-slate-800" />
            <TruncatedCell
              value={movement.product?.sector?.name || '-'}
              className="max-w-[260px] text-xs font-bold uppercase tracking-wide text-slate-400"
            />
          </div>
        ),
      },
      {
        key: 'quantity',
        header: 'Qtd',
        sortable: true,
        accessor: (movement) => movement.quantity,
        align: 'center',
        cell: (movement) => (
          <Badge
            variant="outline"
            className={cn(
              'rounded-md border-none px-2 py-0 text-xs font-black',
              movement.type === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            )}
          >
            {movement.type === 'IN' ? '+' : '-'}
            {movement.quantity}
          </Badge>
        ),
      },
      {
        key: 'entity_name',
        header: 'Envolvido',
        sortable: true,
        accessor: (movement) => movement.entity_name || '',
        cell: (movement) => (
          <TruncatedCell value={movement.entity_name || '---'} className="max-w-[200px] text-xs font-semibold text-slate-500" />
        ),
      },
      {
        key: 'unit_value',
        header: 'Unit.',
        sortable: true,
        accessor: (movement) => movement.unit_value || 0,
        align: 'right',
        cell: (movement) => (
          <span className="text-xs font-bold text-slate-700">{formatCurrency(movement.unit_value)}</span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        sortable: true,
        accessor: (movement) => (movement.unit_value || movement.product?.cost_price || 0) * movement.quantity,
        align: 'right',
        cell: (movement) => (
          <span className={cn('text-sm font-bold', movement.type === 'IN' ? 'text-emerald-700' : 'text-slate-400')}>
            {formatCurrency((movement.unit_value || movement.product?.cost_price || 0) * movement.quantity)}
          </span>
        ),
      },
      {
        key: 'invoice_number',
        header: 'NF',
        sortable: true,
        accessor: (movement) => movement.invoice_number || '',
        align: 'center',
        cell: (movement) => (
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-500">
            {movement.invoice_number || '---'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Acoes',
        align: 'center',
        cell: (movement) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Excluir movimentacao"
            aria-label="Excluir movimentacao"
            className="h-8 w-8 rounded-lg text-red-400 hover:bg-red-50"
            onClick={() => openDeleteDialog(movement)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [openDeleteDialog]
  );

  if (isLoading) {
    return <div className="py-20 text-center font-bold text-slate-400">Carregando movimentacoes...</div>;
  }

  return (
    <PageContainer>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Movimentacoes</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            className="h-9 bg-brand-primary px-4 text-xs font-bold hover:bg-brand-primary-hover"
            onClick={() => openDialog('IN')}
          >
            <ArrowDownCircle className="mr-2 h-3.5 w-3.5" /> Registrar Entrada
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-red-200 px-4 text-xs font-bold text-red-600 hover:bg-red-50"
            onClick={() => openDialog('OUT')}
          >
            <ArrowUpCircle className="mr-2 h-3.5 w-3.5" /> Registrar Saida
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Produto, fornecedor ou NF..."
              value={filters.searchTerm}
              onChange={(event) => setFilters((prev) => ({ ...prev, searchTerm: event.target.value }))}
              className="h-10 rounded-lg border-slate-200 pl-9 text-sm"
            />
          </div>
          <Tabs
            value={filters.type}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                type: value as MovementFilters['type'],
              }))
            }
            className="shrink-0"
          >
            <TabsList className="h-10 rounded-lg bg-slate-100 p-1">
              <TabsTrigger value="all" className="h-8 rounded-md px-4 text-xs font-bold">
                TODAS
              </TabsTrigger>
              <TabsTrigger value="IN" className="h-8 rounded-md px-4 text-xs font-bold data-[state=active]:bg-brand-primary data-[state=active]:text-white">
                ENTRADAS
              </TabsTrigger>
              <TabsTrigger value="OUT" className="h-8 rounded-md px-4 text-xs font-bold data-[state=active]:bg-red-600 data-[state=active]:text-white">
                SAIDAS
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.month}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, month: value }))}
          >
            <SelectTrigger className="h-10 w-[150px] rounded-lg border-slate-200 text-xs font-bold">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos os meses</SelectItem>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.year}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, year: value }))}
          >
            <SelectTrigger className="h-10 w-[130px] rounded-lg border-slate-200 text-xs font-bold">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos os anos</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.sectorId}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, sectorId: value }))}
          >
            <SelectTrigger className="h-10 w-[220px] rounded-lg border-slate-200 text-xs font-bold">
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
        </div>
      </div>

      <DataTable
        data={filteredMovements}
        columns={columns}
        rowKey={(movement) => movement.id}
        emptyMessage={
          filters.searchTerm ||
          filters.type !== 'all' ||
          filters.month !== 'all' ||
          filters.year !== 'all' ||
          filters.sectorId !== 'all'
            ? 'Nenhuma movimentacao encontrada para este filtro.'
            : 'Nenhuma movimentacao cadastrada.'
        }
        defaultSort={{ key: 'created_at', direction: 'desc' }}
        initialPageSize={25}
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Excluir Movimentacao"
        description={`Deseja excluir a movimentacao do produto "${movementToDelete?.product?.name || ''}"?`}
        onConfirm={handleDeleteMovement}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        isLoading={isDeleting}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md rounded-2xl border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              {movementType === 'IN' ? (
                <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <ArrowUpCircle className="h-4 w-4 text-red-600" />
              )}
              {movementType === 'IN' ? 'Lancar Entrada' : 'Lancar Saida'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="grid gap-4 pt-4" onSubmit={(event) => void handleSave(event)}>
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Produto</FormLabel>
                    <FormControl>
                      <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="h-10 w-full justify-between rounded-lg border-slate-200 bg-slate-50 px-3 text-[12px] font-bold"
                          >
                            {field.value ? products.find((product) => product.id === field.value)?.name : 'Pesquisar produto...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(450px,90vw)] min-w-[280px] rounded-xl p-0 shadow-2xl overflow-hidden">
                          <Command>
                            <CommandInput placeholder="Digite para buscar..." className="h-10 text-sm" />
                            <CommandList>
                              <CommandEmpty>Nenhum produto.</CommandEmpty>
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => {
                                      field.onChange(product.id);
                                      setIsComboboxOpen(false);
                                    }}
                                    className="cursor-pointer px-4 py-2 text-xs font-bold"
                                  >
                                    <Check className={cn('mr-2 h-3.5 w-3.5 text-emerald-600', field.value === product.id ? 'opacity-100' : 'opacity-0')} />
                                    <span className="flex-1">{product.name}</span>
                                    <span className="text-xs text-slate-400">ESTOQUE: {product.current_qty}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Quantidade</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          className="h-10 rounded-lg bg-slate-50"
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
                  name="entity_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
                        {movementType === 'IN' ? 'Fornecedor' : 'Solicitante'}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} className="h-10 rounded-lg bg-slate-50" />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              {movementType === 'IN' && (
                <div className="space-y-4 border-t border-slate-100 pt-2">
                  <FormField
                    control={form.control}
                    name="invoice_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Numero da NF</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Opcional. Ativa o campo de preco."
                            className="h-10 rounded-lg bg-slate-50"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {invoiceNumber?.trim() && (
                    <FormField
                      control={form.control}
                      name="unit_value"
                      render={({ field }) => (
                        <FormItem className="animate-in fade-in slide-in-from-top-1">
                          <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">Preco Pago (Unitario R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0.01}
                              step="0.01"
                              className="h-10 rounded-lg border-emerald-100 bg-emerald-50 font-bold"
                              value={field.value ?? ''}
                              onChange={(event) =>
                                field.onChange(
                                  event.target.value === '' ? undefined : Number(event.target.value)
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-lg px-6 font-bold"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    'h-10 rounded-lg px-8 font-bold text-white',
                    movementType === 'IN' ? 'bg-brand-primary hover:bg-brand-primary-hover' : 'bg-red-600 hover:bg-red-700'
                  )}
                  disabled={isSaving}
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
