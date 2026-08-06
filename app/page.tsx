'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

export default function Home() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isLoggedIn ? '/dashboard' : '/login');
  }, [isLoggedIn, isLoading, router]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label="Carregando"
    >
      <div className="h-10 w-40 animate-pulse border border-border bg-surface-elevated" />
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
