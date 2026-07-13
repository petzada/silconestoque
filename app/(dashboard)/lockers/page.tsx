'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { PageContainer } from '@/components/layout/page-container';
import {
  Plus,
  Pencil,
  Search,
  Upload,
  Lock,
  LockOpen,
  Users,
  Check,
  ChevronsUpDown,
  CheckCircle2,
  XCircle,
  FolderInput,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Employee, Locker, LockerSize, Sector, Role } from '@/lib/types';
import { LOCKER_SIZES } from '@/lib/types';

// ---------- Types ----------

type AssignmentEmployee = Pick<Employee, 'id' | 'full_name'> & {
  sector?: Pick<Sector, 'name'> | null;
  role?: Pick<Role, 'name'> | null;
};

type ActiveAssignmentJoin = {
  id: string;
  started_at: string;
  employee: AssignmentEmployee | null;
};

type LockerRow = Locker & { locker_assignments?: ActiveAssignmentJoin[] | null };

type EmployeeOption = Pick<Employee, 'id' | 'full_name'> & {
  sector?: Pick<Sector, 'name'> | null;
  role?: Pick<Role, 'name'> | null;
};

type HistoryEntry = {
  id: string;
  started_at: string;
  ended_at: string | null;
  employee: { full_name: string } | null;
};

type LockerStatus = 'occupied' | 'free' | 'inactive';

interface CSVValidRow {
  number: number;
  size: LockerSize;
}

interface CSVErrorRow {
  line: number;
  numero: string;
  tamanho: string;
  reason: string;
}

interface CSVValidationResult {
  valid: CSVValidRow[];
  errors: CSVErrorRow[];
}

// ---------- Helpers ----------

function getActiveAssignment(locker: LockerRow): ActiveAssignmentJoin | null {
  return locker.locker_assignments?.[0] ?? null;
}

function getLockerStatus(locker: LockerRow): LockerStatus {
  if (!locker.is_active) return 'inactive';
  return getActiveAssignment(locker) ? 'occupied' : 'free';
}

function formatDateTime(value: string): string {
  return format(new Date(value), 'dd/MM/yyyy HH:mm');
}

function friendlyDbError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('uniq_active_assignment_per_locker')) {
    return 'Este armário acabou de ser ocupado.';
  }
  if (message.includes('uniq_active_assignment_per_employee_kind')) {
    return 'Este colaborador já possui um armário.';
  }
  if (message.includes('uniq_lockers_kind_number') || message.includes('duplicate key')) {
    return 'Já existe um armário com esse número.';
  }
  return fallback;
}

const lockerFormSchema = z.object({
  number: z.number().int().min(1, 'Informe um número válido.'),
  size: z.enum(['P', 'M', 'G', 'GG', 'XG', 'SSG']),
});

type LockerFormValues = z.infer<typeof lockerFormSchema>;

const initialLockerFormValues: LockerFormValues = {
  number: 0,
  size: 'M',
};

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

// ---------- Page ----------

