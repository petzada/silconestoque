import { format } from 'date-fns';
import { supabase, fetchAllRows } from '@/lib/supabase';
import { getDbErrorMessage, isPostgrestLikeError } from '@/lib/db-error';
import type { Employee, Locker, LockerKind, Department, Role } from '@/lib/types';

// ---------- Types ----------

export type AssignmentEmployee = Pick<Employee, 'id' | 'full_name'> & {
  department?: Pick<Department, 'name'> | null;
  role?: Pick<Role, 'name'> | null;
};

export type ActiveAssignmentJoin = {
  id: string;
  started_at: string;
  employee: AssignmentEmployee | null;
};

export type LockerRow = Locker & { locker_assignments?: ActiveAssignmentJoin[] | null };

export type EmployeeOption = Pick<Employee, 'id' | 'full_name'> & {
  department?: Pick<Department, 'name'> | null;
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
  // 23505 (unique_violation) cobre três índices distintos aqui — só o texto
  // da violação (que carrega o nome da constraint) permite diferenciá-los;
  // o código sozinho não basta. P0001 (RAISE EXCEPTION de
  // transfer_locker_assignment, ex.: "Ocupação não encontrada ou já
  // encerrada") cai no fallback genérico do helper, que propaga a mensagem
  // do banco como está.
  if (isPostgrestLikeError(error) && error.code === '23505' && typeof error.message === 'string') {
    if (error.message.includes('uniq_active_assignment_per_locker')) {
      return 'Este armário acabou de ser ocupado.';
    }
    if (error.message.includes('uniq_active_assignment_per_employee_kind')) {
      return 'Este colaborador já possui um armário.';
    }
    if (error.message.includes('uniq_lockers_kind_number')) {
      return 'Já existe um armário com esse número.';
    }
  }
  return getDbErrorMessage(error, fallback);
}

// ---------- Data fetching ----------

export async function fetchLockersData(
  kind: LockerKind
): Promise<{ lockers: LockerRow[]; employees: EmployeeOption[] }> {
  // fetchAllRows: acima do teto do PostgREST (1000 linhas), a lista de
  // colaboradores ativos alimenta a checagem de "já tem armário" na
  // atribuição/transferência — cega além do teto, ela deixaria de barrar
  // duplicidade e de listar todo mundo disponível no combobox.
  const [lockersRes, employeesRes] = await Promise.all([
    fetchAllRows<LockerRow>(() =>
      supabase
        .from('lockers')
        .select(
          '*, locker_assignments!left(id, started_at, ended_at, employee:employees(id, full_name, department:departments(name), role:roles(name)))'
        )
        .eq('kind', kind)
        .is('locker_assignments.ended_at', null)
        .order('number')
        .order('id', { ascending: true })
    ),
    fetchAllRows(() =>
      supabase
        .from('employees')
        .select('id, full_name, department:departments(name), role:roles(name)')
        .eq('is_active', true)
        .order('full_name')
        .order('id', { ascending: true })
    ),
  ]);

  if (lockersRes.error) throw lockersRes.error;
  if (employeesRes.error) throw employeesRes.error;

  return {
    lockers: (lockersRes.data as unknown as LockerRow[]) || [],
    employees: (employeesRes.data as unknown as EmployeeOption[]) || [],
  };
}
