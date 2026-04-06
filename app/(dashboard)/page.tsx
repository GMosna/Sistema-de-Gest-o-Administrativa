'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { TrendingUp, Clock, ShoppingBag, AlertTriangle, ArrowRight, DollarSign, Truck, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type StatusKey = 'pending' | 'paid' | 'partial'

const statusConfig: Record<StatusKey, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  paid: { label: 'Pago', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  partial: { label: 'Parcial', className: 'bg-sky-100 text-sky-700 border-sky-200' },
}

const paymentMap: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  installments: 'Parcelado',
}

function StatusTag({ status }: { status: string }) {
  const config = statusConfig[status as StatusKey] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useSWR('/api/dashboard', fetcher)

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Resumo geral do sistema</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total em Vendas</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-28 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {formatBRL(data?.total_sales ?? 0)}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">A receber</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-28 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {formatBRL(data?.total_pending ?? 0)}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Pedidos</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {data?.total_orders ?? 0}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-red-100">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-red-500 font-medium uppercase tracking-wide">Parcelas Atrasadas</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-28 mt-2" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-red-600 mt-2">
                      {formatBRL(data?.overdue_value ?? 0)}
                    </p>
                    {(data?.overdue_count ?? 0) > 0 && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {data?.overdue_count} {data?.overdue_count === 1 ? 'parcela atrasada' : 'parcelas atrasadas'}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability Section */}
      <Card className="mb-8">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold">Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Faturamento</p>
                  <p className="text-base font-bold text-foreground mt-0.5">{formatBRL(data?.total_sales ?? 0)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <DollarSign className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Custo Fornecedores</p>
                  <p className="text-base font-bold text-foreground mt-0.5">{formatBRL(data?.total_supplier_cost ?? 0)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Truck className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Frete</p>
                  <p className="text-base font-bold text-foreground mt-0.5">{formatBRL(data?.total_shipping_cost ?? 0)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Lucro Liquido</p>
                  <p className={`text-base font-bold mt-0.5 ${(data?.total_profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatBRL(data?.total_profit ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base font-semibold">Pedidos Recentes</CardTitle>
          <Link
            href="/pedidos"
            className="text-sm text-primary font-medium flex items-center gap-1 hover:underline"
          >
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 pb-4 pt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.recent_orders?.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum pedido ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                <Link href="/pedidos/novo" className="text-primary hover:underline">Crie seu primeiro pedido</Link>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data?.recent_orders?.map((order: {
                id: number
                client_name: string
                total_value: number
                payment_method: string
                status: string
                created_at: string
              }) => (
                <Link
                  key={order.id}
                  href={`/pedidos/${order.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0">#{order.id}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{order.client_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        {' · '}
                        {paymentMap[order.payment_method] ?? order.payment_method}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusTag status={order.status} />
                    <span className="text-sm font-bold text-foreground">
                      {formatBRL(Number(order.total_value))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
