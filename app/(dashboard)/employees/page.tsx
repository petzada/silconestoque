'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PageContainer } from '@/components/layout/page-container';
import { SimpleCrudDialog } from '@/components/employees/simple-crud-dialog';
import { EmployeeImportDialog } from '@/components/employees/import-dialog';
import {
  Plus,
  Pencil,
  Search,
  Settings2,
  Building2,
  Upload,
  UserX,
  UserCheck,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Employee, Department, Role, Locker, LockerKind } from '@/lib/types';

type ActiveAssignmentJoin = {
  id: string;
  started_at: string;
  locker: Pick<Locker, 'id' | 'kind' | 'number' | 'size'> | null;
};

type EmployeeRow = Employee & {
  locker_assignments?: ActiveAssignmentJoin[] | null;
};

type WithdrawalRow = {
  id: string;
  created_at: string;
  quantity: number;
  product: { name: string } | null;
};

const employeeSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe o nome do colaborador com pelo menos 2 caracteres.'),
  department_id: z.string().min(1, 'Selecione um setor.'),
  role_id: z.string().min(1, 'Selecione uma função.'),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

const initialEmployeeValues: EmployeeFormValues = {
  full_name: '',
  department_id: '',
  role_id: '',
};

function getActiveAssignments(employee: EmployeeRow): ActiveAssignmentJoin[] {
  return employee.locker_assignments ?? [];
}

function getAssignmentByKind(employee: EmployeeRow, kind: LockerKind): ActiveAssignmentJoin | null {
  return getActiveAssignments(employee).find((assignment) => assignment.locker?.kind === kind) ?? null;
}

