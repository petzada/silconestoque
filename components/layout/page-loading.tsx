interface PageLoadingProps {
  label: string;
}

// Mirrors PageContainer's max-width/gutters (1584px, px-8) and DataTable's
// real dimensions (h-12 header, h-8 rows — see components/ui/data-table.tsx
// DENSITY_HEADER_CLASS/DENSITY_ROW_CLASS) so the skeleton doesn't desync from
// the content it stands in for.
export function PageLoading({ label }: PageLoadingProps) {
  return (
    <div
      className="mx-auto w-full max-w-[1584px] space-y-4 px-8 py-2 pb-10"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse bg-surface-elevated" />
        <div className="h-4 w-72 animate-pulse bg-surface-elevated" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse border border-border bg-surface-elevated" />
        ))}
      </div>
      <div className="overflow-hidden border border-border bg-card">
        <div className="h-12 border-b border-border bg-surface-soft" />
        <div className="space-y-0 p-0">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex h-8 items-center border-b border-border px-4 last:border-0">
              <div className="h-4 w-full max-w-[60%] animate-pulse bg-surface-elevated" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
