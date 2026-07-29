interface PageLoadingProps {
  label: string;
}

export function PageLoading({ label }: PageLoadingProps) {
  return (
    <div
      className="mx-auto w-full max-w-[1700px] space-y-4 px-6 py-2 pb-10"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse bg-card" />
        <div className="h-4 w-72 animate-pulse bg-card" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse border border-border bg-card" />
        ))}
      </div>
      <div className="overflow-hidden border border-border bg-card">
        <div className="h-11 animate-pulse border-b border-border bg-surface-soft" />
        <div className="space-y-0 p-0">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="border-b border-border/60 px-4 py-3 last:border-0">
              <div className="h-4 w-full max-w-[60%] animate-pulse bg-surface-soft" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
