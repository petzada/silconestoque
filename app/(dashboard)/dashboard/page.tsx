import { Suspense } from 'react';
import { DashboardHome } from '@/components/dashboard/dashboard-home';
import { PageLoading } from '@/components/layout/page-loading';

export const dynamic = 'force-dynamic';

/**
 * Home do dashboard: duas abas (Operação e Análise), com os filtros na
 * querystring.
 *
 * A agregação toda vive em RPCs do Postgres (ver
 * supabase/migration_fase3_analitico.sql). A versão anterior desta tela
 * baixava a tabela `movements` inteira e agregava em JavaScript, o que fazia o
 * custo de cada KPI crescer com o tamanho do ledger e mantinha a definição de
 * "crítico" replicada em três telas mais uma view morta.
 *
 * A fronteira de Suspense é obrigatória: `DashboardHome` usa `useSearchParams`
 * para ler o filtro da URL, e sem ela o prerender estático da rota quebra.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoading label="Carregando indicadores..." />}>
      <DashboardHome />
    </Suspense>
  );
}
