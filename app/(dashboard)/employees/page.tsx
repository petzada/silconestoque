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
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PageContainer } from '@/components/layout/page-container';
import {
  Plus,
  Pencil,
  Search,
  Settings2,
  UserX,
  UserCheck,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Employee, Sector, Role, Locker } from '@/lib/types';

type ActiveAssignmentJoin = {
  id: string;
  started_at: string;
  locker: Pick<Locker, 'id' | 'kind' | 'number' | 'size'> | null;
};

type EmployeeRow = Employee & {
  locker_assignments?: ActiveAssignmentJoin[] | null;
};

const employeeSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe o nome do colaborador com pelo menos 2 caracteres.'),
  sector_id: z.string().min(1, 'Selecione um setor.'),
  role_id: z.string().min(1, 'Selecione uma função.'),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

const initialEmployeeValues: EmployeeFormValues = {
  full_name: '',
  sector_id: '',
  role_id: '',
};

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da função com pelo menos 2 caracteres.'),
});

type RoleFormValues = z.infer<typeof roleSchema>;

function getActiveAssignment(employee: EmployeeRow): ActiveAssignmentJoin | null {
  return employee.locker_assignments?.[0] ?? null;
}

function friendlyDbError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
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
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('all');
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
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isRoleDeleteDialogOpen, setIsRoleDeleteDialogOpen] = useState(false);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: initialEmployeeValues,
  });

  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [employeesRes, sectorsRes, rolesRes] = await Promise.all([
        supabase
          .from('employees')
          .select(
            '*, sector:sectors(*), role:roles(*), locker_assignments!left(id, started_at, ended_at, locker:lockers(id, kind, number, size))'
          )
          .is('locker_assignments.ended_at', null)
          .order('full_name'),
        supabase.from('sectors').select('*').order('name'),
        supabase.from('roles').select('*').order('name'),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (sectorsRes.error) throw sectorsRes.error;
      if (rolesRes.error) throw rolesRes.error;

      setEmployees(employeesRes.data || []);
      setSectors(sectorsRes.data || []);
      setRoles(rolesRes.data || []);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const openFormDialog = (employee?: EmployeeRow) => {
    if (employee) {
      setEditingEmployee(employee);
      form.reset({
        full_name: employee.full_name,
        sector_id: employee.sector_id,
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
        sector_id: values.sector_id,
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

      const activeAssignment = getActiveAssignment(employeeToOffboard);
      if (activeAssignment) {
        const { error: assignmentError } = await supabase
          .from('locker_assignments')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', activeAssignment.id);
        if (assignmentError) throw assignmentError;
      }

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
      toast.success('Colaborador reativado. Ele está sem armário atribuído.');
      await fetchData();
    } catch {
      toast.error('Erro ao reativar colaborador');
    } finally {
      setReactivatingId(null);
    }
  }, []);

  // Roles management
  const fetchRoles = async () => {
    const { data, error } = await supabase.from('roles').select('*').order('name');
    if (!error) setRoles(data || []);
  };

  const handleAddRole = roleForm.handleSubmit(async (values) => {
    setIsSavingRole(true);
    try {
      const { error } = await supabase.from('roles').insert({ name: values.name.trim() });
      if (error) throw error;
      toast.success('Função criada');
      roleForm.reset({ name: '' });
      await fetchRoles();
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao criar função'));
    } finally {
      setIsSavingRole(false);
    }
  });

  const startEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setEditingRoleName(role.name);
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setEditingRoleName('');
  };

  const saveEditRole = async () => {
    if (!editingRoleId) return;
    const trimmed = editingRoleName.trim();
    if (trimmed.length < 2) {
      toast.error('Informe o nome da função com pelo menos 2 caracteres.');
      return;
    }

    setIsSavingRole(true);
    try {
      const { error } = await supabase.from('roles').update({ name: trimmed }).eq('id', editingRoleId);
      if (error) throw error;
      toast.success('Função atualizada');
      cancelEditRole();
      await fetchRoles();
      await fetchData();
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao atualizar função'));
    } finally {
      setIsSavingRole(false);
    }
  };

  const openRoleDeleteDialog = (role: Role) => {
    setRoleToDelete(role);
    setIsRoleDeleteDialogOpen(true);
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;

    setIsDeletingRole(true);
    try {
      const { error } = await supabase.from('roles').delete().eq('id', roleToDelete.id);
      if (error) throw error;
      toast.success('Função excluída');
      setIsRoleDeleteDialogOpen(false);
      setRoleToDelete(null);
      await fetchRoles();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      toast.error(
        message.includes('foreign key')
          ? 'Esta função está em uso por colaboradores. Reatribua-os antes de excluir.'
          : 'Erro ao excluir função'
      );
    } finally {
      setIsDeletingRole(false);
    }
  };

  const handleRolesDialogOpenChange = (open: boolean) => {
    if (!open) {
      cancelEditRole();
      roleForm.reset({ name: '' });
    }
    setIsRolesDialogOpen(open);
  };

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch = !normalizedSearch || employee.full_name.toLowerCase().includes(normalizedSearch);
      const matchesSector = filterSector === 'all' || employee.sector_id === filterSector;
      const matchesRole = filterRole === 'all' || employee.role_id === filterRole;
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && employee.is_active) ||
        (filterStatus === 'inactive' && !employee.is_active);
      return matchesSearch && matchesSector && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, filterSector, filterRole, filterStatus]);

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
        key: 'sector',
        header: 'Setor',
        sortable: true,
        accessor: (employee) => employee.sector?.name || '',
        cell: (employee) => (
          <span className={cn('text-sm text-muted-foreground', !employee.is_active && 'opacity-50')}>
            {employee.sector?.name || '-'}
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
          const assignment = getActiveAssignment(employee);
          if (!assignment?.locker) {
            return <span className="text-xs text-muted-foreground">sem armário</span>;
          }
          return (
            <Badge variant="outline" className="font-mono text-xs font-semibold">
              Nº {String(assignment.locker.number).padStart(2, '0')} · {assignment.locker.size}
            </Badge>
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
    [openOffboardDialog, handleReactivate, reactivatingId]
  );

  if (isLoading) {
    return <div className="py-20 text-center font-medium text-muted-foreground">Carregando colaboradores...</div>;
  }

  const offboardAssignment = employeeToOffboard ? getActiveAssignment(employeeToOffboard) : null;
  const offboardDescription = employeeToOffboard
    ? offboardAssignment?.locker
      ? `Deseja desligar "${employeeToOffboard.full_name}"? O armário nº ${String(offboardAssignment.locker.number).padStart(2, '0')} (${offboardAssignment.locker.size}) será liberado automaticamente.`
      : `Deseja desligar "${employeeToOffboard.full_name}"? Ele não possui armário atribuído.`
    : '';

  return (
    <PageContainer>
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Cadastro global de colaboradores da empresa</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsRolesDialogOpen(true)}>
            <Settings2 className="h-4 w-4" /> Funções
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
        <Select value={filterSector} onValueChange={setFilterSector}>
          <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm sm:w-[200px]">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {sectors.map((sector) => (
              <SelectItem key={sector.id} value={sector.id}>
                {sector.name}
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
          searchTerm || filterSector !== 'all' || filterRole !== 'all' || filterStatus !== 'all'
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
                name="sector_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione um setor" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectors.map((sector) => (
                            <SelectItem key={sector.id} value={sector.id}>
                              {sector.name}
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

      {/* Dialog: Gestão de Funções */}
      <Dialog open={isRolesDialogOpen} onOpenChange={handleRolesDialogOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Funções</DialogTitle>
            <DialogDescription>Cadastre e gerencie as funções dos colaboradores.</DialogDescription>
          </DialogHeader>

          <Form {...roleForm}>
            <form className="flex items-start gap-2" onSubmit={(event) => void handleAddRole(event)}>
              <FormField
                control={roleForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input {...field} placeholder="Nova função (ex: Motorista)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="icon" disabled={isSavingRole} title="Adicionar função" aria-label="Adicionar função">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </Form>

          <div className="max-h-[320px] space-y-1 overflow-y-auto">
            {roles.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma função cadastrada.</p>
            ) : (
              roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  {editingRoleId === role.id ? (
                    <>
                      <Input
                        value={editingRoleName}
                        onChange={(event) => setEditingRoleName(event.target.value)}
                        autoFocus
                        className="h-8 flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-success"
                        title="Salvar"
                        aria-label="Salvar"
                        onClick={() => void saveEditRole()}
                        disabled={isSavingRole}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        title="Cancelar"
                        aria-label="Cancelar"
                        onClick={cancelEditRole}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-foreground">{role.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Renomear função"
                        aria-label="Renomear função"
                        onClick={() => startEditRole(role)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Excluir função"
                        aria-label="Excluir função"
                        onClick={() => openRoleDeleteDialog(role)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      <ConfirmDialog
        open={isRoleDeleteDialogOpen}
        onOpenChange={setIsRoleDeleteDialogOpen}
        title="Excluir função"
        description={`Deseja excluir a função "${roleToDelete?.name || ''}"?`}
        onConfirm={handleDeleteRole}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        isLoading={isDeletingRole}
      />
    </PageContainer>
  );
}
