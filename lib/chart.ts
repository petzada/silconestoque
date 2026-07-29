import type { CSSProperties } from 'react';

/** Shared recharts tooltip surface, aligned to the DESIGN.md token layer. */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: '0px',
  border: '1px solid var(--border)',
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  fontSize: '12px',
  letterSpacing: '0.32px', // Carbon caption tracking (DESIGN.md {typography.caption})
  fontFamily: 'var(--font-sans)', // explicit: Recharts renders the tooltip outside the app's font-sans flow in some cases
};
