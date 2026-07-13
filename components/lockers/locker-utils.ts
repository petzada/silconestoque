import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Employee, Locker, LockerKind, Sector, Role } from '@/lib/types';

// ---------- Types ----------

export type AssignmentEmployee = Pick<Employee, 'id' | 'full_name'> & {
  sector?: Pick<Sector, 'name'> | null;
  role?: Pick<Role, 'name'> | null;
};

export type ActiveAssignmentJoin = {
  id: string;
  started_at: string;
  employee: AssignmentEmployee | null;
};

export type LockerRow = Locker & { locker_assignments?: ActiveAssignmentJoin[] | null };

export type EmployeeOption = Pick<Employee, 'id' | 'full_name'> & {
  sector?: Pick<Sector, 'name'> | null;
  role?: Pick<Role, 'name'> | null;
};

export type HistoryEntry = {
  id: string;
  started_at: string;
  ended_at: string | null;
  employee: { full_name: string } | null;
};

export type LockerStatus = 'occupied' | 'free' | 'inactive';

// ---------- Helpers ----------

export function getActiveAssignment(locker: LockerRow): ActiveAssignmentJoin | null {
  return locker.locker_assignments?.[0] ?? null;
}

export function getLockerStatus(locker: LockerRow): LockerStatus {
  if (!locker.is_active) return 'inactive';
  return getActiveAssignment(locker) ? 'occupied' : 'free';
}

export function formatDateTime(value: string): string {
  return format(new Date(value), 'dd/MM/yyyy HH:mm');
}

export function friendlyDbError(error: unknown, fallback: string): string {
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

// ---------- Data fetching ----------

export async function fetchLockersData(
  kind: LockerKind
): Promise<{ lockers: LockerRow[]; employees: EmployeeOption[] }> {
  const [lockersRes, employeesRes] = await Promise.all([
    supabase
      .from('lockers')
      .select(
        '*, locker_assignments!left(id, started_at, ended_at, employee:employees(id, full_name, sector:sectors(name), role:roles(name)))'
      )
      .eq('kind', kind)
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

  return {
    lockers: (lockersRes.data as unknown as LockerRow[]) || [],
    employees: (employeesRes.data as unknown as EmployeeOption[]) || [],
  };
}
