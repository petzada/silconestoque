'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, setAuthCookie, removeAuthCookie } from '@/lib/auth';

interface AuthContextType {
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Rotas públicas que dispensam login (ex.: quiz divulgado aos colaboradores).
const PUBLIC_PATHS = ['/login', '/quiz-seguranca'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated();
      setIsLoggedIn(authenticated);
      setIsLoading(false);

      // Redirect logic
      if (!authenticated && !isPublicPath(pathname)) {
        router.push('/login');
      } else if (authenticated && pathname === '/login') {
        router.push('/dashboard');
      }
    };

    checkAuth();
  }, [pathname, router]);

  const login = () => {
    setAuthCookie();
    setIsLoggedIn(true);
    router.push('/dashboard');
  };

  const logout = () => {
    removeAuthCookie();
    setIsLoggedIn(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout, isLoading }}>
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
