'use client';

import { useState } from 'react';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export type SimpleCrudItem = {
  id: string;
  name: string;
};

type SimpleCrudDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Supabase table backing this list. Must have `id` and a unique `name`. */
  table: 'roles' | 'departments';
  title: string;
  description: string;
  placeholder: string;
  /** Singular noun used in titles, e.g. "função" -> "Excluir função". */
  entityLabel: string;
  /** Shown when the unique name index rejects a create/rename. */
  duplicateMessage: string;
  /** Shown when a delete is blocked by a foreign key from employees. */
  inUseMessage: string;
  items: SimpleCrudItem[];
  /** Called after any successful create/rename/delete so the parent can refetch. */
  onChanged: () => Promise<void> | void;
};

const nameSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.'),
});

type NameFormValues = z.infer<typeof nameSchema>;

export function SimpleCrudDialog({
  open,
  onOpenChange,
  table,
  title,
  description,
  placeholder,
  entityLabel,
  duplicateMessage,
  inUseMessage,
  items,
  onChanged,
}: SimpleCrudDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SimpleCrudItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: '' },
  });

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleAdd = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from(table).insert({ name: values.name.trim() });
      if (error) throw error;
      toast.success('Salvo com sucesso');
      form.reset({ name: '' });
      await onChanged();
    } catch (error: unknown) {
      toast.error(getDbErrorMessage(error, 'Erro ao salvar', { '23505': duplicateMessage }));
    } finally {
      setIsSaving(false);
    }
  });

  const startEdit = (item: SimpleCrudItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const trimmed = editingName.trim();
    if (trimmed.length < 2) {
      toast.error('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from(table).update({ name: trimmed }).eq('id', editingId);
      if (error) throw error;
      toast.success('Atualizado');
      cancelEdit();
      await onChanged();
    } catch (error: unknown) {
      toast.error(getDbErrorMessage(error, 'Erro ao atualizar', { '23505': duplicateMessage }));
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteDialog = (item: SimpleCrudItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from(table).delete().eq('id', itemToDelete.id);
      if (error) throw error;
      toast.success('Excluído');
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      await onChanged();
    } catch (error: unknown) {
      toast.error(getDbErrorMessage(error, 'Erro ao excluir', { '23503': inUseMessage }));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      cancelEdit();
      form.reset({ name: '' });
    }
    onOpenChange(nextOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="flex items-start gap-2" onSubmit={(event) => void handleAdd(event)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input {...field} placeholder={placeholder} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="icon" disabled={isSaving} title="Adicionar" aria-label="Adicionar">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </Form>

          <div className="max-h-[320px] space-y-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum registro cadastrado.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 border border-border px-3 py-2"
                >
                  {editingId === item.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
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
                        onClick={() => void saveEdit()}
                        disabled={isSaving}
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
                        onClick={cancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Renomear"
                        aria-label="Renomear"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-danger-muted hover:text-destructive"
                        title="Excluir"
                        aria-label="Excluir"
                        onClick={() => openDeleteDialog(item)}
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
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Excluir ${entityLabel}`}
        description={`Deseja excluir "${itemToDelete?.name || ''}"?`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        isLoading={isDeleting}
      />
    </>
  );
}