export default function LockersPage() {
  const [lockers, setLockers] = useState<LockerRow[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSize, setFilterSize] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | LockerStatus>('all');

  // Sheet
  const [selectedLockerId, setSelectedLockerId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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

  // New/edit locker dialog
  const [isLockerDialogOpen, setIsLockerDialogOpen] = useState(false);
  const [editingLocker, setEditingLocker] = useState<LockerRow | null>(null);
  const [isSavingLocker, setIsSavingLocker] = useState(false);

  // Import dialog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lockerForm = useForm<LockerFormValues>({
    resolver: zodResolver(lockerFormSchema),
    defaultValues: initialLockerFormValues,
  });

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [lockersRes, employeesRes] = await Promise.all([
        supabase
          .from('lockers')
          .select(
            '*, locker_assignments!left(id, started_at, ended_at, employee:employees(id, full_name, sector:sectors(name), role:roles(name)))'
          )
          .eq('kind', 'uniforme')
          .is('locker_assignments.ended_at', null)
          .order('number'),
        supabase
          .from('employees')
          .select('id, full_name, sector:sectors(name), role:roles(name)')
          .eq('is_active', true)
          .order('full_name'),
      ]);

      if (lockersRes.error) throw lockersRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setLockers(lockersRes.data || []);
      setActiveEmployees((employeesRes.data as unknown as EmployeeOption[]) || []);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

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

  const occupiedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    lockers.forEach((locker) => {
      const assignment = getActiveAssignment(locker);
      if (assignment?.employee) ids.add(assignment.employee.id);
    });
    return ids;
  }, [lockers]);

  const employeesWithoutLocker = useMemo(
    () => activeEmployees.filter((employee) => !occupiedEmployeeIds.has(employee.id)),
    [activeEmployees, occupiedEmployeeIds]
  );

  const selectedLocker = useMemo(
    () => lockers.find((locker) => locker.id === selectedLockerId) ?? null,
    [lockers, selectedLockerId]
  );
  const selectedAssignment = selectedLocker ? getActiveAssignment(selectedLocker) : null;

  const summary = useMemo(() => {
    const total = lockers.length;
    const occupied = lockers.filter((locker) => getLockerStatus(locker) === 'occupied').length;
    const free = lockers.filter((locker) => getLockerStatus(locker) === 'free').length;
    return { total, occupied, free, withoutLocker: employeesWithoutLocker.length };
  }, [lockers, employeesWithoutLocker]);

  const filteredLockers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return lockers
      .filter((locker) => {
        const assignment = getActiveAssignment(locker);
        const matchesSearch =
          !normalizedSearch ||
          String(locker.number).includes(normalizedSearch) ||
          assignment?.employee?.full_name.toLowerCase().includes(normalizedSearch);
        const matchesSize = filterSize === 'all' || locker.size === filterSize;
        const matchesStatus = filterStatus === 'all' || getLockerStatus(locker) === filterStatus;
        return matchesSearch && matchesSize && matchesStatus;
      })
      .sort((a, b) => a.number - b.number);
  }, [lockers, searchTerm, filterSize, filterStatus]);

  // ----- Sheet handlers -----

  const openSheet = (locker: LockerRow) => {
    setSelectedLockerId(locker.id);
    setIsSheetOpen(true);
    setIsTransferMode(false);
    setTransferEmployeeId('');
    setAssignEmployeeId('');
    void fetchHistory(locker.id);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setSelectedLockerId(null);
      setHistory([]);
      setIsTransferMode(false);
      setTransferEmployeeId('');
      setAssignEmployeeId('');
    }
  };

  const handleAssign = async () => {
    if (!selectedLocker || !assignEmployeeId) return;
    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('locker_assignments')
        .insert({ locker_id: selectedLocker.id, employee_id: assignEmployeeId });
      if (error) throw error;

      toast.success('Armário atribuído com sucesso');
      setAssignEmployeeId('');
      await fetchData();
      await fetchHistory(selectedLocker.id);
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao atribuir armário'));
      await fetchData();
    } finally {
      setIsAssigning(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedLocker || !selectedAssignment || !transferEmployeeId) return;
    setIsTransferring(true);
    try {
      const { error: releaseError } = await supabase
        .from('locker_assignments')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', selectedAssignment.id);
      if (releaseError) throw releaseError;

      const { error: assignError } = await supabase
        .from('locker_assignments')
        .insert({ locker_id: selectedLocker.id, employee_id: transferEmployeeId });
      if (assignError) throw assignError;

      toast.success('Armário transferido com sucesso');
      setIsTransferMode(false);
      setTransferEmployeeId('');
      await fetchData();
      await fetchHistory(selectedLocker.id);
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao transferir armário'));
      await fetchData();
      await fetchHistory(selectedLocker.id);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRelease = async () => {
    if (!selectedLocker || !selectedAssignment) return;
    setIsReleasing(true);
    try {
      const { error } = await supabase
        .from('locker_assignments')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', selectedAssignment.id);
      if (error) throw error;

      toast.success('Armário liberado com sucesso');
      setIsReleaseDialogOpen(false);
      await fetchData();
      await fetchHistory(selectedLocker.id);
    } catch {
      toast.error('Erro ao liberar armário');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedLocker) return;
    setIsDeactivating(true);
    try {
      const { error } = await supabase.from('lockers').update({ is_active: false }).eq('id', selectedLocker.id);
      if (error) throw error;

      toast.success('Armário desativado');
      setIsDeactivateDialogOpen(false);
      await fetchData();
    } catch {
      toast.error('Erro ao desativar armário');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateLocker = async () => {
    if (!selectedLocker) return;
    try {
      const { error } = await supabase.from('lockers').update({ is_active: true }).eq('id', selectedLocker.id);
      if (error) throw error;
      toast.success('Armário reativado');
      await fetchData();
    } catch {
      toast.error('Erro ao reativar armário');
    }
  };

  // ----- New/Edit locker dialog -----

  const openNewLockerDialog = () => {
    setEditingLocker(null);
    lockerForm.reset(initialLockerFormValues);
    setIsLockerDialogOpen(true);
  };

  const openEditLockerDialog = (locker: LockerRow) => {
    setEditingLocker(locker);
    lockerForm.reset({ number: locker.number, size: (locker.size as LockerSize) ?? 'M' });
    setIsLockerDialogOpen(true);
  };

  const handleLockerDialogOpenChange = (open: boolean) => {
    if (!open && lockerForm.formState.isDirty) {
      const shouldClose = window.confirm('Descartar alterações não salvas?');
      if (!shouldClose) return;
    }
    if (!open) {
      setEditingLocker(null);
      lockerForm.reset(initialLockerFormValues);
    }
    setIsLockerDialogOpen(open);
  };

  const handleSaveLocker = lockerForm.handleSubmit(async (values) => {
    setIsSavingLocker(true);
    try {
      if (editingLocker) {
        const { error } = await supabase
          .from('lockers')
          .update({ number: values.number, size: values.size })
          .eq('id', editingLocker.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lockers')
          .insert({ kind: 'uniforme', number: values.number, size: values.size });
        if (error) throw error;
      }

      toast.success(editingLocker ? 'Armário atualizado' : 'Armário criado');
      setIsLockerDialogOpen(false);
      setEditingLocker(null);
      lockerForm.reset(initialLockerFormValues);
      await fetchData();
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao salvar armário'));
    } finally {
      setIsSavingLocker(false);
    }
  });

  // ----- CSV import -----

  const validateCSV = useCallback(
    async (file: File) => {
      setIsValidating(true);
      setValidationResult(null);
      try {
        const buffer = await file.arrayBuffer();
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
          text = new TextDecoder('windows-1252').decode(buffer);
        }

        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) {
          toast.error('Arquivo vazio');
          setIsValidating(false);
          return;
        }

        const delimiter = lines[0].includes(';') ? ';' : ',';
        const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
        const numeroIdx = header.findIndex((h) => h === 'numero' || h === 'número');
        const tamanhoIdx = header.indexOf('tamanho');

        if (numeroIdx === -1 || tamanhoIdx === -1) {
          toast.error('Colunas obrigatórias: numero, tamanho');
          setIsValidating(false);
          return;
        }

        const existingNumbers = new Set(lockers.map((locker) => locker.number));
        const seenInFile = new Set<number>();
        const valid: CSVValidRow[] = [];
        const errors: CSVErrorRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim());
          const numeroRaw = cols[numeroIdx] || '';
          const tamanhoRaw = (cols[tamanhoIdx] || '').toUpperCase();
          const number = /^\d+$/.test(numeroRaw) ? Number(numeroRaw) : NaN;

          if (!numeroRaw || Number.isNaN(number) || number <= 0) {
            errors.push({ line: i + 1, numero: numeroRaw || '(vazio)', tamanho: tamanhoRaw, reason: 'Número inválido' });
            continue;
          }
          if (!LOCKER_SIZES.includes(tamanhoRaw as LockerSize)) {
            errors.push({
              line: i + 1,
              numero: numeroRaw,
              tamanho: tamanhoRaw || '(vazio)',
              reason: `Tamanho "${tamanhoRaw}" inválido`,
            });
            continue;
          }
          if (existingNumbers.has(number)) {
            errors.push({ line: i + 1, numero: numeroRaw, tamanho: tamanhoRaw, reason: 'Número já existente' });
            continue;
          }
          if (seenInFile.has(number)) {
            errors.push({ line: i + 1, numero: numeroRaw, tamanho: tamanhoRaw, reason: 'Duplicado no arquivo' });
            continue;
          }

          seenInFile.add(number);
          valid.push({ number, size: tamanhoRaw as LockerSize });
        }

        setValidationResult({ valid, errors });
      } catch {
        toast.error('Erro ao processar arquivo CSV');
      } finally {
        setIsValidating(false);
      }
    },
    [lockers]
  );

  const handleFileSelect = (file: File | null) => {
    setImportFile(file);
    setValidationResult(null);
    if (file) void validateCSV(file);
  };

  const handleCloseImportDialog = () => {
    setIsImportDialogOpen(false);
    setImportFile(null);
    setValidationResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportValidRows = async () => {
    if (!validationResult || validationResult.valid.length === 0) {
      toast.error('Nenhum armário válido para importar');
      return;
    }

    setIsImporting(true);
    try {
      const { error } = await supabase.from('lockers').insert(
        validationResult.valid.map((row) => ({ kind: 'uniforme', number: row.number, size: row.size }))
      );
      if (error) throw error;

      toast.success(`${validationResult.valid.length} armário(s) importado(s) com sucesso.`);
      handleCloseImportDialog();
      await fetchData();
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao importar armários. Nenhum registro foi importado.'));
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center font-medium text-muted-foreground">Carregando armários...</div>;
  }

  return (
    <PageContainer>
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Armários &amp; Chapas</h1>
          <p className="text-sm text-muted-foreground">Controle de armários de uniforme por chapa</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4" /> Importar planilha
          </Button>
          <Button type="button" size="sm" onClick={openNewLockerDialog}>
            <Plus className="h-4 w-4" /> Novo armário
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 px-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-foreground">{summary.total}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 px-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ocupados</span>
            <span className="text-2xl font-bold text-primary">{summary.occupied}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 px-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Livres</span>
            <span className="text-2xl font-bold text-foreground">{summary.free}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 px-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sem armário</span>
            <span className="text-2xl font-bold text-warning">{summary.withoutLocker}</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-sm sm:flex-row sm:items-center">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou colaborador..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-10 rounded-lg border-border pl-9 text-sm"
          />
        </div>
        <Select value={filterSize} onValueChange={setFilterSize}>
          <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm sm:w-[140px]">
            <SelectValue placeholder="Tamanho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {LOCKER_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
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
            <SelectItem value="occupied">Ocupado</SelectItem>
            <SelectItem value="free">Livre</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredLockers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          {lockers.length === 0 ? 'Nenhum armário cadastrado.' : 'Nenhum armário encontrado para este filtro.'}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {filteredLockers.map((locker) => {
            const status = getLockerStatus(locker);
            const assignment = getActiveAssignment(locker);
            return (
              <button
                key={locker.id}
                type="button"
                onClick={() => openSheet(locker)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-colors',
                  status === 'occupied' && 'border-primary/40 bg-primary/5 hover:bg-primary/10',
                  status === 'free' && 'border-dashed border-border bg-card hover:bg-muted/50',
                  status === 'inactive' && 'border-border bg-muted opacity-50 hover:opacity-70'
                )}
              >
                <span className={cn('text-xl font-bold', status === 'occupied' ? 'text-primary' : 'text-foreground')}>
                  {String(locker.number).padStart(2, '0')}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {locker.size}
                </Badge>
                <span className="line-clamp-1 max-w-full text-[11px] font-medium text-muted-foreground">
                  {status === 'inactive' ? 'Inativo' : assignment?.employee?.full_name || 'Livre'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sheet: detalhes do armário */}
      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          {selectedLocker && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {getLockerStatus(selectedLocker) === 'occupied' ? (
                    <Lock className="h-4 w-4 text-primary" />
                  ) : (
                    <LockOpen className="h-4 w-4 text-muted-foreground" />
                  )}
                  Armário nº {String(selectedLocker.number).padStart(2, '0')}
                </SheetTitle>
                <SheetDescription>
                  Tamanho {selectedLocker.size} · {selectedLocker.is_active ? 'Ativo' : 'Inativo'}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
                {!selectedLocker.is_active && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    <span>Este armário está desativado.</span>
                    <Button type="button" variant="link" className="h-auto p-0" onClick={() => void handleReactivateLocker()}>
                      Reativar
                    </Button>
                  </div>
                )}

                {selectedLocker.is_active && selectedAssignment && (
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

                {selectedLocker.is_active && !selectedAssignment && (
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
                <Button type="button" variant="outline" size="sm" onClick={() => openEditLockerDialog(selectedLocker)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                {selectedLocker.is_active && (
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

      {/* Dialog: Novo/Editar armário */}
      <Dialog open={isLockerDialogOpen} onOpenChange={handleLockerDialogOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingLocker ? 'Editar armário' : 'Novo armário'}</DialogTitle>
          </DialogHeader>
          <Form {...lockerForm}>
            <form className="grid gap-4 pt-2" onSubmit={(event) => void handleSaveLocker(event)}>
              <FormField
                control={lockerForm.control}
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
              <FormField
                control={lockerForm.control}
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
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => handleLockerDialogOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSavingLocker}>
                  {isSavingLocker ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Importar CSV */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className={cn(validationResult ? 'max-w-2xl' : 'max-w-md')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="h-4 w-4 text-primary" /> Importar armários via CSV
            </DialogTitle>
            <DialogDescription>Colunas obrigatórias: numero, tamanho.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border-2 border-dashed border-border bg-muted p-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
                className="hidden"
                id="lockers-csv-upload"
              />
              <label htmlFor="lockers-csv-upload" className="cursor-pointer">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  {importFile ? importFile.name : 'Clique para selecionar arquivo'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Formato CSV separado por vírgula ou ponto e vírgula</p>
              </label>
            </div>

            {isValidating && (
              <p className="animate-pulse py-2 text-center text-sm font-medium text-muted-foreground">Validando arquivo...</p>
            )}

            {validationResult && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex flex-1 items-center gap-2 rounded-lg bg-success-muted p-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-semibold text-success">{validationResult.valid.length} válidos</p>
                      <p className="text-[10px] text-success">Prontos para importar</p>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center gap-2 rounded-lg bg-destructive/10 p-3">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">{validationResult.errors.length} com erro</p>
                      <p className="text-[10px] text-destructive">Verifique abaixo</p>
                    </div>
                  </div>
                </div>

                {validationResult.errors.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="bg-destructive/10 px-3 py-2">
                      <span className="text-xs font-semibold text-destructive">Linhas com erro</span>
                    </div>
                    <div className="max-h-[220px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted">
                            <TableHead className="w-[60px] px-3 py-2 text-[10px] font-semibold">Linha</TableHead>
                            <TableHead className="px-3 py-2 text-[10px] font-semibold">Número</TableHead>
                            <TableHead className="px-3 py-2 text-[10px] font-semibold">Tamanho</TableHead>
                            <TableHead className="px-3 py-2 text-[10px] font-semibold">Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.errors.slice(0, 30).map((error, index) => (
                            <TableRow key={index} className="border-border">
                              <TableCell className="px-3 py-1.5 font-mono text-xs">{error.line}</TableCell>
                              <TableCell className="px-3 py-1.5 text-xs">{error.numero}</TableCell>
                              <TableCell className="px-3 py-1.5 text-xs">{error.tamanho}</TableCell>
                              <TableCell className="px-3 py-1.5 text-xs font-medium text-destructive">{error.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {validationResult.errors.length > 30 && (
                        <p className="py-2 text-center text-[10px] text-muted-foreground">
                          ... e mais {validationResult.errors.length - 30} erros.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={handleCloseImportDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleImportValidRows()}
                disabled={isImporting || !validationResult || validationResult.valid.length === 0}
              >
                {isImporting ? 'Importando...' : `Importar ${validationResult?.valid.length || 0} válidos`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isReleaseDialogOpen}
        onOpenChange={setIsReleaseDialogOpen}
        title="Liberar armário"
        description={`Deseja liberar o armário nº ${selectedLocker ? String(selectedLocker.number).padStart(2, '0') : ''}? O colaborador atual perderá a atribuição.`}
        onConfirm={handleRelease}
        confirmLabel="Liberar"
        cancelLabel="Cancelar"
        isLoading={isReleasing}
      />

      <ConfirmDialog
        open={isDeactivateDialogOpen}
        onOpenChange={setIsDeactivateDialogOpen}
        title="Desativar armário"
        description={`Deseja desativar o armário nº ${selectedLocker ? String(selectedLocker.number).padStart(2, '0') : ''}? Ele deixará de aparecer para novas atribuições, mas o histórico será mantido.`}
        onConfirm={handleDeactivate}
        confirmLabel="Desativar"
        cancelLabel="Cancelar"
        isLoading={isDeactivating}
      />
    </PageContainer>
  );
}
