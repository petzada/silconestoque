'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/components/auth-provider';
import { PageLoading } from '@/components/layout/page-loading';

// Force Deployment Update (Build Verified)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  if (isLoading) {
    return <PageLoading label="Carregando..." />;
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((prev) => !prev)} />
      <main className={`min-h-screen transition-all duration-300 ${collapsed ? 'ml-0' : 'lg:ml-64'}`}>
        <div className="py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
