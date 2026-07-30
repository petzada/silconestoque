'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';
type ColumnAlignment = 'left' | 'center' | 'right';
type AccessorValue = string | number | boolean | Date | null | undefined;

// Carbon data-table row heights. "short" (32px row / 48px header) is the
// documented spec for listings (plan §1, "o que não se aplica"); "compact"
// (24px row / 40px header) is Carbon's next step down for denser listings.
// Default is "short" so existing call sites don't change unless they opt in.
export type DataTableDensity = 'short' | 'compact';

const DENSITY_ROW_CLASS: Record<DataTableDensity, string> = {
  short: 'h-8',
  compact: 'h-6',
};

const DENSITY_HEADER_CLASS: Record<DataTableDensity, string> = {
  short: 'h-12',
  compact: 'h-10',
};

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  accessor?: (row: T) => AccessorValue;
  align?: ColumnAlignment;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  defaultSort?: {
    key: string;
    direction: SortDirection;
  };
  pageSizeOptions?: number[];
  initialPageSize?: number;
  stickyHeader?: boolean;
  density?: DataTableDensity;
  className?: string;
}

function compareAccessorValues(a: AccessorValue, b: AccessorValue) {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function getAlignmentClassName(align: ColumnAlignment = 'left') {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export function TruncatedCell({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const content = value?.trim() ? value : '---';
  return (
    <span className={cn('block truncate', className)} title={content}>
      {content}
    </span>
  );
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  emptyMessage,
  defaultSort,
  pageSizeOptions = [10, 25, 50],
  initialPageSize = 25,
  stickyHeader = true,
  density = 'short',
  className,
}: DataTableProps<T>) {
  const firstSortableKey = columns.find((column) => column.sortable)?.key;
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? firstSortableKey ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction ?? 'asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    const column = columns.find((item) => item.key === sortKey);
    if (!column) return data;

    const accessor =
      column.accessor ??
      ((row: T) => (row as Record<string, AccessorValue>)[sortKey] as AccessorValue);

    const directionFactor = sortDirection === 'asc' ? 1 : -1;
    return [...data].sort((left, right) => {
      const result = compareAccessorValues(accessor(left), accessor(right));
      return result * directionFactor;
    });
  }, [columns, data, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));

  // Página efetiva, derivada no render em vez de corrigida por um effect.
  //
  // Quando um filtro encolhe a lista, a página guardada pode deixar de existir.
  // Antes isso era corrigido com `setPage` dentro de um `useEffect`, o que
  // dispara um render em cascata — e, no frame entre o primeiro render e a
  // correção, a tabela aparecia vazia. Derivar o valor resolve os dois: não há
  // segundo render e nunca existe um estado intermediário inválido. O estado
  // guardado continua sendo a intenção do usuário; `currentPage` é o que essa
  // intenção significa para os dados que existem agora.
  const currentPage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedData]);

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;

    if (sortKey !== column.key) {
      setSortKey(column.key);
      setSortDirection('asc');
      return;
    }

    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const renderSortIcon = (column: DataTableColumn<T>) => {
    if (!column.sortable) return null;
    // Sem alpha: e o unico indicio de que a coluna e ordenavel, entao precisa
    // ser legivel. --muted-foreground a 60% sobre branco cai para ~#999.
    if (sortKey !== column.key) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-foreground" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-foreground" />
    );
  };

  return (
    <div className={cn('overflow-hidden border border-border bg-card', className)}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold text-muted-foreground">
          {sortedData.length} {sortedData.length === 1 ? 'registro' : 'registros'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="table-page-size">
            Linhas
          </label>
          <select
            id="table-page-size"
            className="h-8 border border-border bg-card px-2 text-xs font-semibold text-foreground"
            value={pageSize}
            onChange={(event) => {
              setPage(1);
              setPageSize(Number(event.target.value));
            }}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs font-semibold"
            // Navega a partir da página EFETIVA, não da guardada: se a lista
            // encolheu, "Anterior" precisa recuar em relação ao que está na
            // tela, senão o primeiro clique parece não fazer nada.
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            Anterior
          </Button>
          <span className="min-w-[90px] text-center text-xs font-semibold text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs font-semibold"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Proxima
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader className={cn('bg-muted', stickyHeader && 'sticky top-0 z-10')}>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  // Carbon data-table header: 48px (short) row, 14px/600,
                  // sentence case — h-11 (44px) and uppercase/tracking removed.
                  DENSITY_HEADER_CLASS[density],
                  'px-4 text-sm font-semibold text-muted-foreground',
                  getAlignmentClassName(column.align),
                  column.headerClassName
                )}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className={cn(
                      // Carbon focus: inset 2px ring, not an outset ring/border (E.4).
                      'inline-flex items-center gap-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]',
                      column.align === 'right' && 'ml-auto'
                    )}
                    onClick={() => handleSort(column)}
                    aria-label={`Ordenar por ${column.header.toLowerCase()}`}
                  >
                    <span>{column.header}</span>
                    {renderSortIcon(column)}
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.length === 0 ? (
            <TableRow className="border-border">
              <TableCell
                className="px-4 py-10 text-center text-sm font-medium text-muted-foreground"
                colSpan={columns.length}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            paginatedData.map((row) => (
              <TableRow key={rowKey(row)} className="group border-border hover:bg-accent">
                {columns.map((column) => (
                  <TableCell
                    key={`${rowKey(row)}-${column.key}`}
                    className={cn(
                      // Carbon data-table cell: 14px/400, row height per density.
                      DENSITY_ROW_CLASS[density],
                      'px-4 align-middle text-sm font-normal text-foreground',
                      getAlignmentClassName(column.align),
                      column.cellClassName
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
