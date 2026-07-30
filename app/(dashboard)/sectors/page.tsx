'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { getDbErrorMessage } from '@/lib/db-error';
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
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirm } from '@/components/ui/confirm-provider';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Department } from '@/lib/types';

// Esta tela gerencia `departments`: o Setor real onde Colaboradores são
// lotados (Produção, Logística...). Não confundir com Categoria de produto
// (EPIs, Copa e Limpeza...), gerenciada em /categories. Ver ADR-0003.
const departmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do setor com pelo menos 2 caracteres.'),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export default function SectorsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const confirm = useConfirm();

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    void fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (error) throw error;
      setDepartments(data || []);
    } catch {
      toast.error('Erro ao carregar setores');
    } finally {
      setIsLoading(false);
    }
  };

  const openFormDialog = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      form.reset({ name: department.name });
    } else {
      setEditingDepartment(null);
      form.reset({ name: '' });
    }
    setIsDialogOpen(true);
  };

  const closeFormDialog = () => {
    setEditingDepartment(null);
    form.reset({ name: '' });
    setIsDialogOpen(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && form.formState.isDirty) {
      // Estado de abertura é controlado por este componente: no caminho
      // sujo não fechamos de imediato, esperamos a confirmação e só então
      // resetamos e fechamos.
      void (async () => {
        if (
          await confirm({
            title: 'Descartar alterações',
            description: 'Descartar alterações não salvas?',
            confirmLabel: 'Descartar',
          })
        ) {
          closeFormDialog();
        }
      })();
      return;
    }

    if (!open) {
      closeFormDialog();
      return;
    }

    setIsDialogOpen(true);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      if (editingDepartment) {
        const { error } = await supabase
          .from('departments')
          .update({ name: values.name.trim() })
          .eq('id', editingDepartment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('departments').insert({ name: values.name.trim() });
        if (error) throw error;
      }

      toast.success('Salvo com sucesso');
      setIsDialogOpen(false);
      setEditingDepartment(null);
      form.reset({ name: '' });
      await fetchDepartments();
    } catch (error: unknown) {
      toast.error(getDbErrorMessage(error, 'Erro ao salvar setor', { '23505': 'Já existe um setor com esse nome.' }));
    } finally {
      setIsSaving(false);
    }
  });

  const openDeleteDialog = (department: Department) => {
    setDepartmentToDelete(department);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!departmentToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('departments').delete().eq('id', departmentToDelete.id);
      if (error) throw error;

      toast.success('Setor excluido com sucesso');
      setIsDeleteDialogOpen(false);
      setDepartmentToDelete(null);
      await fetchDepartments();
    } catch (error: unknown) {
      toast.error(
        getDbErrorMessage(error, 'Erro ao excluir setor', {
          '23503': 'Existem colaboradores vinculados a este setor.',
        })
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo<DataTableColumn<Department>[]>(
    () => [
      {
        key: 'name',
        header: 'Setor',
        sortable: true,
        accessor: (department) => department.name,
        cell: (department) => <span className="font-medium text-foreground">{department.name}</span>,
      },
      {
        key: 'actions',
        header: 'Acoes',
        align: 'right',
        cell: (department) => (
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Editar setor"
              aria-label="Editar setor"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openFormDialog(department)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Excluir setor"
              aria-label="Excluir setor"
              className="h-8 w-8 text-muted-foreground hover:bg-danger-muted hover:text-destructive"
              onClick={() => openDeleteDialog(department)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  if (isLoading) {
    return <PageLoading label="Carregando setores..." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Setores"
        description="Departamentos da empresa onde os colaboradores são lotados"
        actions={
          <Button type="button" size="sm" onClick={() => openFormDialog()}>
            <Plus className="h-4 w-4" /> Novo setor
          </Button>
        }
      />

      <DataTable
        data={departments}
        columns={columns}
        rowKey={(department) => department.id}
        emptyMessage="Nenhum setor cadastrado."
        defaultSort={{ key: 'name', direction: 'asc' }}
        initialPageSize={10}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
 <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingDepartment ? 'Editar setor' : 'Novo setor'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-4 pt-2" onSubmit={(event) => void handleSave(event)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do setor</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        placeholder="Ex: Produção, Logística..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDialogOpenChange(false)}
                >
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

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Confirmar Exclusao"
        description={`Deseja excluir o setor \"${departmentToDelete?.name || ''}\"?`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        isLoading={isDeleting}
      />
    </PageContainer>
  );
}
