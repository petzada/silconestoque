'use client';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Database, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Configurações"
        description="Preferências e integridade de dados do sistema"
      />

      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="bg-surface-soft pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-success-muted p-2">
                <Database className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">Integridade de Dados</CardTitle>
                <CardDescription className="text-xs">
                  Estoque e custo sao controlados automaticamente pelas movimentacoes.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-1 border border-border bg-surface-soft p-4">
              <p className="text-sm text-foreground">Fluxo unico de atualizacao</p>
              <p className="max-w-[620px] text-xs text-muted-foreground">
                Esta tela nao executa recalculo manual de estoque para evitar sobrescrita indevida de saldos e custos.
                Qualquer ajuste deve ocorrer por entrada, saida, exclusao de movimentacao ou exclusao do produto completo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="pointer-events-none overflow-hidden opacity-80 grayscale">
          <CardHeader className="bg-surface-soft pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted p-2">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">Seguranca (Em breve)</CardTitle>
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
