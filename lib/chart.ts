import type { CSSProperties } from 'react';

/**
 * Shared Recharts conventions, aligned to DESIGN.md's Carbon data-viz tokens
 * (V1, locked). Centralized here so the new charts built in the dashboard-home
 * phase inherit the right axis/grid/tick/palette conventions instead of each
 * screen re-deriving its own — the exact failure mode this file exists to
 * prevent (plan Etapa 4).
 *
 * Rules baked into these exports (do not violate at a call site):
 * - Never wire the interactive primary/brand token into chart data code
 *   (IBM Blue #0f62fe). It's reserved for interactive elements; a chart
 *   series in that color would collide with that meaning (V1).
 * - Single-series charts use CHART_SERIES_COLORS[0] (purple-70). Dual-series
 *   (e.g. Consumo vs Compras) use CHART_SERIES_COLORS[0] and [1]. The 5-color
 *   order is locked and must never be reordered.
 * - Ranking by magnitude (top-N lists) is ordinal, not categorical — use
 *   getSequentialRampColor() for a monochrome ramp, not N distinct hues.
 * - State (price increase/decrease, severity) uses ALERT_PALETTE, not the
 *   categorical series palette.
 */

/** Official Carbon data-viz series palette (--chart-1..5 in globals.css),
 * purple-70/cyan-50/teal-70/magenta-70/red-50, in this exact order (V1).
 * Deliberately excludes #0f62fe so a data series never reads as the
 * interactive/brand accent. */
export const CHART_SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** Single-series charts (e.g. one bar/line per category): purple-70. */
export const CHART_SINGLE_SERIES_COLOR = CHART_SERIES_COLORS[0];

/** Dual-series charts (e.g. Consumo vs Compras): purple-70 + cyan-50. */
export const CHART_DUAL_SERIES_COLORS: readonly [string, string] = [
  CHART_SERIES_COLORS[0],
  CHART_SERIES_COLORS[1],
];

/**
 * Sequential ramp for ordinal ranking (top-N by magnitude): a monochrome tint
 * of purple-70 that lightens toward the tail of the list, instead of N
 * categorical hues (which would wrongly imply the items are different kinds
 * of thing rather than different magnitudes of the same thing).
 *
 * `rank` is 0-indexed (0 = largest/most prominent). Derived at call time via
 * color-mix from the single --chart-1 token — no new hex is introduced.
 */
export function getSequentialRampColor(rank: number, total: number): string {
  if (total <= 1) return CHART_SINGLE_SERIES_COLOR;
  const clampedRank = Math.min(Math.max(rank, 0), total - 1);
  const t = clampedRank / (total - 1); // 0 (first) .. 1 (last)
  const whiteMix = 12 + t * 68; // keeps rank 0 near-solid, tail fades toward canvas
  return `color-mix(in oklab, ${CHART_SINGLE_SERIES_COLOR} ${100 - whiteMix}%, white ${whiteMix}%)`;
}

/**
 * State palette for alta/queda de preço and severity-style indicators (V1),
 * pulled from @carbon/colors: red-60, orange-40, yellow-30, green-60. Distinct
 * from the app's AA-contrast-adjusted --destructive/--warning/--success
 * tokens (those are tuned for solid-fill-plus-text legibility); this palette
 * is for chart marks/legends, always paired with a label, matching Carbon's
 * own alert-level convention exactly.
 */
export const ALERT_PALETTE = {
  increase: 'var(--destructive)', // red-60 #da1e28 — matches --destructive exactly
  moderate: 'var(--chart-alert-orange)', // orange-40 #ff832b
  mild: 'var(--chart-alert-yellow)', // yellow-30 #f1c21b
  decrease: 'var(--success)', // green-60 #198038 — matches --success exactly
} as const;

/** Shared CartesianGrid props: hairline grid, matches the surrounding UI
 * hairline (--border resolves to #e0e0e0 on the White theme) instead of the
 * near-black stroke the old dark theme used (E.5). Spread onto
 * `<CartesianGrid {...CHART_GRID_PROPS} />`; add `vertical`/`horizontal` at
 * the call site as needed. */
export const CHART_GRID_PROPS = {
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
} as const;

/** Shared axis tick style: 11px, --muted-foreground. Spread and override
 * fontWeight/fontSize at the call site as needed. Deliberately not typed as
 * `CSSProperties` — Recharts' `tick` prop expects a narrower SVG-text-props
 * shape, and a couple of CSSProperties fields (e.g. `alignmentBaseline`)
 * aren't assignable to it. */
export const CHART_AXIS_TICK_STYLE: { fontSize: number; fontWeight?: number; fill: string } = {
  fontSize: 11,
  fill: 'var(--muted-foreground)',
};

/** Recharts `<Tooltip cursor={...}>` fill for bar/area hover feedback. Using
 * --muted (#f4f4f4) here reads as almost invisible against the white canvas
 * (E.5) — --accent is the app's one "solid hover highlight, no alpha" token
 * (#e8e8e8), already used for every other hover affordance, so it reads
 * clearly here too. */
export const CHART_CURSOR_FILL = 'var(--accent)';

/** Shared Recharts tooltip surface, aligned to the DESIGN.md token layer.
 * White-on-white (E.5): the hairline border alone was too faint once the
 * canvas and the popover became the same color, so this adds the one
 * shadow DESIGN.md explicitly permits outside marketing surfaces — product
 * elevation for a floating panel. */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: '0px',
  border: '1px solid var(--border)',
  boxShadow: '0 2px 8px rgba(22, 22, 22, 0.16)',
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  fontSize: '12px',
  letterSpacing: '0.32px', // Carbon caption tracking (DESIGN.md {typography.caption})
  fontFamily: 'var(--font-sans)', // explicit: Recharts renders the tooltip outside the app's font-sans flow in some cases
};
