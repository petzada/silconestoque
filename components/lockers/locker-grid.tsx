'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FilterBar } from '@/components/layout/filter-bar';
import { cn } from '@/lib/utils';
import type { LockerKind } from '@/lib/types';
import { LOCKER_SIZES } from '@/lib/types';
import { getActiveAssignment, getLockerStatus, type LockerRow, type LockerStatus } from './locker-utils';

interface LockerGridProps {
  kind: LockerKind;
  lockers: LockerRow[];
  withoutLockerCount: number;
  onSelectLocker: (locker: LockerRow) => void;
}

export function LockerGrid({ kind, lockers, withoutLockerCount, onSelectLocker }: LockerGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSize, setFilterSize] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | LockerStatus>('all');

  const summary = useMemo(() => {
    const total = lockers.length;
    const occupied = lockers.filter((locker) => getLockerStatus(locker) === 'occupied').length;
    const free = lockers.filter((locker) => getLockerStatus(locker) === 'free').length;
    return { total, occupied, free, withoutLocker: withoutLockerCount };
  }, [lockers, withoutLockerCount]);

  const filteredLockers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return lockers
      .filter((locker) => {
        const assignment = getActiveAssignment(locker);
        const matchesSearch =
          !normalizedSearch ||
          String(locker.number).includes(normalizedSearch) ||
          assignment?.employee?.full_name.toLowerCase().includes(normalizedSearch);
        const matchesSize = kind !== 'uniforme' || filterSize === 'all' || locker.size === filterSize;
        const matchesStatus = filterStatus === 'all' || getLockerStatus(locker) === filterStatus;
        return matchesSearch && matchesSize && matchesStatus;
      })
      .sort((a, b) => a.number - b.number);
  }, [lockers, searchTerm, filterSize, filterStatus, kind]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 px-4">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-stat-display text-3xl">{summary.total}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 px-4">
            <span className="text-xs text-muted-foreground">Ocupados</span>
            <span className="text-stat-display text-3xl">{summary.occupied}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 px-4">
            <span className="text-xs text-muted-foreground">Livres</span>
            <span className="text-stat-display text-3xl">{summary.free}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 px-4">
            <span className="text-xs text-muted-foreground">
              {kind === 'uniforme' ? 'Sem armário' : 'Sem vestiário'}
            </span>
            <span className="text-stat-display text-3xl">{summary.withoutLocker}</span>
          </CardContent>
        </Card>
      </div>

      <FilterBar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: 'Buscar por número ou colaborador...',
        }}
      >
        {kind === 'uniforme' && (
          <Select value={filterSize} onValueChange={setFilterSize}>
            <SelectTrigger className="h-10 w-full border-border text-sm sm:w-[140px]">
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
        )}
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
          <SelectTrigger className="h-10 w-full border-border text-sm sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="occupied">Ocupado</SelectItem>
            <SelectItem value="free">Livre</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {filteredLockers.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
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
                onClick={() => onSelectLocker(locker)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 border p-3 text-center transition-colors',
                  // Occupied uses the info surface (pale blue, static) instead
                  // of the old primary-tinted alpha fill — IBM Blue stays
                  // scarce (V2/V6) and this isn't an interactive element.
                  // Hover reuses --accent, the one universal solid hover
                  // token, same as every other hoverable surface in the app.
                  status === 'occupied' && 'border-info bg-info-muted hover:bg-accent',
                  // Free lockers used a dashed border to read as "empty slot";
                  // Etapa 2 (V12) reserves dashed/2px for focus and error, so
                  // this becomes a plain hairline like every other card.
                  status === 'free' && 'border-border bg-card hover:bg-accent',
                  status === 'inactive' && 'border-border bg-muted opacity-50 hover:opacity-70'
                )}
              >
                <span className={cn('text-xl font-bold', status === 'occupied' ? 'text-info' : 'text-foreground')}>
                  {String(locker.number).padStart(2, '0')}
                </span>
                {kind === 'uniforme' && (
                  <Badge variant="outline" className="text-[10px]">
                    {locker.size}
                  </Badge>
                )}
                <span className="line-clamp-1 max-w-full text-[11px] font-medium text-muted-foreground">
                  {status === 'inactive' ? 'Inativo' : assignment?.employee?.full_name || 'Livre'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
