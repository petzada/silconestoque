'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';
import { Plus, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { LockerGrid } from '@/components/lockers/locker-grid';
import { LockerSheet } from '@/components/lockers/locker-sheet';
import { LockerFormDialog } from '@/components/lockers/locker-form-dialog';
import { LockerRangeDialog } from '@/components/lockers/locker-range-dialog';
import {
  getActiveAssignment,
  fetchLockersData,
  type LockerRow,
  type EmployeeOption,
} from '@/components/lockers/locker-utils';

export default function VestiarioPage() {
  const [lockers, setLockers] = useState<LockerRow[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sheet
  const [selectedLockerId, setSelectedLockerId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // New/edit locker dialog
  const [isLockerDialogOpen, setIsLockerDialogOpen] = useState(false);
  const [editingLocker, setEditingLocker] = useState<LockerRow | null>(null);

  // Range creation dialog
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { lockers: lockersData, employees } = await fetchLockersData('vestiario');
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
    return <div className="py-20 text-center font-medium text-muted-foreground">Carregando armários...</div>;
  }

  return (
    <PageContainer>
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Vestiário</h1>
          <p className="text-sm text-muted-foreground">Controle de armários do vestiário por colaborador</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsRangeDialogOpen(true)}>
            <ListPlus className="h-4 w-4" /> Criar por faixa
          </Button>
          <Button type="button" size="sm" onClick={openNewLockerDialog}>
            <Plus className="h-4 w-4" /> Novo armário
          </Button>
        </div>
      </div>

      <LockerGrid
        kind="vestiario"
        lockers={lockers}
        withoutLockerCount={employeesWithoutLocker.length}
        onSelectLocker={openSheet}
      />

      <LockerSheet
        kind="vestiario"
        locker={selectedLocker}
        open={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
        employeesWithoutLocker={employeesWithoutLocker}
        onChanged={fetchData}
        onEditRequest={openEditLockerDialog}
      />

      <LockerFormDialog
        kind="vestiario"
        open={isLockerDialogOpen}
        onOpenChange={handleLockerDialogOpenChange}
        editingLocker={editingLocker}
        onSaved={fetchData}
      />

      <LockerRangeDialog
        kind="vestiario"
        open={isRangeDialogOpen}
        onOpenChange={setIsRangeDialogOpen}
        onCreated={fetchData}
      />
    </PageContainer>
  );
}
