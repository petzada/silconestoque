'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/components/auth-provider';

// Force Deployment Update (Build Verified)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-pulse text-slate-500">Carregando...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
