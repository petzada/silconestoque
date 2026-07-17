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
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Check,
  ChevronsUpDown,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Employee, Movement, MovementFilters, Product, Category } from '@/lib/types';

const movementSchema = z
  .object({
    product_id: z.string().min(1, 'Selecione um produto.'),
    type: z.enum(['IN', 'OUT']),
    quantity: z.number().int().min(1, 'Quantidade deve ser maior que zero.'),
    entity_name: z.string().optional(),
    invoice_number: z.string().optional(),
    unit_value: z.number().optional(),
    employee_id: z.string().optional(),
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
  employee_id: undefined,
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
  categoryId: 'all',
  employeeId: 'all',
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<Movement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filters, setFilters] = useState<MovementFilters>(initialMovementFilters);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [isEntityComboboxOpen, setIsEntityComboboxOpen] = useState(false);
  const [entitySearchValue, setEntitySearchValue] = useState('');
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
      const [movementsRes, productsRes, categoriesRes, employeesRes] = await Promise.all([
        supabase
          .from('movements')
          .select('*, product:products(*, category:categories(*)), employee:employees(id, full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('*, category:categories(*)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('employees').select('*, role:roles(*)').order('full_name'),
      ]);

      if (movementsRes.error) throw movementsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setMovements(movementsRes.data || []);
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setEmployees(employeesRes.data || []);
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
      setIsEntityComboboxOpen(false);
      setEntitySearchValue('');
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
        employee_id: values.type === 'OUT' ? values.employee_id || null : null,
      };

      const { error } = await supabase.from('movements').insert(movementData);
      if (error) throw error;

      toast.success('Movimentacao registrada com sucesso');
      setIsDialogOpen(false);
      form.reset(initialFormValues);
      await fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('stock')) {
        toast.error('Estoque insuficiente');
      } else if (message.includes('foreign key') || message.includes('employee_id')) {
        toast.error('Colaborador selecionado não é mais válido. A lista foi atualizada.');
        await fetchData();
      } else {
        toast.error('Erro ao salvar');
      }
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

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.is_active), [employees]);

  const employeeFilterOptions = useMemo(() => {
    const active = employees.filter((employee) => employee.is_active);
    const inactive = employees.filter((employee) => !employee.is_active);
    return [...active, ...inactive];
  }, [employees]);

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
        const matchesCategory = filters.categoryId === 'all' || movement.product?.category_id === filters.categoryId;
        const matchesEmployee = filters.employeeId === 'all' || movement.employee_id === filters.employeeId;

        return matchesSearch && matchesType && matchesMonth && matchesYear && matchesCategory && matchesEmployee;
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
          <span className="whitespace-nowrap text-xs font-bold text-muted-foreground">
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
            <TruncatedCell value={movement.product?.name || '-'} className="max-w-[260px] font-bold text-foreground" />
            <TruncatedCell
              value={movement.product?.category?.name || '-'}
              className="max-w-[260px] text-xs font-bold uppercase tracking-wide text-muted-foreground"
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
              'rounded-md border-none px-2 py-0 text-xs font-bold',
              movement.type === 'IN' ? 'bg-success-muted text-success' : 'bg-destructive/10 text-destructive'
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
          <div className="flex max-w-[200px] items-center gap-1.5">
            {movement.employee_id && (
              <span title="Colaborador cadastrado" className="shrink-0 text-primary">
                <UserCheck className="h-3.5 w-3.5" />
              </span>
            )}
            <TruncatedCell value={movement.entity_name || '---'} className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground" />
          </div>
        ),
      },
      {
        key: 'unit_value',
        header: 'Unit.',
        sortable: true,
        accessor: (movement) => movement.unit_value || 0,
        align: 'right',
        cell: (movement) => (
          <span className="text-xs font-bold text-foreground">{formatCurrency(movement.unit_value)}</span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        sortable: true,
        accessor: (movement) => (movement.unit_value || 0) * movement.quantity,
        align: 'right',
        cell: (movement) => (
          <span className={cn('text-sm font-bold', movement.type === 'IN' ? 'text-success' : 'text-muted-foreground')}>
            {formatCurrency((movement.unit_value || 0) * movement.quantity)}
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
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground">
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
            className="h-8 w-8 text-destructive/70 hover:bg-destructive/10"
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
    return <PageLoading label="Carregando movimentações..." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Movimentações"
        description="Entradas e saídas de materiais do almoxarifado"
        actions={
          <>
            <Button type="button" size="sm" onClick={() => openDialog('IN')}>
              <ArrowDownCircle className="h-4 w-4" /> Registrar Entrada
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => openDialog('OUT')}
            >
              <ArrowUpCircle className="h-4 w-4" /> Registrar Saida
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Produto, fornecedor ou NF..."
              value={filters.searchTerm}
              onChange={(event) => setFilters((prev) => ({ ...prev, searchTerm: event.target.value }))}
              className="h-10 border-border pl-9 text-sm"
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
            <TabsList className="h-10 bg-muted p-1">
              <TabsTrigger value="all" className="h-8 rounded-md px-4 text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-foreground">
                TODAS
              </TabsTrigger>
              <TabsTrigger value="IN" className="h-8 rounded-md px-4 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                ENTRADAS
              </TabsTrigger>
              <TabsTrigger value="OUT" className="h-8 rounded-md px-4 text-xs font-bold data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
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
            <SelectTrigger className="h-10 w-[150px] border-border text-xs font-bold">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
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
            <SelectTrigger className="h-10 w-[130px] border-border text-xs font-bold">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos os anos</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.categoryId}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, categoryId: value }))}
          >
            <SelectTrigger className="h-10 w-[220px] border-border text-xs font-bold">
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
            value={filters.employeeId}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, employeeId: value }))}
          >
            <SelectTrigger className="h-10 w-[220px] border-border text-xs font-bold">
              <SelectValue placeholder="Colaborador" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {employeeFilterOptions.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.full_name}
                  {!employee.is_active ? ' (desligado)' : ''}
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
          filters.categoryId !== 'all' ||
          filters.employeeId !== 'all'
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
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              {movementType === 'IN' ? (
                <ArrowDownCircle className="h-4 w-4 text-success" />
              ) : (
                <ArrowUpCircle className="h-4 w-4 text-destructive" />
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
                    <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Produto</FormLabel>
                    <FormControl>
                      <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="h-10 w-full justify-between border-border bg-muted px-3 text-[12px] font-bold"
                          >
                            {field.value ? products.find((product) => product.id === field.value)?.name : 'Pesquisar produto...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(450px,90vw)] min-w-[280px] rounded-lg p-0 overflow-hidden">
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
                                    <Check className={cn('mr-2 h-3.5 w-3.5 text-success', field.value === product.id ? 'opacity-100' : 'opacity-0')} />
                                    <span className="flex-1">{product.name}</span>
                                    <span className="text-xs text-muted-foreground">ESTOQUE: {product.current_qty}</span>
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
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quantidade</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
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
                  name="entity_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {movementType === 'IN' ? 'Fornecedor' : 'Solicitante'}
                      </FormLabel>
                      <FormControl>
                        {movementType === 'IN' ? (
                          <Input {...field} className="h-10 bg-muted" />
                        ) : (
                          <div className="flex gap-1">
                            <Popover
                              open={isEntityComboboxOpen}
                              onOpenChange={(open) => {
                                setIsEntityComboboxOpen(open);
                                if (!open) setEntitySearchValue('');
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  className="h-10 min-w-0 flex-1 justify-between border-border bg-muted px-3 text-[12px] font-bold"
                                >
                                  <span className="truncate">{field.value || 'Selecionar colaborador...'}</span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[min(320px,90vw)] p-0 rounded-lg overflow-hidden" align="start">
                                <Command shouldFilter>
                                  <CommandInput
                                    placeholder="Buscar colaborador..."
                                    className="h-10 text-sm"
                                    value={entitySearchValue}
                                    onValueChange={setEntitySearchValue}
                                  />
                                  <CommandList>
                                    <CommandEmpty>Nenhum colaborador ativo encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {activeEmployees.map((employee) => (
                                        <CommandItem
                                          key={employee.id}
                                          value={employee.full_name}
                                          onSelect={() => {
                                            form.setValue('employee_id', employee.id, { shouldDirty: true });
                                            form.setValue('entity_name', employee.full_name, { shouldDirty: true });
                                            setIsEntityComboboxOpen(false);
                                            setEntitySearchValue('');
                                          }}
                                          className="cursor-pointer px-4 py-2 text-xs font-bold"
                                        >
                                          <Check
                                            className={cn(
                                              'mr-2 h-3.5 w-3.5 text-success',
                                              form.watch('employee_id') === employee.id ? 'opacity-100' : 'opacity-0'
                                            )}
                                          />
                                          {employee.full_name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                    {entitySearchValue.trim() && (
                                      <CommandGroup>
                                        <CommandItem
                                          value={`usar-texto-livre-${entitySearchValue}`}
                                          onSelect={() => {
                                            form.setValue('entity_name', entitySearchValue.trim(), { shouldDirty: true });
                                            form.setValue('employee_id', undefined, { shouldDirty: true });
                                            setIsEntityComboboxOpen(false);
                                            setEntitySearchValue('');
                                          }}
                                          className="cursor-pointer px-4 py-2 text-xs font-bold text-muted-foreground"
                                        >
                                          Usar &quot;{entitySearchValue.trim()}&quot;
                                        </CommandItem>
                                      </CommandGroup>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Limpar solicitante"
                                aria-label="Limpar solicitante"
                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  form.setValue('entity_name', '', { shouldDirty: true });
                                  form.setValue('employee_id', undefined, { shouldDirty: true });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              {movementType === 'IN' && (
                <div className="space-y-4 border-t border-border pt-2">
                  <FormField
                    control={form.control}
                    name="invoice_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Numero da NF</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Opcional. Ativa o campo de preco."
                            className="h-10 bg-muted"
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
                          <FormLabel className="pl-1 text-xs font-semibold uppercase tracking-widest text-success">Preco Pago (Unitario R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0.01}
                              step="0.01"
                              className="h-10 border-success/30 bg-success-muted font-bold"
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
                  className="h-10 px-6 font-bold"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    'h-10 px-8 font-semibold',
                    movementType === 'IN'
                      ? 'bg-primary text-primary-foreground hover:bg-primary-active'
                      : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
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
