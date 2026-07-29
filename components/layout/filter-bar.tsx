import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FilterBarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

interface FilterBarProps {
  /**
   * The rest of the filter row: Selects, Tabs, whatever the screen needs.
   * Each child controls its own responsive width (e.g. `w-full sm:w-[200px]`)
   * exactly as it did before extraction — FilterBar only owns the shared
   * chrome (hairline card + flex-wrap row), not the individual controls.
   *
   * To add a second visual row (e.g. price-variation's date range, or
   * movements' month/year/category row), wrap that group in its own
   * `<div className="w-full ...">`: a full-width flex child always starts a
   * new line inside a flex-wrap row, so no separate "secondary row" prop is
   * needed for the two screens that use one.
   */
  children?: ReactNode;
  className?: string;
  /** Renders the shared search-input-with-icon slot, identical across all 6
   * source screens. Omit to compose search manually via children (no screen
   * needs this today, kept optional for a future filter bar with no search). */
  search?: FilterBarSearchProps;
}

/**
 * Shared filter-bar shell, extracted from 6 screens that had the exact same
 * `border border-border bg-card p-*` container + search-Input-with-icon
 * markup copy-pasted verbatim (employees, movements, products,
 * price-variation, replenishment-queue, lockers/locker-grid) — see plan
 * Etapa 5b. Only the container chrome and the repeated search slot are
 * modeled here; each screen still owns its own Selects/Tabs/extra rows as
 * children, since those genuinely differ site to site.
 */
export function FilterBar({ children, className, search }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 border border-border bg-card p-3', className)}>
      {search ? (
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={search.placeholder}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            className={cn('h-10 border-border pl-9 text-sm', search.className)}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
