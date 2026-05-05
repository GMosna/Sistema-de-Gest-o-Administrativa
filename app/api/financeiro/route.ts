import { NextResponse } from 'next/server'
import { format, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'

type OrderRow = {
  id: number
  clientId: number
  totalValue: unknown
  supplierCost: unknown
  shippingCost: unknown
  profit: unknown
  createdAt: Date
  client: { id: number; name: string }
}

function filterByPeriod(orders: OrderRow[], period: string, monthParam: string | null, yearParam: string | null): OrderRow[] {
  const now = new Date()
  return orders.filter((o) => {
    const d = new Date(o.createdAt)
    if (period === 'week') return d >= new Date(now.getTime() - 7 * 86400000)
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === 'quarter') return d >= new Date(now.getTime() - 90 * 86400000)
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    if (period === 'custom' && monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      return d.getFullYear() === y && d.getMonth() + 1 === m
    }
    if (period === 'custom_year' && yearParam) return d.getFullYear() === Number(yearParam)
    return true
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'month'
  const monthParam = searchParams.get('month')
  const yearParam = searchParams.get('year')

  try {
    const allOrders = await prisma.order.findMany({
      include: { client: { select: { id: true, name: true } } },
    })

    const filtered = filterByPeriod(allOrders as OrderRow[], period, monthParam, yearParam)

    const total_sales = filtered.reduce((s, o) => s + Number(o.totalValue), 0)
    const total_supplier_cost = filtered.reduce((s, o) => s + Number(o.supplierCost), 0)
    const total_shipping_cost = filtered.reduce((s, o) => s + Number(o.shippingCost), 0)
    const total_profit = filtered.reduce((s, o) => s + Number(o.profit), 0)
    const margin = total_sales > 0 ? Math.round((total_profit / total_sales) * 100) : 0

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = subMonths(new Date(), 11 - i)
      const monthOrders = (allOrders as OrderRow[]).filter((o) => {
        const d = new Date(o.createdAt)
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear()
      })
      return {
        month: format(m, 'MMM/yyyy', { locale: ptBR }),
        faturamento: monthOrders.reduce((s, o) => s + Number(o.totalValue), 0),
        custo: monthOrders.reduce((s, o) => s + Number(o.supplierCost) + Number(o.shippingCost), 0),
        lucro: monthOrders.reduce((s, o) => s + Number(o.profit), 0),
      }
    })

    const clientTotals: Record<number, { id: number; name: string; total: number; orders: number }> = {}
    filtered.forEach((o) => {
      const cid = o.clientId
      if (!clientTotals[cid]) clientTotals[cid] = { id: cid, name: o.client.name, total: 0, orders: 0 }
      clientTotals[cid].total += Number(o.totalValue)
      clientTotals[cid].orders += 1
    })
    const top_clients = Object.values(clientTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((c, i) => ({ rank: i + 1, ...c }))

    const monthMap: Record<string, { month: string; faturamento: number }> = {}
    ;(allOrders as OrderRow[]).forEach((o) => {
      const key = format(new Date(o.createdAt), 'MMM/yyyy', { locale: ptBR })
      if (!monthMap[key]) monthMap[key] = { month: key, faturamento: 0 }
      monthMap[key].faturamento += Number(o.totalValue)
    })
    const best_months = Object.values(monthMap)
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 8)

    return NextResponse.json({
      summary: {
        total_sales,
        total_supplier_cost,
        total_shipping_cost,
        total_profit,
        total_orders: filtered.length,
        margin_pct: margin,
      },
      monthly,
      top_clients,
      best_months,
    })
  } catch (error) {
    console.error('[GET /api/financeiro]', error)
    return NextResponse.json({ error: 'Erro ao buscar dados financeiros' }, { status: 500 })
  }
}
