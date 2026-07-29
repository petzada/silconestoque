import { cn } from '@/lib/utils';

/**
 * Skeleton no padrão Carbon: retângulo `--surface-elevated` (#e0e0e0) sobre o
 * canvas, raio 0, pulso sutil de opacidade.
 *
 * Usa `bg-surface-elevated` de propósito, e não `bg-card`: card resolve para
 * #ffffff no tema branco, ou seja, um placeholder invisível sobre o canvas —
 * exatamente a regressão silenciosa que a migração dark → claro produziu em
 * `page-loading.tsx` e foi corrigida na etapa 8 do refactor.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse bg-surface-elevated', className)}
      {...props}
    />
  );
}

export { Skeleton };
