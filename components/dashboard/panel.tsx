import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  title: string;
  /** Uma linha. Serve para dizer o recorte do dado, não para explicar o óbvio. */
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Contêiner de gráfico/lista. Branco com hairline 1px e raio 0: em Carbon a
 * separação vem da hairline, não de sombra nem de troca de luminância — card
 * branco sem borda desapareceria sobre o canvas branco.
 */
export function Panel({ title, description, children, className }: PanelProps) {
  return (
    <section className={cn('flex flex-col border border-border bg-card', className)}>
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm text-foreground">{title}</h2>
        {description ? (
          <p className="text-caption text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

/**
 * Estado vazio no padrão Carbon: bloco de texto centrado. Sem card aninhado,
 * sem borda tracejada, sem ícone gigante em opacidade baixa — o `Panel` que o
 * envolve já fornece a moldura, e repetir moldura dentro de moldura é o
 * anti-padrão que a etapa 8 do refactor removeu do app.
 */
export function PanelEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <p className="text-base text-foreground">{title}</p>
      {hint ? <p className="max-w-[46ch] text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
