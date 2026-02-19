'use client';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Database, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';

export default function SettingsPage() {
  return (
    <PageContainer variant="form-centric" className="space-y-6 pt-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Configuracoes</h1>
      </div>

      <div className="grid gap-6">
        <Card className="overflow-hidden rounded-xl border-none bg-white shadow-sm">
          <CardHeader className="bg-slate-50/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <Database className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Integridade de Dados</CardTitle>
                <CardDescription className="text-xs">
                  Estoque e custo sao controlados automaticamente pelas movimentacoes.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/30 p-4">
              <p className="text-sm font-bold text-slate-700">Fluxo unico de atualizacao</p>
              <p className="max-w-[620px] text-xs text-slate-500">
                Esta tela nao executa recalculo manual de estoque para evitar sobrescrita indevida de saldos e custos.
                Qualquer ajuste deve ocorrer por entrada, saida, exclusao de movimentacao ou exclusao do produto completo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="pointer-events-none overflow-hidden rounded-xl border-none bg-white opacity-80 grayscale shadow-sm">
          <CardHeader className="bg-slate-50/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Seguranca (Em breve)</CardTitle>
                <CardDescription className="text-xs">Gerenciamento de acesso e logs.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <CheckCircle2 className="h-4 w-4" /> Autenticacao via senha unica ativa.
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
