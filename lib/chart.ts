import type { CSSProperties } from 'react';

/** Shared recharts tooltip surface, aligned to the DESIGN.md token layer. */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: '12px',
  border: '1px solid var(--border)',
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  fontSize: '12px',
};
