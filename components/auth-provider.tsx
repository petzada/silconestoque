'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  isLoggedIn: boolean;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setIsLoggedIn(!!session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Guarda client-side complementar ao middleware (evita flash de conteúdo).
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn && pathname !== '/login') {
      router.replace('/login');
    } else if (isLoggedIn && pathname === '/login') {
      router.replace('/dashboard');
    }
  }, [isLoggedIn, isLoading, pathname, router]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Mesmo com falha de rede, limpa o estado local e manda para o login.
    } finally {
      setIsLoggedIn(false);
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
