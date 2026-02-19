import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageContainerVariant = 'data-dense' | 'form-centric';

const variantClasses: Record<PageContainerVariant, string> = {
  'data-dense': 'max-w-[1700px]',
  'form-centric': 'max-w-[1000px]',
};

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  variant?: PageContainerVariant;
}

export function PageContainer({
  children,
  className,
  variant = 'data-dense',
}: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-6 py-2 pb-10 space-y-4', variantClasses[variant], className)}>
      {children}
    </div>
  );
}
