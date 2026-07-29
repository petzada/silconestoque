'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { CheckCircle2, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { isPostgrestLikeError } from '@/lib/db-error';
import type { LockerKind } from '@/lib/types';

const MAX_RANGE = 500;

const rangeSchema = z
  .object({
    from: z.number().int().min(1, 'Informe um número válido.'),
    to: z.number().int().min(1, 'Informe um número válido.'),
  })
  .refine((data) => data.from <= data.to, {
    message: 'O valor "De" deve ser menor ou igual a "Até".',
    path: ['to'],
  })
  .refine((data) => data.to - data.from + 1 <= MAX_RANGE, {
    message: `A faixa deve ter no máximo ${MAX_RANGE} números.`,
    path: ['to'],
  });

type RangeFormValues = z.infer<typeof rangeSchema>;

const initialRangeValues: RangeFormValues = { from: 0, to: 0 };

interface RangePreview {
  toCreate: number[];
  existing: number[];
}

interface LockerRangeDialogProps {
  kind: LockerKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
}

export function LockerRangeDialog({ kind, open, onOpenChange, onCreated }: LockerRangeDialogProps) {
  const [preview, setPreview] = useState<RangePreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<RangeFormValues>({
    resolver: zodResolver(rangeSchema),
    defaultValues: initialRangeValues,
  });

  useEffect(() => {
    if (!open) {
      form.reset(initialRangeValues);
      setPreview(null);
    }
  }, [open, form]);

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (form.formState.isDirty || preview) && !isCreating) {
      const shouldClose = window.confirm('Descartar a pré-visualização e fechar?');
      if (!shouldClose) return;
    }
    onOpenChange(nextOpen);
  };

  const handlePreview = form.handleSubmit(async (values) => {
    setIsPreviewing(true);
    try {
      const { data, error } = await supabase
        .from('lockers')
        .select('number')
        .eq('kind', kind)
        .gte('number', values.from)
        .lte('number', values.to);
      if (error) throw error;

      const existingSet = new Set((data || []).map((row) => row.number as number));
      const toCreate: number[] = [];
      const existing: number[] = [];
      for (let n = values.from; n <= values.to; n++) {
        if (existingSet.has(n)) {
          existing.push(n);
        } else {
          toCreate.push(n);
        }
      }
      setPreview({ toCreate, existing });
    } catch {
      toast.error('Erro ao consultar armários existentes');
    } finally {
      setIsPreviewing(false);
    }
  });

  const handleCreate = async () => {
    if (!preview) return;
    setIsCreating(true);
    try {
      if (preview.toCreate.length > 0) {
        const { error } = await supabase
          .from('lockers')
          .insert(preview.toCreate.map((number) => ({ kind, number, size: null })));
        if (error) {
          // `error` aqui é o objeto desestruturado da resposta, nunca
          // embrulhado em `Error` — checar o código Postgres (23505,
          // unique_violation) em vez de `instanceof Error` é o que faz este
          // ramo de fato disparar.
          if (isPostgrestLikeError(error) && error.code === '23505') {
            toast.error('Alguns números foram criados por outro usuário nesse meio tempo. Pré-visualização atualizada.');
            await handlePreview();
            return;
          }
          throw error;
        }
      }

      toast.success(`${preview.toCreate.length} criados, ${preview.existing.length} ignorados`);
      form.reset(initialRangeValues);
      setPreview(null);
      onOpenChange(false);
      await onCreated();
    } catch {
      toast.error('Erro ao criar armários');
    } finally {
      setIsCreating(false);
    }
  };

  const ignoredPreview = preview?.existing.slice(0, 20) ?? [];
  const ignoredRemainder = preview ? preview.existing.length - ignoredPreview.length : 0;

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Criar por faixa</DialogTitle>
          <DialogDescription>Cria vários armários numerados de uma vez (máximo {MAX_RANGE} por operação).</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 pt-2"
            onSubmit={(event) => {
              setPreview(null);
              void handlePreview(event);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>De</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        autoFocus
                        value={field.value || ''}
                        onChange={(event) => {
                          field.onChange(Number(event.target.value));
                          setPreview(null);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Até</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={field.value || ''}
                        onChange={(event) => {
                          field.onChange(Number(event.target.value));
                          setPreview(null);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" variant="outline" disabled={isPreviewing}>
              <Search className="h-4 w-4" /> {isPreviewing ? 'Consultando...' : 'Pré-visualizar'}
            </Button>

            {preview && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex flex-1 items-center gap-2 bg-success-muted p-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-semibold text-success">{preview.toCreate.length} serão criados</p>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center gap-2 bg-muted p-3">
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{preview.existing.length} já existem</p>
                      <p className="text-[10px] text-muted-foreground">Serão ignorados</p>
                    </div>
                  </div>
                </div>
                {preview.existing.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ignorados: {ignoredPreview.join(', ')}
                    {ignoredRemainder > 0 && ` … e mais ${ignoredRemainder}`}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => requestOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={!preview || isCreating} onClick={() => void handleCreate()}>
                {isCreating ? 'Criando...' : preview ? `Criar ${preview.toCreate.length} armários` : 'Criar armários'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
