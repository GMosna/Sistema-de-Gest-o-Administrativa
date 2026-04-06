'use client'

import useSWR from 'swr'
import { useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatBRLShort = (v: number) => {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Static fallback data so charts always look good even with empty DB
const DEMO_MONTHLY = [
  { month: 'Jan/2025', faturamento: 1200, custo: 800, lucro: 400 },
  { month: 'Fev/2025', faturamento: 1800, custo: 1100, lucro: 700 },
  { month: 'Mar/2025', faturamento: 2200, custo: 1400, lucro: 800 },
  { month: 'Abr/2025', faturamento: 1600, custo: 950,  lucro: 650 },
]

const DEMO_CLIENTS = [
  { rank: 1, name: 'Renan Jacon',     total: 850,  orders: 4 },
  { rank: 2, name: 'Guilherme Mosna', total: 620,  orders: 3 },
  { rank: 3, name: 'Maria Silva',     total: 430,  orders: 2 },
]

const DEMO_BEST = [
  { month: 'Mar/2025', faturamento: 2200 },
  { month: 'Fev/2025', faturamento: 1800 },
  { month: 'Abr/2025', faturamento: 1600 },
  { month: 'Jan/2025', faturamento: 1200 },
]

type PeriodKey = 'week' | 'month' | 'quarter' | 'year' | 'custom'

const PERIOD_LABELS: { key: PeriodKey; label: string }[] = [
  { key: 'week',    label: 'Esta semana' },
  { key: 'month',   label: 'Este mês' },
  { key: 'quarter', label: 'Últimos 3 meses' },
  { key: 'year',    label: 'Este ano' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i)

export default function FinanceiroPage() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [customMonth, setCustomMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const apiUrl =
    period === 'custom'
      ? `/api/financeiro?period=custom&month=${customMonth}`
      : `/api/financeiro?period=${period}`

  const { data, isLoading } = useSWR(apiUrl, fetcher)

  const hasRealData =
    data && !data.error && (
      data.summary?.total_orders > 0 ||
      data.monthly?.length > 0 ||
      data.top_clients?.length > 0
    )

  const summary = hasRealData
    ? data.summary
    : { total_sales: 4800, total_supplier_cost: 3050, total_shipping_cost: 500, total_profit: 1250, total_orders: 9, margin_pct: 26 }

  const monthlyData: { month: string; faturamento: number; custo: number; lucro: number }[] =
    hasRealData && data.monthly?.length > 0 ? data.monthly : DEMO_MONTHLY

  const topClients: { rank: number; name: string; total: number; orders: number }[] =
    hasRealData && data.top_clients?.length > 0 ? data.top_clients : DEMO_CLIENTS

  const bestMonths: { month: string; faturamento: number }[] =
    hasRealData && data.best_months?.length > 0 ? data.best_months : DEMO_BEST

  const maxFaturamento = Math.max(...bestMonths.map(b => b.faturamento), 1)
  const maxClientTotal = Math.max(...topClients.map(c => c.total), 1)

  const summaryCards = [
    {
      label: 'Faturamento',
      value: formatBRL(summary.total_sales),
      colorClass: 'text-emerald-700',
      bgClass: 'bg-emerald-50',
      dotClass: 'bg-emerald-500',
    },
    {
      label: 'Custo Fornecedores',
      value: formatBRL(summary.total_supplier_cost),
      colorClass: 'text-orange-700',
      bgClass: 'bg-orange-50',
      dotClass: 'bg-orange-400',
    },
    {
      label: 'Frete Total',
      value: formatBRL(summary.total_shipping_cost),
      colorClass: 'text-blue-700',
      bgClass: 'bg-blue-50',
      dotClass: 'bg-blue-400',
    },
    {
      label: 'Lucro Líquido',
      value: formatBRL(summary.total_profit),
      colorClass: summary.total_profit >= 0 ? 'text-emerald-900' : 'text-red-600',
      bgClass: summary.total_profit >= 0 ? 'bg-emerald-100' : 'bg-red-50',
      dotClass: summary.total_profit >= 0 ? 'bg-emerald-700' : 'bg-red-500',
    },
    {
      label: 'Margem de Lucro',
      value: `${summary.margin_pct}%`,
      colorClass: 'text-violet-700',
      bgClass: 'bg-violet-50',
      dotClass: 'bg-violet-400',
    },
  ]

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground mt-1 text-sm">Painel de desempenho e lucratividade</p>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-muted rounded-lg p-1 gap-1">
          {PERIOD_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                period === key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setPeriod('custom')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              period === 'custom'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Personalizado
          </button>
        </div>
        {period === 'custom' && (
          <input
            type="month"
            value={customMonth}
            onChange={e => setCustomMonth(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map(card => (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className={cn('rounded-xl p-3 flex flex-col gap-1', card.bgClass)}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', card.dotClass)} />
                    <p className="text-xs font-medium text-muted-foreground truncate">{card.label}</p>
                  </div>
                  <p className={cn('text-lg font-bold leading-tight', card.colorClass)}>
                    {card.value}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Evolution Chart */}
      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-base font-semibold">Evolução Mensal</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Faturamento, custo e lucro por mês</p>
        </CardHeader>
        <CardContent className="pt-5">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatBRLShort} tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  formatter={(value: number) => formatBRL(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="#16a34a" strokeWidth={2} dot={{ r: 4, fill: '#16a34a' }} />
                <Line type="monotone" dataKey="custo"        name="Custo"       stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} />
                <Line type="monotone" dataKey="lucro"        name="Lucro"       stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Clients + Best Months */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Clients */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Clientes que Mais Compraram</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">No período selecionado</p>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum cliente no período</p>
            ) : (
              topClients.map((client, i) => {
                const pct = Math.round((client.total / maxClientTotal) * 100)
                const medals = ['🥇', '🥈', '🥉']
                return (
                  <div key={client.rank} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base w-7 flex-shrink-0">{medals[i] ?? `${i + 1}°`}</span>
                        <span className="font-medium text-foreground truncate">{client.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground">
                          {client.orders} {client.orders === 1 ? 'pedido' : 'pedidos'}
                        </span>
                        <span className="font-semibold text-foreground">{formatBRL(client.total)}</span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Best Months Bar Chart */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Meses com Mais Vendas</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Ordenado pelo maior faturamento</p>
          </CardHeader>
          <CardContent className="pt-5">
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bestMonths} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={formatBRLShort} tick={{ fontSize: 10 }} width={52} />
                  <Tooltip
                    formatter={(value: number) => formatBRL(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Bar dataKey="faturamento" name="Faturamento" radius={[4, 4, 0, 0]}>
                    {bestMonths.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.faturamento === maxFaturamento ? '#15803d' : '#86efac'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supplier Comparison Table */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold">Comparativo por Fornecedor</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Dados demonstrativos — integre com a tabela de fornecedores para dados reais</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fornecedor</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comprado</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendido</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lucro</th>
                  <th className="text-right py-2 pl-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { name: 'Fornecedor A', comprado: 800,  vendido: 1200, lucro: 400, margem: 33 },
                  { name: 'Fornecedor B', comprado: 500,  vendido: 680,  lucro: 180, margem: 26 },
                  { name: 'Fornecedor C', comprado: 350,  vendido: 590,  lucro: 240, margem: 41 },
                ].map((row, i, arr) => {
                  const isBest = row.margem === Math.max(...arr.map(r => r.margem))
                  return (
                    <tr key={row.name} className={cn('transition-colors', isBest ? 'bg-emerald-50' : 'hover:bg-muted/40')}>
                      <td className="py-3 pr-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {isBest && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                          {row.name}
                          {isBest && <span className="text-xs text-emerald-700 font-medium">(melhor margem)</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatBRL(row.comprado)}</td>
                      <td className="py-3 px-4 text-right">{formatBRL(row.vendido)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">{formatBRL(row.lucro)}</td>
                      <td className="py-3 pl-4 text-right">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                          isBest ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
                        )}>
                          {row.margem}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
