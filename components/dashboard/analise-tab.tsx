'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, PackageX, Percent, TrendingUp } from 'lucide-react';
import { Panel, PanelEmpty } from '@/components/dashboard/panel';
import { KpiTile } from '@/components/dashboard/kpi-tile';
import {
  CHART_AXIS_TICK_STYLE,
  CHART_CURSOR_FILL,
  CHART_DUAL_SERIES_COLORS,
  CHART_GRID_PROPS,
  CHART_SINGLE_SERIES_COLOR,
  CHART_TOOLTIP_STYLE,
  getSequentialRampColor,
} from '@/lib/chart';
import {
  computeDelta,
  formatCurrency,
  formatCurrencyCompact,
  formatDayShort,
  formatInt,
} from '@/lib/format';
import type {
  DashboardAnaliseKpis,
  DashboardDestaque,
  DashboardDestaqueTipo,
  DashboardDimensaoItem,
  DashboardSerieItem,
} from '@/lib/types';

const DESTAQUE_ICON: Record<DashboardDestaqueTipo, typeof TrendingUp> = {
  maior_alta_custo: TrendingUp,
  setor_acima_media: AlertTriangle,
  categoria_maior_share: Percent,
  encalhe: PackageX,
};

interface AnaliseTabProps {
  kpis: DashboardAnaliseKpis | null;
  serie: DashboardSerieItem[];
  porCategoria: DashboardDimensaoItem[];
  porSetor: DashboardDimensaoItem[];
  porProduto: DashboardDimensaoItem[];
  destaques: DashboardDestaque[];
  /** Filtro de setor ativo. Muda o que pode ser exibido — ver comentários. */
  setorFiltrado: boolean;
}

