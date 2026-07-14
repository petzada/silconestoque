'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
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
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Sector } from '@/lib/types';

const sectorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do setor com pelo menos 2 caracteres.'),
});

type SectorFormValues = z.infer<typeof sectorSchema>;

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorToDelete, setSectorToDelete] = useState<Sector | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<SectorFormValues>({
    resolver: zodResolver(sectorSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    void fetchSectors();
  }, []);

  const fetchSectors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('sectors').select('*').order('name');
      if (error) throw error;
      setSectors(data || []);
    } catch {
      toast.error('Erro ao carregar setores');
    } finally {
      setIsLoading(false);
    }
  };

  const openFormDialog = (sector?: Sector) => {
    if (sector) {
      setEditingSector(sector);
      form.reset({ name: sector.name });
    } else {
      setEditingSector(null);
      form.reset({ name: '' });
    }
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && form.formState.isDirty) {
      const shouldClose = window.confirm('Descartar alteracoes nao salvas?');
      if (!shouldClose) return;
    }

    if (!open) {
      setEditingSector(null);
      form.reset({ name: '' });
    }

    setIsDialogOpen(open);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      if (editingSector) {
        const { error } = await supabase
          .from('sectors')
          .update({ name: values.name.trim() })
          .eq('id', editingSector.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sectors').insert({ name: values.name.trim() });
        if (error) throw error;
      }

      toast.success('Salvo com sucesso');
      setIsDialogOpen(false);
      setEditingSector(null);
      form.reset({ name: '' });
      await fetchSectors();
    } catch {
      toast.error('Erro ao salvar setor');
    } finally {
      setIsSaving(false);
    }
  });

  const openDeleteDialog = (sector: Sector) => {
    setSectorToDelete(sector);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!sectorToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('sectors').delete().eq('id', sectorToDelete.id);
      if (error) throw error;

      toast.success('Setor excluido com sucesso');
      setIsDeleteDialogOpen(false);
      setSectorToDelete(null);
      await fetchSectors();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message.includes('foreign') ? 'Existem produtos vinculados ao setor.' : 'Erro ao excluir setor');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo<DataTableColumn<Sector>[]>(
    () => [
      {
        key: 'name',
        header: 'Setor',
        sortable: true,
        accessor: (sector) => sector.name,
        cell: (sector) => <span className="font-medium text-foreground">{sector.name}</span>,
      },
      {
        key: 'actions',
        header: 'Acoes',
        align: 'right',
        cell: (sector) => (
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Editar setor"
              aria-label="Editar setor"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openFormDialog(sector)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Excluir setor"
              aria-label="Excluir setor"
              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => openDeleteDialog(sector)}
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
        description="Departamentos que consomem itens do almoxarifado"
        actions={
          <Button type="button" size="sm" onClick={() => openFormDialog()}>
            <Plus className="h-4 w-4" /> Novo setor
          </Button>
        }
      />

      <DataTable
        data={sectors}
        columns={columns}
        rowKey={(sector) => sector.id}
        emptyMessage="Nenhum setor cadastrado."
        defaultSort={{ key: 'name', direction: 'asc' }}
        initialPageSize={10}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSector ? 'Editar setor' : 'Novo setor'}</DialogTitle>
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
                        placeholder="Ex: Produção, EPIs..."
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
        description={`Deseja excluir o setor \"${sectorToDelete?.name || ''}\"?`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        isLoading={isDeleting}
      />
    </PageContainer>
  );
}
