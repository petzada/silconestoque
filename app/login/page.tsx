'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, AlertCircle } from 'lucide-react';

const FALLBACK_PASSWORD = process.env.NEXT_PUBLIC_FALLBACK_PASSWORD || '';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error: dbError } = await supabase
        .from('config')
        .select('access_password')
        .single();

      if (dbError) {
        if (FALLBACK_PASSWORD && password === FALLBACK_PASSWORD) {
          login();
          return;
        }
        throw new Error('Erro ao verificar credenciais');
      }

      if (data && data.access_password === password) {
        login();
      } else {
        setError('Senha incorreta. Tente novamente.');
      }
    } catch {
      if (FALLBACK_PASSWORD && password === FALLBACK_PASSWORD) {
        login();
      } else {
        setError('Senha incorreta. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-primary p-4">
      <Card className="w-full max-w-md shadow-2xl bg-white/95 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden bg-slate-50">
            <Image src="/logo.png" alt="Silcon Logo" width={64} height={64} className="object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-brand-primary font-inter">
              Silcon Ambiental
            </CardTitle>
            <CardDescription className="text-slate-500 font-inter">
              Sistema de Gestão de Estoque
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-inter">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-inter">
                Senha de Acesso
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite a senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 font-inter focus-visible:ring-brand-primary"
                  autoFocus
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-primary hover:bg-brand-primary-hover font-inter"
              disabled={isLoading}
            >
              {isLoading ? 'Verificando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
