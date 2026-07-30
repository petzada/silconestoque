'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-provider';
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
import { toast } from 'sonner';
import type { LockerKind, LockerSize } from '@/lib/types';
import { LOCKER_SIZES } from '@/lib/types';
import { friendlyDbError, type LockerRow } from './locker-utils';

const lockerFormSchema = z.object({
  number: z.number().int().min(1, 'Informe um número válido.'),
  size: z.enum(['P', 'M', 'G', 'GG', 'XG', 'SSG']),
});

type LockerFormValues = z.infer<typeof lockerFormSchema>;

const initialLockerFormValues: LockerFormValues = {
  number: 0,
  size: 'M',
};

interface LockerFormDialogProps {
  kind: LockerKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLocker: LockerRow | null;
  onSaved: () => void | Promise<void>;
}

export function LockerFormDialog({ kind, open, onOpenChange, editingLocker, onSaved }: LockerFormDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const confirm = useConfirm();

  const form = useForm<LockerFormValues>({
    resolver: zodResolver(lockerFormSchema),
    defaultValues: initialLockerFormValues,
  });

  useEffect(() => {
    if (!open) return;
    if (editingLocker) {
      form.reset({ number: editingLocker.number, size: (editingLocker.size as LockerSize) ?? 'M' });
    } else {
      form.reset(initialLockerFormValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingLocker]);

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && form.formState.isDirty) {
      // `open` é controlado pelo componente pai: no caminho sujo não
      // fechamos de imediato, esperamos a confirmação e só então propagamos
      // o fechamento. Este diálogo pode abrir sobre o LockerSheet já aberto
      // (fluxo "Editar" a partir da ficha do armário) — é exatamente o caso
      // que o ConfirmDialogShell detecta sozinho, via DOM, para não empilhar
      // um segundo scrim.
      void (async () => {
        if (
          await confirm({
            title: 'Descartar alterações',
            description: 'Descartar alterações não salvas?',
            confirmLabel: 'Descartar',
          })
        ) {
          onOpenChange(false);
        }
      })();
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      if (editingLocker) {
        const payload =
          kind === 'uniforme' ? { number: values.number, size: values.size } : { number: values.number, size: null };
        const { error } = await supabase.from('lockers').update(payload).eq('id', editingLocker.id);
        if (error) throw error;
      } else {
        const payload =
          kind === 'uniforme'
            ? { kind, number: values.number, size: values.size }
            : { kind, number: values.number, size: null };
        const { error } = await supabase.from('lockers').insert(payload);
        if (error) throw error;
      }

      toast.success(editingLocker ? 'Armário atualizado' : 'Armário criado');
      form.reset(initialLockerFormValues);
      onOpenChange(false);
      await onSaved();
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao salvar armário'));
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editingLocker ? 'Editar armário' : 'Novo armário'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4 pt-2" onSubmit={(event) => void handleSave(event)}>
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      autoFocus
                      value={field.value || ''}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {kind === 'uniforme' && (
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tamanho</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCKER_SIZES.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => requestOpenChange(false)}>
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
  );
}
