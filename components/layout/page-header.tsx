import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-between gap-4 md:flex-row md:items-center',
        className
      )}
    >
      <div>
        {/* Carbon card-title (DESIGN.md): 24px/weight 400 — not .text-display
            (weight 300, reserved for the display-* sizes this app doesn't
            use). Page titles are the largest heading in the app. */}
        <h1 className="text-2xl font-normal text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