export function AnaliseTab({
  kpis,
  serie,
  porCategoria,
  porSetor,
  porProduto,
  destaques,
  setorFiltrado,
}: AnaliseTabProps) {
  const temMovimento = serie.some((item) => item.consumo > 0 || item.compras > 0);

  const serieChart = serie.map((item) => ({ ...item, label: formatDayShort(item.dia) }));

  const produtoChart = porProduto.map((item, index, list) => ({
    ...item,
    label: item.dim_label.length > 24 ? `${item.dim_label.slice(0, 24)}…` : item.dim_label,
    fill: getSequentialRampColor(index, list.length),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Consumo"
          value={formatCurrency(kpis?.consumo_atual ?? null)}
          delta={computeDelta(kpis?.consumo_atual ?? null, kpis?.consumo_anterior ?? null)}
          note="Saídas a custo congelado"
        />
        <KpiTile
          label="Compras"
          value={formatCurrency(kpis?.compras_atual ?? null)}
          delta={computeDelta(kpis?.compras_atual ?? null, kpis?.compras_anterior ?? null)}
          // O RPC devolve NULL, e não zero, quando há filtro de setor ativo:
          // Entrada não carrega setor, então "compras deste setor" é uma
          // pergunta que não existe. Zero afirmaria que nada foi comprado.
          note={setorFiltrado ? 'Entrada não tem setor: não se aplica a este recorte' : 'Entradas com nota fiscal'}
        />
        <KpiTile
          label="Movimentações"
          value={formatInt(kpis?.movimentacoes_atual ?? null)}
          delta={computeDelta(kpis?.movimentacoes_atual ?? null, kpis?.movimentacoes_anterior ?? null)}
          note="Entradas e saídas no período"
        />
        <KpiTile
          label="Valor imobilizado"
          value={formatCurrency(kpis?.valor_imobilizado ?? null)}
          // Sem delta de propósito: é foto do catálogo agora, não um agregado
          // do período. Não existe snapshot histórico de saldo, então não há
          // valor anterior a comparar — inventar um seria número falso.
          note="Foto do estoque agora, fora do período"
        />
      </div>

      {destaques.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {destaques.map((destaque) => {
            const Icon = DESTAQUE_ICON[destaque.tipo];
            return (
              <li
                key={destaque.tipo}
                className="flex items-start gap-3 border border-border bg-surface-soft p-4"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {/* O texto já vem pronto do banco (dashboard_destaques), com o
                    número embutido — por isso `valor` não é reimpresso aqui:
                    seria a mesma informação duas vezes na mesma frase. */}
                <p className="text-sm text-foreground">{destaque.texto}</p>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Panel
        title="Consumo e compras por dia"
        description={
          setorFiltrado
            ? 'Compras omitidas: Entrada não carrega setor, então o recorte não se aplica a ela'
            : 'Consumo a custo congelado e compras com nota fiscal'
        }
      >
        {!temMovimento ? (
          <PanelEmpty
            title="Nenhuma movimentação no período"
            hint="Ajuste o período ou os filtros para ver a série diária."
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieChart} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid {...CHART_GRID_PROPS} vertical={false} />
                <XAxis dataKey="label" tick={CHART_AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis
                  tick={CHART_AXIS_TICK_STYLE}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  tickFormatter={(value: number) => formatCurrencyCompact(value)}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number | undefined, name: string | undefined) => [formatCurrency(value), name ?? '']}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="consumo"
                  name="Consumo"
                  stroke={CHART_DUAL_SERIES_COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                />
                {/* Série de compras escondida sob filtro de setor, para não
                    contradizer o KPI: o RPC de série (ao contrário do de KPI)
                    não anula compras nesse recorte, então ela viria como uma
                    linha achatada em zero — o que afirmaria que nada foi
                    comprado, exatamente a mentira que o "—" do KPI evita. */}
                {setorFiltrado ? null : (
                  <Line
                    type="monotone"
                    dataKey="compras"
                    name="Compras"
                    stroke={CHART_DUAL_SERIES_COLORS[1]}
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DimensaoPanel
          title="Consumo por categoria"
          description="Período atual comparado ao período anterior equivalente"
          items={porCategoria}
          emptyTitle="Nenhum consumo por categoria"
        />
        <DimensaoPanel
          title="Consumo por setor"
          description="Setor gravado na movimentação. Saída sem solicitante agrupa como Sem solicitante"
          items={porSetor}
          emptyTitle="Nenhum consumo por setor"
          emptyHint="Saídas sem colaborador informado não têm setor para agrupar."
        />
      </div>

      <Panel title="Top produtos por consumo" description="Ordenados por valor consumido no período">
        {produtoChart.length === 0 ? (
          <PanelEmpty
            title="Nenhum consumo no período"
            hint="Ajuste o período ou os filtros para ver o ranking de produtos."
          />
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={produtoChart} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  tick={CHART_AXIS_TICK_STYLE}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => formatCurrencyCompact(value)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={168}
                  tick={CHART_AXIS_TICK_STYLE}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: CHART_CURSOR_FILL }}
                  formatter={(value: number | undefined) => [formatCurrency(value), 'Consumo']}
                />
                {/* Rampa sequencial, não cores categóricas: o eixo aqui é
                    magnitude do mesmo tipo de coisa (produto consumido), e N
                    matizes distintos afirmariam que são N tipos diferentes. */}
                <Bar dataKey="consumo_atual" radius={0}>
                  {produtoChart.map((item) => (
                    <Cell key={item.dim_id ?? item.dim_label} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}

function DimensaoPanel({
  title,
  description,
  items,
  emptyTitle,
  emptyHint,
}: {
  title: string;
  description: string;
  items: DashboardDimensaoItem[];
  emptyTitle: string;
  emptyHint?: string;
}) {
  const chart = items.map((item) => ({
    ...item,
    label: item.dim_label.length > 18 ? `${item.dim_label.slice(0, 18)}…` : item.dim_label,
  }));

  return (
    <Panel title={title} description={description}>
      {chart.length === 0 ? (
        <PanelEmpty title={emptyTitle} hint={emptyHint} />
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
              <CartesianGrid {...CHART_GRID_PROPS} vertical={false} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis
                tick={CHART_AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                width={72}
                tickFormatter={(value: number) => formatCurrencyCompact(value)}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                cursor={{ fill: CHART_CURSOR_FILL }}
                formatter={(value: number | undefined, name: string | undefined) => [formatCurrency(value), name ?? '']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="consumo_atual" name="Período atual" fill={CHART_SINGLE_SERIES_COLOR} radius={0} />
              <Bar dataKey="consumo_anterior" name="Período anterior" fill={CHART_DUAL_SERIES_COLORS[1]} radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
