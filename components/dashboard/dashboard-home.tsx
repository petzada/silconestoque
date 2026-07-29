'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDbErrorMessage } from '@/lib/db-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilterBar } from '@/components/layout/filter-bar';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { OperacaoTab } from '@/components/dashboard/operacao-tab';
import { AnaliseTab } from '@/components/dashboard/analise-tab';
import type {
  Category,
  DashboardAnaliseKpis,
  DashboardDestaque,
  DashboardDimensaoItem,
  DashboardOperacao,
  DashboardSerieItem,
  Department,
} from '@/lib/types';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const STORAGE_KEY = 'silcon:dashboard-filters';
const ALL = 'all';

type TabKey = 'operacao' | 'analise';

/** Primeiro e último dia do mês selecionado, em ISO local (YYYY-MM-DD).
 *
 * Para o mês corrente, `to` é HOJE, não o último dia: é o "mês corrente (MTD)"
 * que a home usa por padrão. Fechar no dia 31 de um mês que ainda não acabou
 * faria o comparativo contra o mês anterior inteiro parecer uma queda. */
function monthRange(year: number, monthIndex: number): { from: string; to: string } {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const first = new Date(year, monthIndex, 1);
  const isCurrentMonth = year === today.getFullYear() && monthIndex === today.getMonth();
  const last = isCurrentMonth ? today : new Date(year, monthIndex + 1, 0);
  return { from: iso(first), to: iso(last) };
}

