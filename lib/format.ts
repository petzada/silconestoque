/**
 * Formatadores compartilhados da home do dashboard.
 *
 * `formatCurrency` existe hoje duplicado localmente em várias telas (produtos,
 * movimentações, variação de preço, sugestões de compra). Esta é a versão
 * compartilhada, usada pelo código novo; as cópias locais das telas antigas
 * não foram tocadas para manter o refactor visual e a home nova em escopos
 * separados — unificá-las é item de backlog.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const INT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const DEC1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Dado ausente vira travessão, nunca R$ 0,00. Zero afirma "não houve valor";
 * travessão afirma "não se aplica a este recorte" — e a diferença importa: o
 * RPC devolve NULL em Compras quando há filtro de setor ativo, porque Entradas
 * não carregam setor. Ver migration_fase3_analitico.sql, seção 3.2.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return BRL.format(value);
}

/** Versão compacta para eixo de gráfico, onde o valor cheio não caberia. */
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return BRL_COMPACT.format(value);
}

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return INT.format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${fractionDigits === 0 ? INT.format(value) : DEC1.format(value)}%`;
}

/** Dias de cobertura. NULL do RPC significa cobertura infinita (produto sem
 * consumo nos últimos 90 dias), não zero — rotular como "0 dias" inverteria
 * completamente o sentido, transformando "não sai" em "acaba amanhã". */
export function formatCoberturaDias(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Sem consumo';
  if (value < 1) return 'menos de 1 dia';
  return `${DEC1.format(value)} ${value >= 2 ? 'dias' : 'dia'}`;
}

export type Delta = {
  /** Variação percentual em relação ao período anterior. */
  percent: number;
  direction: 'up' | 'down';
} | null;

/**
 * Delta contra o período anterior equivalente, que os RPCs já devolvem lado a
 * lado (por isso não há segunda chamada).
 *
 * Devolve `null` quando não há base de comparação: período anterior zerado, ou
 * qualquer um dos lados ausente. Exibir "+100%" contra uma base de zero seria
 * um número inventado — a ausência de base é informação, e a UI mostra isso
 * como "sem base de comparação".
 */
export function computeDelta(atual: number | null, anterior: number | null): Delta {
  if (atual === null || atual === undefined) return null;
  if (anterior === null || anterior === undefined || anterior === 0) return null;
  const percent = ((atual - anterior) / Math.abs(anterior)) * 100;
  if (!Number.isFinite(percent)) return null;
  return { percent: Math.abs(percent), direction: percent >= 0 ? 'up' : 'down' };
}

/** Rótulo curto de data para eixo de série diária (dd/MM). */
export function formatDayShort(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  if (!month || !day) return isoDate;
  return `${day}/${month}`;
}
