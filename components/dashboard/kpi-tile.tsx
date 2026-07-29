import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Delta } from '@/lib/format';

type KpiTone = 'neutral' | 'danger' | 'warning';

interface KpiTileProps {
  label: string;
  /** Já formatado pelo chamador (moeda, inteiro, percentual). */
  value: string;
  /** Comparativo com o período anterior equivalente. `null` = sem base. */
  delta?: Delta;
  /** Explicação curta abaixo do valor. Uma linha, sem prosa. */
  note?: string;
  /**
   * Cor do número. `neutral` é o padrão e o certo para quase tudo: a
   * hierarquia em Carbon vem do tamanho, não da cor, e o azul de marca é
   * escasso por definição (nunca entra aqui). `danger`/`warning` só quando o
   * número sinaliza alarme de forma inequívoca — contagem de itens zerados,
   * pedido em atraso. Consumo alto não é alarme: gastar mais não é
   * automaticamente ruim, e pintar de vermelho seria opinião disfarçada de
   * dado.
   */
  tone?: KpiTone;
}

const TONE_CLASS: Record<KpiTone, string> = {
  neutral: 'text-foreground',
  danger: 'text-destructive',
  warning: 'text-warning',
};

export function KpiTile({ label, value, delta, note, tone = 'neutral' }: KpiTileProps) {
  return (
    <div className="flex flex-col gap-1 border border-border bg-card p-4">
      <p className="text-caption text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-stat-display text-3xl', TONE_CLASS[tone])}>{value}</p>
      {delta ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {delta.direction === 'up' ? (
            <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
          )}
          <span>
            {delta.percent.toFixed(1).replace('.', ',')}% vs. período anterior
          </span>
        </p>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