function describeLockerAssignment(assignment: ActiveAssignmentJoin): string {
  if (!assignment.locker) return '';
  if (assignment.locker.kind === 'uniforme') {
    return `o armário nº ${String(assignment.locker.number).padStart(2, '0')} (${assignment.locker.size})`;
  }
  return `o armário de vestiário nº ${String(assignment.locker.number).padStart(2, '0')}`;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

function friendlyDbError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('uniq_employees_full_name')) {
    return 'Já existe um colaborador com esse nome.';
  }
  if (message.includes('duplicate key') || message.includes('unique constraint')) {
    return 'Já existe um registro com esses dados.';
  }
  if (message.includes('foreign key') || message.includes('violates foreign key')) {
    return 'Este registro está em uso e não pode ser removido.';
  }
  return fallback;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isOffboardDialogOpen, setIsOffboardDialogOpen] = useState(false);
  const [employeeToOffboard, setEmployeeToOffboard] = useState<EmployeeRow | null>(null);
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
  const [isDepartmentsDialogOpen, setIsDepartmentsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const [isWithdrawalsSheetOpen, setIsWithdrawalsSheetOpen] = useState(false);
  const [employeeForWithdrawals, setEmployeeForWithdrawals] = useState<EmployeeRow | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(false);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: initialEmployeeValues,
  });

  // Não liga isLoading nos refetches: o `if (isLoading)` lá embaixo desmonta os
  // diálogos, e o de importação perderia o CSV já carregado em memória quando o
  // usuário cadastra um setor pela prévia. isLoading serve só à carga inicial.
  const fetchData = useCallback(async () => {
    try {
      const [employeesRes, departmentsRes, rolesRes] = await Promise.all([
        supabase
          .from('employees')
          .select(
            '*, department:departments(*), role:roles(*), locker_assignments!left(id, started_at, ended_at, locker:lockers(id, kind, number, size))'
          )
          .is('locker_assignments.ended_at', null)
          .order('full_name'),
        supabase.from('departments').select('*').order('name'),
        supabase.from('roles').select('*').order('name'),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (rolesRes.error) throw rolesRes.error;

      setEmployees(employeesRes.data || []);
      setDepartments(departmentsRes.data || []);
      setRoles(rolesRes.data || []);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openFormDialog = (employee?: EmployeeRow) => {
    if (employee) {
      setEditingEmployee(employee);
      form.reset({
        full_name: employee.full_name,
        department_id: employee.department_id,
        role_id: employee.role_id,
      });
    } else {
      setEditingEmployee(null);
      form.reset(initialEmployeeValues);
    }
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && form.formState.isDirty) {
      const shouldClose = window.confirm('Descartar alterações não salvas?');
      if (!shouldClose) return;
    }

    if (!open) {
      setEditingEmployee(null);
      form.reset(initialEmployeeValues);
    }

    setIsDialogOpen(open);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      const payload = {
        full_name: values.full_name.trim(),
        department_id: values.department_id,
        role_id: values.role_id,
      };

      if (editingEmployee) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingEmployee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('employees').insert(payload);
        if (error) throw error;
      }

      toast.success(editingEmployee ? 'Colaborador atualizado' : 'Colaborador cadastrado');
      setIsDialogOpen(false);
      setEditingEmployee(null);
      form.reset(initialEmployeeValues);
      await fetchData();
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao salvar colaborador'));
    } finally {
      setIsSaving(false);
    }
  });

  const openOffboardDialog = useCallback((employee: EmployeeRow) => {
    setEmployeeToOffboard(employee);
    setIsOffboardDialogOpen(true);
  }, []);

  const handleOffboard = async () => {
    if (!employeeToOffboard) return;

    setIsOffboarding(true);
    try {
      const { error: employeeError } = await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('id', employeeToOffboard.id);
      if (employeeError) throw employeeError;

      const { error: assignmentError } = await supabase
        .from('locker_assignments')
        .update({ ended_at: new Date().toISOString() })
        .eq('employee_id', employeeToOffboard.id)
        .is('ended_at', null);
      if (assignmentError) throw assignmentError;

      toast.success('Colaborador desligado com sucesso');
      setIsOffboardDialogOpen(false);
      setEmployeeToOffboard(null);
      await fetchData();
    } catch {
      toast.error('Erro ao desligar colaborador');
    } finally {
      setIsOffboarding(false);
    }
  };

  const handleReactivate = useCallback(async (employee: EmployeeRow) => {
    setReactivatingId(employee.id);
    try {
      const { error } = await supabase.from('employees').update({ is_active: true }).eq('id', employee.id);
      if (error) throw error;
      toast.success('Colaborador reativado. Ele está sem armários atribuídos.');
      await fetchData();
    } catch {
      toast.error('Erro ao reativar colaborador');
    } finally {
      setReactivatingId(null);
    }
  }, [fetchData]);

  // Withdrawals (Retiradas) sheet
  const fetchWithdrawals = useCallback(async (employeeId: string) => {
    setIsLoadingWithdrawals(true);
    try {
      const { data, error } = await supabase
        .from('movements')
        .select('id, created_at, quantity, product:products(name)')
        .eq('type', 'OUT')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setWithdrawals((data as unknown as WithdrawalRow[]) || []);
    } catch {
      toast.error('Erro ao carregar retiradas do colaborador');
    } finally {
      setIsLoadingWithdrawals(false);
    }
  }, []);

  const openWithdrawalsSheet = useCallback(
    (employee: EmployeeRow) => {
      setEmployeeForWithdrawals(employee);
      setIsWithdrawalsSheetOpen(true);
      void fetchWithdrawals(employee.id);
    },
    [fetchWithdrawals]
  );

  const handleWithdrawalsSheetOpenChange = (open: boolean) => {
    setIsWithdrawalsSheetOpen(open);
    if (!open) {
      setEmployeeForWithdrawals(null);
      setWithdrawals([]);
    }
  };

  // Nomes já cadastrados: a importação usa para acusar "Já cadastrado" na prévia,
  // antes de o insert bater no índice único do banco.
  const existingNames = useMemo(() => employees.map((employee) => employee.full_name), [employees]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch = !normalizedSearch || employee.full_name.toLowerCase().includes(normalizedSearch);
      const matchesDepartment = filterDepartment === 'all' || employee.department_id === filterDepartment;
      const matchesRole = filterRole === 'all' || employee.role_id === filterRole;
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && employee.is_active) ||
        (filterStatus === 'inactive' && !employee.is_active);
      return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, filterDepartment, filterRole, filterStatus]);

  const columns = useMemo<DataTableColumn<EmployeeRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Nome',
        sortable: true,
        accessor: (employee) => `${employee.is_active ? '0' : '1'}__${employee.full_name.toLowerCase()}`,
        cell: (employee) => (
          <span className={cn('font-medium text-foreground', !employee.is_active && 'opacity-50')}>
            {employee.full_name}
          </span>
        ),
      },
      {
        key: 'department',
        header: 'Setor',
        sortable: true,
        accessor: (employee) => employee.department?.name || '',
        cell: (employee) => (
          <span className={cn('text-sm text-muted-foreground', !employee.is_active && 'opacity-50')}>
            {employee.department?.name || '-'}
          </span>
        ),
      },
      {
        key: 'role',
        header: 'Função',
        sortable: true,
        accessor: (employee) => employee.role?.name || '',
        cell: (employee) => (
          <span className={cn('text-sm text-muted-foreground', !employee.is_active && 'opacity-50')}>
            {employee.role?.name || '-'}
          </span>
        ),
      },
      {
        key: 'locker',
        header: 'Chapa/Armário',
        cell: (employee) => {
          const uniformAssignment = getAssignmentByKind(employee, 'uniforme');
          const vestiarioAssignment = getAssignmentByKind(employee, 'vestiario');
          return (
            <div className="flex flex-wrap items-center gap-1">
              {uniformAssignment?.locker ? (
                <Badge variant="outline" className="font-mono text-xs font-semibold">
                  Nº {String(uniformAssignment.locker.number).padStart(2, '0')} · {uniformAssignment.locker.size}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">sem chapa</span>
              )}
              {vestiarioAssignment?.locker ? (
                <Badge variant="outline" className="font-mono text-xs font-semibold">
                  Vest. {String(vestiarioAssignment.locker.number).padStart(2, '0')}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">sem vestiário</span>
              )}
            </div>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        cell: (employee) => (
          <Badge
            className={cn(
              'border-none px-2 py-0.5 text-xs font-semibold',
              employee.is_active ? 'bg-success-muted text-success' : 'bg-muted text-muted-foreground'
            )}
          >
            {employee.is_active ? 'Ativo' : 'Desligado'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Ações',
        align: 'right',
        cell: (employee) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Editar colaborador"
              aria-label="Editar colaborador"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openFormDialog(employee)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Retiradas"
              aria-label="Retiradas"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openWithdrawalsSheet(employee)}
            >
              <History className="h-4 w-4" />
            </Button>
            {employee.is_active ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Desligar colaborador"
                aria-label="Desligar colaborador"
                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => openOffboardDialog(employee)}
              >
                <UserX className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Reativar colaborador"
                aria-label="Reativar colaborador"
                className="h-8 w-8 text-muted-foreground hover:bg-success-muted hover:text-success"
                disabled={reactivatingId === employee.id}
                onClick={() => void handleReactivate(employee)}
              >
                <UserCheck className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [openOffboardDialog, handleReactivate, reactivatingId, openWithdrawalsSheet]
  );

  if (isLoading) {
    return <div className="py-20 text-center font-medium text-muted-foreground">Carregando colaboradores...</div>;
  }

  const offboardAssignmentDescriptions = employeeToOffboard
    ? getActiveAssignments(employeeToOffboard).map(describeLockerAssignment).filter(Boolean)
    : [];
  const offboardAssignmentsList = joinWithAnd(offboardAssignmentDescriptions);
  const offboardDescription = employeeToOffboard
    ? offboardAssignmentDescriptions.length > 0
      ? `Deseja desligar "${employeeToOffboard.full_name}"? ${offboardAssignmentsList.charAt(0).toUpperCase()}${offboardAssignmentsList.slice(1)} ${
          offboardAssignmentDescriptions.length > 1 ? 'serão liberados' : 'será liberado'
        } automaticamente.`
      : `Deseja desligar "${employeeToOffboard.full_name}"? Ele não possui armário atribuído.`
    : '';

  return (
    <PageContainer>
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Cadastro global de colaboradores da empresa</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsDepartmentsDialogOpen(true)}>
            <Building2 className="h-4 w-4" /> Setores
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsRolesDialogOpen(true)}>
            <Settings2 className="h-4 w-4" /> Funções
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Button type="button" size="sm" onClick={() => openFormDialog()}>
            <Plus className="h-4 w-4" /> Novo colaborador
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-sm sm:flex-row sm:items-center">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-10 rounded-lg border-border pl-9 text-sm"
          />
        </div>
        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
          <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm sm:w-[200px]">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm sm:w-[200px]">
            <SelectValue placeholder="Função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
          <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Desligados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filteredEmployees}
        columns={columns}
        rowKey={(employee) => employee.id}
        emptyMessage={
          searchTerm || filterDepartment !== 'all' || filterRole !== 'all' || filterStatus !== 'all'
            ? 'Nenhum colaborador encontrado para este filtro.'
            : 'Nenhum colaborador cadastrado.'
        }
        defaultSort={{ key: 'name', direction: 'asc' }}
        initialPageSize={25}
      />

      {/* Dialog: Novo/Editar colaborador */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="grid gap-4 pt-2" onSubmit={(event) => void handleSave(event)}>
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus placeholder="Ex: João da Silva" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione um setor" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((department) => (
                            <SelectItem key={department.id} value={department.id}>
                              {department.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Função</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione uma função" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => handleDialogOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <SimpleCrudDialog
        open={isDepartmentsDialogOpen}
        onOpenChange={setIsDepartmentsDialogOpen}
        table="departments"
        title="Setores"
        description="Cadastre e gerencie os setores dos colaboradores."
        placeholder="Novo setor (ex: Produção)"
        entityLabel="setor"
        duplicateMessage="Já existe um setor com esse nome."
        inUseMessage="Este setor está em uso por colaboradores. Reatribua-os antes de excluir."
        items={departments}
        onChanged={fetchData}
      />

      <SimpleCrudDialog
        open={isRolesDialogOpen}
        onOpenChange={setIsRolesDialogOpen}
        table="roles"
        title="Funções"
        description="Cadastre e gerencie as funções dos colaboradores."
        placeholder="Nova função (ex: Motorista)"
        entityLabel="função"
        duplicateMessage="Já existe uma função com esse nome."
        inUseMessage="Esta função está em uso por colaboradores. Reatribua-os antes de excluir."
        items={roles}
        onChanged={fetchData}
      />

      <EmployeeImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        departments={departments}
        roles={roles}
        existingNames={existingNames}
        onImported={fetchData}
        onManageDepartments={() => setIsDepartmentsDialogOpen(true)}
        onManageRoles={() => setIsRolesDialogOpen(true)}
      />

      {/* Sheet: Retiradas do colaborador */}
      <Sheet open={isWithdrawalsSheetOpen} onOpenChange={handleWithdrawalsSheetOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          {employeeForWithdrawals && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Retiradas de {employeeForWithdrawals.full_name}
                </SheetTitle>
                <SheetDescription>Histórico de saídas de material solicitadas por este colaborador.</SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
                {isLoadingWithdrawals ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
                ) : withdrawals.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma retirada registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Data</TableHead>
                        <TableHead className="text-xs font-semibold">Produto</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {format(new Date(withdrawal.created_at), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="text-xs text-foreground">{withdrawal.product?.name || '-'}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-foreground">
                            {withdrawal.quantity}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={isOffboardDialogOpen}
        onOpenChange={setIsOffboardDialogOpen}
        title="Desligar colaborador"
        description={offboardDescription}
        onConfirm={handleOffboard}
        confirmLabel="Desligar"
        cancelLabel="Cancelar"
        isLoading={isOffboarding}
      />
    </PageContainer>
  );
}
