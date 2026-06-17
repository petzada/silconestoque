'use client';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Database, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';

export default function SettingsPage() {
  return (
    <PageContainer variant="form-centric" className="space-y-6 pt-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Configuracoes</h1>
      </div>

      <div className="grid gap-6">
        <Card className="overflow-hidden rounded-xl bg-card shadow-sm">
          <CardHeader className="bg-muted/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success-muted p-2">
                <Database className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Integridade de Dados</CardTitle>
                <CardDescription className="text-xs">
                  Estoque e custo sao controlados automaticamente pelas movimentacoes.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-1 rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-bold text-foreground">Fluxo unico de atualizacao</p>
              <p className="max-w-[620px] text-xs text-muted-foreground">
                Esta tela nao executa recalculo manual de estoque para evitar sobrescrita indevida de saldos e custos.
                Qualquer ajuste deve ocorrer por entrada, saida, exclusao de movimentacao ou exclusao do produto completo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="pointer-events-none overflow-hidden rounded-xl bg-card opacity-80 grayscale shadow-sm">
          <CardHeader className="bg-muted/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Seguranca (Em breve)</CardTitle>
                <CardDescription className="text-xs">Gerenciamento de acesso e logs.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Autenticacao via senha unica ativa.
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
