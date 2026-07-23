'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/layout/page-loading';
import { Plus, ListPlus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { LockerKind } from '@/lib/types';
import { LockerGrid } from './locker-grid';
import { LockerSheet } from './locker-sheet';
import { LockerFormDialog } from './locker-form-dialog';
import { LockerRangeDialog } from './locker-range-dialog';
import { LockersCsvImportDialog } from './lockers-csv-import-dialog';
import {
  getActiveAssignment,
  fetchLockersData,
  type LockerRow,
  type EmployeeOption,
} from './locker-utils';

export function LockersPanel({ kind }: { kind: LockerKind }) {
  const [lockers, setLockers] = useState<LockerRow[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sheet
  const [selectedLockerId, setSelectedLockerId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // New/edit locker dialog
  const [isLockerDialogOpen, setIsLockerDialogOpen] = useState(false);
  const [editingLocker, setEditingLocker] = useState<LockerRow | null>(null);

  // Kind-specific dialogs: CSV import (uniforme) / range creation (vestiario)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { lockers: lockersData, employees } = await fetchLockersData(kind);
      setLockers(lockersData);
      setActiveEmployees(employees);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

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

  // ----- Sheet handlers -----

  const openSheet = (locker: LockerRow) => {
    setSelectedLockerId(locker.id);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setSelectedLockerId(null);
    }
  };

  // ----- New/Edit locker dialog -----

  const openNewLockerDialog = () => {
    setEditingLocker(null);
    setIsLockerDialogOpen(true);
  };

  const openEditLockerDialog = (locker: LockerRow) => {
    setEditingLocker(locker);
    setIsLockerDialogOpen(true);
  };

  const handleLockerDialogOpenChange = (open: boolean) => {
    setIsLockerDialogOpen(open);
    if (!open) {
      setEditingLocker(null);
    }
  };

  if (isLoading) {
    return <PageLoading label="Carregando armários..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {kind === 'uniforme' ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4" /> Importar planilha
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsRangeDialogOpen(true)}>
            <ListPlus className="h-4 w-4" /> Criar por faixa
          </Button>
        )}
        <Button type="button" size="sm" onClick={openNewLockerDialog}>
          <Plus className="h-4 w-4" /> Novo armário
        </Button>
      </div>

      <LockerGrid
        kind={kind}
        lockers={lockers}
        withoutLockerCount={employeesWithoutLocker.length}
        onSelectLocker={openSheet}
      />

      <LockerSheet
        kind={kind}
        locker={selectedLocker}
        open={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
        employeesWithoutLocker={employeesWithoutLocker}
        onChanged={fetchData}
        onEditRequest={openEditLockerDialog}
      />

      <LockerFormDialog
        kind={kind}
        open={isLockerDialogOpen}
        onOpenChange={handleLockerDialogOpenChange}
        editingLocker={editingLocker}
        onSaved={fetchData}
      />

      {kind === 'uniforme' ? (
        <LockersCsvImportDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          lockers={lockers}
          onImported={fetchData}
        />
      ) : (
        <LockerRangeDialog
          kind={kind}
          open={isRangeDialogOpen}
          onOpenChange={setIsRangeDialogOpen}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
