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
import type { Category } from '@/lib/types';

// Esta tela gerencia `categories`: a classificação de material do produto
// (EPIs, Copa e Limpeza...). Não confundir com Setor de colaborador
// (departamento real da empresa), gerenciado em /sectors. Ver ADR-0003.
const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome da categoria com pelo menos 2 caracteres.'),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const confirm = useConfirm();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    void fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch {
      toast.error('Erro ao carregar categorias');
    } finally {
      setIsLoading(false);
    }
  };

  const openFormDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      form.reset({ name: category.name });
    } else {
      setEditingCategory(null);
      form.reset({ name: '' });
    }
    setIsDialogOpen(true);
  };

  const closeFormDialog = () => {
    setEditingCategory(null);
    form.reset({ name: '' });
    setIsDialogOpen(false);
  };

  // Leitura em render (NÃO dentro do handler): é o que assina o Proxy do
  // formState e mantém `isDirty` atualizado. Ver o comentário longo em
  // app/(dashboard)/sectors/page.tsx e a §10.2 do plano de 2026-07-30.
  const { isDirty } = form.formState;

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && isDirty) {
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
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({ name: values.name.trim() })
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert({ name: values.name.trim() });
        if (error) throw error;
      }

      toast.success('Salvo com sucesso');
      setIsDialogOpen(false);
      setEditingCategory(null);
      form.reset({ name: '' });
      await fetchCategories();
    } catch (error: unknown) {
      toast.error(getDbErrorMessage(error, 'Erro ao salvar categoria', { '23505': 'Já existe uma categoria com esse nome.' }));
    } finally {
      setIsSaving(false);
    }
  });

  const openDeleteDialog = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', categoryToDelete.id);
      if (error) throw error;

      toast.success('Categoria excluida com sucesso');
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
      await fetchCategories();
    } catch (error: unknown) {
      toast.error(
        getDbErrorMessage(error, 'Erro ao excluir categoria', {
          '23503': 'Existem produtos vinculados a esta categoria.',
        })
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo<DataTableColumn<Category>[]>(
    () => [
      {
        key: 'name',
        header: 'Categoria',
        sortable: true,
        accessor: (category) => category.name,
        cell: (category) => <span className="font-medium text-foreground">{category.name}</span>,
      },
      {
        key: 'actions',
        header: 'Acoes',
        align: 'right',
        cell: (category) => (
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Editar categoria"
              aria-label="Editar categoria"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openFormDialog(category)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Excluir categoria"
              aria-label="Excluir categoria"
              className="h-8 w-8 text-muted-foreground hover:bg-danger-muted hover:text-destructive"
              onClick={() => openDeleteDialog(category)}
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
    return <PageLoading label="Carregando categorias..." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Categorias"
        description="Classificação dos produtos do almoxarifado por tipo de material"
        actions={
          <Button type="button" size="sm" onClick={() => openFormDialog()}>
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        }
      />

      <DataTable
        data={categories}
        columns={columns}
        rowKey={(category) => category.id}
        emptyMessage="Nenhuma categoria cadastrada."
        defaultSort={{ key: 'name', direction: 'asc' }}
        initialPageSize={10}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
 <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-4 pt-2" onSubmit={(event) => void handleSave(event)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da categoria</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        placeholder="Ex: EPIs, Copa e Limpeza..."
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
        description={`Deseja excluir a categoria \"${categoryToDelete?.name || ''}\"?`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        isLoading={isDeleting}
      />
    </PageContainer>
  );
}