export function DashboardHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = useMemo(() => new Date(), []);

  // A querystring é a fonte de verdade do filtro (compartilhável, e o botão
  // voltar funciona). O localStorage só semeia o primeiro acesso da sessão,
  // quando a URL vem sem parâmetro nenhum.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (searchParams.toString().length > 0) return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) router.replace(`?${saved}`, { scroll: false });
    } catch {
      // localStorage indisponível (modo privado, storage cheio): o padrão do
      // mês corrente já cobre, não há o que recuperar.
    }
  }, [router, searchParams]);

  const tab = (searchParams.get('tab') === 'analise' ? 'analise' : 'operacao') as TabKey;
  const mes = Number(searchParams.get('mes') ?? now.getMonth());
  const ano = Number(searchParams.get('ano') ?? now.getFullYear());
  const categoria = searchParams.get('cat') ?? ALL;
  const setor = searchParams.get('dep') ?? ALL;

  const mesValido = Number.isInteger(mes) && mes >= 0 && mes <= 11 ? mes : now.getMonth();
  const anoValido = Number.isInteger(ano) && ano > 2000 && ano < 2100 ? ano : now.getFullYear();

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === ALL) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      try {
        window.localStorage.setItem(STORAGE_KEY, qs);
      } catch {
        // Persistência é conveniência, não requisito: a URL continua correta.
      }
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router, searchParams]
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [operacao, setOperacao] = useState<DashboardOperacao | null>(null);
  const [kpis, setKpis] = useState<DashboardAnaliseKpis | null>(null);
  const [serie, setSerie] = useState<DashboardSerieItem[]>([]);
  const [porCategoria, setPorCategoria] = useState<DashboardDimensaoItem[]>([]);
  const [porSetor, setPorSetor] = useState<DashboardDimensaoItem[]>([]);
  const [porProduto, setPorProduto] = useState<DashboardDimensaoItem[]>([]);
  const [destaques, setDestaques] = useState<DashboardDestaque[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [catRes, depRes] = await Promise.all([
        supabase.from('categories').select('*').order('name').order('id'),
        supabase.from('departments').select('*').order('name').order('id'),
      ]);
      if (cancelled) return;
      setCategories(catRes.data ?? []);
      setDepartments(depRes.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoriaParam = categoria === ALL ? null : categoria;
  const setorParam = setor === ALL ? null : setor;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const { from, to } = monthRange(anoValido, mesValido);
    try {
      if (tab === 'operacao') {
        // A aba Operação é foto instantânea: recebe só o filtro de categoria,
        // de propósito. Período não tem significado aqui — e a barra de filtro
        // da tela antiga ficava sobre quatro KPIs movendo apenas dois.
        const { data, error } = await supabase.rpc('dashboard_operacao', {
          p_category_id: categoriaParam,
        });
        if (error) throw error;
        setOperacao(data as DashboardOperacao);
      } else {
        const dim = {
          p_from: from,
          p_to: to,
          p_category_id: categoriaParam,
          p_department_id: setorParam,
        };
        const [kpisRes, serieRes, catRes, setorRes, prodRes, destRes] = await Promise.all([
          supabase.rpc('dashboard_analise_kpis', dim),
          supabase.rpc('dashboard_serie', dim),
          supabase.rpc('dashboard_dimensao', { ...dim, p_dim: 'categoria', p_limit: 10 }),
          supabase.rpc('dashboard_dimensao', { ...dim, p_dim: 'setor', p_limit: 10 }),
          supabase.rpc('dashboard_dimensao', { ...dim, p_dim: 'produto', p_limit: 10 }),
          supabase.rpc('dashboard_destaques', dim),
        ]);
        const firstError =
          kpisRes.error || serieRes.error || catRes.error || setorRes.error || prodRes.error || destRes.error;
        if (firstError) throw firstError;
        // dashboard_analise_kpis devolve TABLE de uma linha só, então chega
        // como array de um elemento.
        setKpis(((kpisRes.data as DashboardAnaliseKpis[]) ?? [])[0] ?? null);
        setSerie((serieRes.data as DashboardSerieItem[]) ?? []);
        setPorCategoria((catRes.data as DashboardDimensaoItem[]) ?? []);
        setPorSetor((setorRes.data as DashboardDimensaoItem[]) ?? []);
        setPorProduto((prodRes.data as DashboardDimensaoItem[]) ?? []);
        setDestaques((destRes.data as DashboardDestaque[]) ?? []);
      }
    } catch (error) {
      setLoadError(getDbErrorMessage(error, 'Não foi possível carregar os indicadores.'));
    } finally {
      setIsLoading(false);
    }
  }, [tab, mesValido, anoValido, categoriaParam, setorParam]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const anos = useMemo(() => {
    const current = now.getFullYear();
    const list = [current, current - 1, current - 2];
    if (!list.includes(anoValido)) list.push(anoValido);
    return list.sort((a, b) => b - a);
  }, [now, anoValido]);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={
          tab === 'operacao'
            ? 'O que precisa de ação agora'
            : `Consumo e compras em ${MONTHS[mesValido]} de ${anoValido}`
        }
      />

      <Tabs value={tab} onValueChange={(value) => setParam({ tab: value === 'analise' ? 'analise' : null })}>
        <TabsList>
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar>
        <Select value={categoria} onValueChange={(value) => setParam({ cat: value })}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Período e setor existem só na aba Análise: a aba Operação é foto do
            agora, e oferecer um filtro que não afeta nada seria mentir sobre o
            que a tela está mostrando. */}
        {tab === 'analise' ? (
          <>
            <Select value={String(mesValido)} onValueChange={(value) => setParam({ mes: value })}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((label, index) => (
                  <SelectItem key={label} value={String(index)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(anoValido)} onValueChange={(value) => setParam({ ano: value })}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anos.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={setor} onValueChange={(value) => setParam({ dep: value })}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os setores</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
      </FilterBar>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar os indicadores</AlertTitle>
          <AlertDescription className="space-y-3">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => void fetchData()}>
              <RotateCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <DashboardSkeleton tiles={tab === 'operacao' ? 5 : 4} />
      ) : tab === 'operacao' ? (
        operacao ? (
          <OperacaoTab data={operacao} />
        ) : null
      ) : (
        <AnaliseTab
          kpis={kpis}
          serie={serie}
          porCategoria={porCategoria}
          porSetor={porSetor}
          porProduto={porProduto}
          destaques={destaques}
          setorFiltrado={setorParam !== null}
        />
      )}
    </PageContainer>
  );
}

/** Skeleton com a mesma forma do conteúdo real (grade de KPIs + dois painéis),
 * para o carregamento não deslocar o layout quando os dados chegam. */
function DashboardSkeleton({ tiles }: { tiles: number }) {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">Carregando indicadores</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: tiles }).map((_, index) => (
          <div key={index} className="space-y-2 border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="border border-border bg-card p-4">
        <Skeleton className="h-[280px] w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="border border-border bg-card p-4">
          <Skeleton className="h-[240px] w-full" />
        </div>
        <div className="border border-border bg-card p-4">
          <Skeleton className="h-[240px] w-full" />
        </div>
      </div>
    </div>
  );
}
