'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Pencil, Lock, LockOpen, Users, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LockerKind } from '@/lib/types';
import {
  getActiveAssignment,
  getLockerStatus,
  formatDateTime,
  friendlyDbError,
  type LockerRow,
  type EmployeeOption,
  type HistoryEntry,
} from './locker-utils';

// ---------- Employee combobox ----------

function EmployeeCombobox({
  employees,
  value,
  onChange,
  disabled,
}: {
  employees: EmployeeOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = employees.find((employee) => employee.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-10 w-full justify-between text-sm font-normal"
        >
          <span className="truncate">{selected ? selected.full_name : 'Buscar colaborador...'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,90vw)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite para buscar..." className="h-10 text-sm" />
          <CommandList>
            <CommandEmpty>Nenhum colaborador disponível.</CommandEmpty>
            <CommandGroup>
              {employees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.full_name}
                  onSelect={() => {
                    onChange(employee.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5 text-success', value === employee.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span className="text-sm">{employee.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {employee.sector?.name} · {employee.role?.name}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------- Locker sheet ----------

interface LockerSheetProps {
  kind: LockerKind;
  locker: LockerRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeesWithoutLocker: EmployeeOption[];
  onChanged: () => void | Promise<void>;
  onEditRequest: (locker: LockerRow) => void;
}

export function LockerSheet({
  kind,
  locker,
  open,
  onOpenChange,
  employeesWithoutLocker,
  onChanged,
  onEditRequest,
}: LockerSheetProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const [isTransferMode, setIsTransferMode] = useState(false);
  const [transferEmployeeId, setTransferEmployeeId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const fetchHistory = useCallback(async (lockerId: string) => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('locker_assignments')
        .select('id, started_at, ended_at, employee:employees(full_name)')
        .eq('locker_id', lockerId)
        .order('started_at', { ascending: false });
      if (error) throw error;
      setHistory((data as unknown as HistoryEntry[]) || []);
    } catch {
      toast.error('Erro ao carregar histórico do armário');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const lockerId = locker?.id ?? null;

  useEffect(() => {
    if (open && lockerId) {
      setIsTransferMode(false);
      setTransferEmployeeId('');
      setAssignEmployeeId('');
      void fetchHistory(lockerId);
    }
    if (!open) {
      setHistory([]);
      setIsTransferMode(false);
      setTransferEmployeeId('');
      setAssignEmployeeId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockerId]);

  const selectedAssignment = locker ? getActiveAssignment(locker) : null;

  const handleAssign = async () => {
    if (!locker || !assignEmployeeId) return;
    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('locker_assignments')
        .insert({ locker_id: locker.id, employee_id: assignEmployeeId });
      if (error) throw error;

      toast.success('Armário atribuído com sucesso');
      setAssignEmployeeId('');
      await onChanged();
      await fetchHistory(locker.id);
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao atribuir armário'));
      await onChanged();
    } finally {
      setIsAssigning(false);
    }
  };

  const handleTransfer = async () => {
    if (!locker || !selectedAssignment || !transferEmployeeId) return;
    setIsTransferring(true);
    try {
      const { error: releaseError } = await supabase
        .from('locker_assignments')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', selectedAssignment.id);
      if (releaseError) throw releaseError;

      const { error: assignError } = await supabase
        .from('locker_assignments')
        .insert({ locker_id: locker.id, employee_id: transferEmployeeId });
      if (assignError) throw assignError;

      toast.success('Armário transferido com sucesso');
      setIsTransferMode(false);
      setTransferEmployeeId('');
      await onChanged();
      await fetchHistory(locker.id);
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao transferir armário'));
      await onChanged();
      await fetchHistory(locker.id);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRelease = async () => {
    if (!locker || !selectedAssignment) return;
    setIsReleasing(true);
    try {
      const { error } = await supabase
        .from('locker_assignments')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', selectedAssignment.id);
      if (error) throw error;

      toast.success('Armário liberado com sucesso');
      setIsReleaseDialogOpen(false);
      await onChanged();
      await fetchHistory(locker.id);
    } catch {
      toast.error('Erro ao liberar armário');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!locker) return;
    setIsDeactivating(true);
    try {
      const { error } = await supabase.from('lockers').update({ is_active: false }).eq('id', locker.id);
      if (error) throw error;

      toast.success('Armário desativado');
      setIsDeactivateDialogOpen(false);
      await onChanged();
    } catch {
      toast.error('Erro ao desativar armário');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateLocker = async () => {
    if (!locker) return;
    try {
      const { error } = await supabase.from('lockers').update({ is_active: true }).eq('id', locker.id);
      if (error) throw error;
      toast.success('Armário reativado');
      await onChanged();
    } catch {
      toast.error('Erro ao reativar armário');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          {locker && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {getLockerStatus(locker) === 'occupied' ? (
                    <Lock className="h-4 w-4 text-primary" />
                  ) : (
                    <LockOpen className="h-4 w-4 text-muted-foreground" />
                  )}
                  Armário nº {String(locker.number).padStart(2, '0')}
                </SheetTitle>
                <SheetDescription>
                  {kind === 'uniforme' ? `Tamanho ${locker.size} · ` : ''}
                  {locker.is_active ? 'Ativo' : 'Inativo'}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
                {!locker.is_active && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    <span>Este armário está desativado.</span>
                    <Button type="button" variant="link" className="h-auto p-0" onClick={() => void handleReactivateLocker()}>
                      Reativar
                    </Button>
                  </div>
                )}

                {locker.is_active && selectedAssignment && (
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ocupante atual</p>
                    <p className="text-base font-semibold text-foreground">{selectedAssignment.employee?.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAssignment.employee?.sector?.name} · {selectedAssignment.employee?.role?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">Desde {formatDateTime(selectedAssignment.started_at)}</p>

                    {!isTransferMode ? (
                      <div className="flex gap-2 pt-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setIsTransferMode(true)}>
                          <Users className="h-3.5 w-3.5" /> Transferir
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setIsReleaseDialogOpen(true)}
                        >
                          Liberar
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-semibold text-muted-foreground">Transferir para:</p>
                        <EmployeeCombobox
                          employees={employeesWithoutLocker}
                          value={transferEmployeeId}
                          onChange={setTransferEmployeeId}
                        />
                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!transferEmployeeId || isTransferring}
                            onClick={() => void handleTransfer()}
                          >
                            {isTransferring ? 'Transferindo...' : 'Confirmar transferência'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsTransferMode(false);
                              setTransferEmployeeId('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {locker.is_active && !selectedAssignment && (
                  <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Armário livre</p>
                    <EmployeeCombobox employees={employeesWithoutLocker} value={assignEmployeeId} onChange={setAssignEmployeeId} />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!assignEmployeeId || isAssigning}
                      onClick={() => void handleAssign()}
                    >
                      {isAssigning ? 'Atribuindo...' : 'Confirmar atribuição'}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico</p>
                  {isLoadingHistory ? (
                    <p className="text-xs text-muted-foreground">Carregando...</p>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma ocupação registrada.</p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((entry) => (
                        <li key={entry.id} className="rounded-lg bg-muted p-2.5 text-xs">
                          <p className="font-semibold text-foreground">{entry.employee?.full_name || '—'}</p>
                          <p className="text-muted-foreground">
                            {formatDateTime(entry.started_at)} — {entry.ended_at ? formatDateTime(entry.ended_at) : 'Atual'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <SheetFooter className="flex-row justify-between gap-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => onEditRequest(locker)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                {locker.is_active && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 disabled:opacity-40"
                    disabled={!!selectedAssignment}
                    title={selectedAssignment ? 'Libere o armário antes de desativar' : undefined}
                    onClick={() => setIsDeactivateDialogOpen(true)}
                  >
                    Desativar
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={isReleaseDialogOpen}
        onOpenChange={setIsReleaseDialogOpen}
        title="Liberar armário"
        description={`Deseja liberar o armário nº ${locker ? String(locker.number).padStart(2, '0') : ''}? O colaborador atual perderá a atribuição.`}
        onConfirm={handleRelease}
        confirmLabel="Liberar"
        cancelLabel="Cancelar"
        isLoading={isReleasing}
      />

      <ConfirmDialog
        open={isDeactivateDialogOpen}
        onOpenChange={setIsDeactivateDialogOpen}
        title="Desativar armário"
        description={`Deseja desativar o armário nº ${locker ? String(locker.number).padStart(2, '0') : ''}? Ele deixará de aparecer para novas atribuições, mas o histórico será mantido.`}
        onConfirm={handleDeactivate}
        confirmLabel="Desativar"
        cancelLabel="Cancelar"
        isLoading={isDeactivating}
      />
    </>
  );
}
