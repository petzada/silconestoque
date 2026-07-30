'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Panel, PanelEmpty } from '@/components/dashboard/panel';
import { KpiTile } from '@/components/dashboard/kpi-tile';
import {
  CHART_AXIS_TICK_STYLE,
  CHART_CURSOR_FILL,
  CHART_TOOLTIP_STYLE,
  getSequentialRampColor,
} from '@/lib/chart';
import { formatCoberturaDias, formatInt, formatPercent } from '@/lib/format';
import type { DashboardOperacao } from '@/lib/types';

/**
 * Faixas de saldo, com as cores semânticas do sistema — não com a paleta
 * categórica de data-viz. Zerado/Crítico/Estável são ESTADOS de severidade,
 * não categorias de coisa: usar roxo/ciano aqui perderia o significado que a
 * cor carrega, e é a razão pela qual `lib/chart.ts` separa ALERT_PALETTE da
 * paleta de série.
 */
const FAIXAS = [
  { key: 'zerados', label: 'Zerado', color: 'var(--destructive)' },
  { key: 'criticos', label: 'Crítico', color: 'var(--warning)' },
  { key: 'estaveis', label: 'Estável', color: 'var(--success)' },
] as const;

export function OperacaoTab({ data }: { data: DashboardOperacao }) {
  const emRisco = data.zerados + data.criticos;
  const percentualRisco = data.total_ativos > 0 ? (emRisco / data.total_ativos) * 100 : null;

  const coberturaChart = data.cobertura_criticos.slice(0, 10).map((item, index, list) => ({
    ...item,
    label: item.product_name.length > 22 ? `${item.product_name.slice(0, 22)}…` : item.product_name,
    fill: getSequentialRampColor(index, list.length),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="Zerados"
          value={formatInt(data.zerados)}
          tone={data.zerados > 0 ? 'danger' : 'neutral'}
          note="Saldo igual a zero"
        />
        <KpiTile
          label="Críticos"
          value={formatInt(data.criticos)}
          tone={data.criticos > 0 ? 'warning' : 'neutral'}
          note="Abaixo do estoque mínimo"
        />
        <KpiTile
          label="Catálogo em risco"
          value={formatPercent(percentualRisco)}
          note={`${formatInt(emRisco)} de ${formatInt(data.total_ativos)} produtos ativos`}
        />
        <KpiTile
          label="Cobertura abaixo de 15 dias"
          value={formatInt(data.cobertura_abaixo_15_dias)}
          tone={data.cobertura_abaixo_15_dias > 0 ? 'warning' : 'neutral'}
          note="Pelo consumo médio de 90 dias"
        />
        <KpiTile
          label="Pedidos em atraso"
          value={formatInt(data.pedidos_atraso.length)}
          tone={data.pedidos_atraso.length > 0 ? 'danger' : 'neutral'}
          note="Entrega estimada vencida, sem recebimento"
        />
      </div>

      <Panel
        title="Composição do catálogo"
        description="As três faixas são exclusivas e somam o total de produtos ativos"
      >
        {data.total_ativos === 0 ? (
          <PanelEmpty
            title="Nenhum produto ativo"
            hint="Cadastre produtos para acompanhar a composição do catálogo por faixa de saldo."
          />
        ) : (
          <div className="space-y-3">
            <div className="flex h-6 w-full overflow-hidden" role="img" aria-label="Distribuição do catálogo por faixa de saldo">
              {FAIXAS.map((faixa) => {
                const count = data[faixa.key];
                if (count === 0) return null;
                return (
                  <div
                    key={faixa.key}
                    style={{ width: `${(count / data.total_ativos) * 100}%`, backgroundColor: faixa.color }}
                    title={`${faixa.label}: ${formatInt(count)}`}
                  />
                );
              })}
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {FAIXAS.map((faixa) => (
                <li key={faixa.key} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 shrink-0" style={{ backgroundColor: faixa.color }} aria-hidden />
                  <span className="text-muted-foreground">{faixa.label}</span>
                  <span className="text-foreground tabular-nums">{formatInt(data[faixa.key])}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Itens por urgência" description="Zerados primeiro, depois críticos por déficit relativo">
          {data.top_urgencia.length === 0 ? (
            <PanelEmpty
              title="Nenhum item zerado ou crítico"
              hint="Todo produto ativo está no estoque mínimo ou acima dele."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.top_urgencia.map((item) => (
                <li key={item.product_id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Saldo {formatInt(item.current_qty)} · mínimo {formatInt(item.min_stock)}
                    </p>
                  </div>
                  <Badge variant={item.faixa === 'zerado' ? 'destructive' : 'secondary'}>
                    {item.faixa === 'zerado' ? 'Zerado' : 'Crítico'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Cobertura em dias"
          description="Saldo dividido pelo consumo médio diário dos últimos 90 dias"
        >
          {coberturaChart.length === 0 ? (
            <PanelEmpty
              title="Sem cobertura calculável"
              hint="Nenhum produto ativo teve saída nos últimos 90 dias, então não há consumo médio para projetar."
            />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coberturaChart} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                  <XAxis
                    type="number"
                    tick={CHART_AXIS_TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                    unit=" d"
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={CHART_AXIS_TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    cursor={{ fill: CHART_CURSOR_FILL }}
                    formatter={(value: number | undefined) => [formatCoberturaDias(value), 'Cobertura']}
                  />
                  <Bar dataKey="cobertura_dias" radius={0}>
                    {coberturaChart.map((item) => (
                      <Cell key={item.product_id} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Pedidos em atraso"
        description="Não filtrado por categoria: pedido de compra pode conter item fora do catálogo"
      >
        {data.pedidos_atraso.length === 0 ? (
          <PanelEmpty
            title="Nenhum pedido em atraso"
            hint="Todo pedido de compra com entrega estimada vencida já foi recebido."
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.pedidos_atraso.map((pedido) => (
              <li key={pedido.po_id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {pedido.po_number} · {pedido.supplier_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Entrega estimada em {pedido.estimated_delivery.split('-').reverse().join('/')}
                  </p>
                </div>
                <Badge variant="destructive">
                  {formatInt(pedido.dias_atraso)} {pedido.dias_atraso === 1 ? 'dia' : 'dias'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
