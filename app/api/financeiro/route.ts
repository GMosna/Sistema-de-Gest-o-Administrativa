import { NextResponse } from 'next/server'
import { format, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type MockOrder = {
  total_value: number
  supplier_cost: number
  shipping_cost: number
  profit: number
  client_id: number
  created_at: string
}

type MockClient = {
  id: number
  name: string
}

type MockDB = {
  orders: MockOrder[]
  clients: MockClient[]
}

function getDB(): MockDB {
  return (global as Record<string, unknown>).__mockDB as MockDB ?? { orders: [], clients: [] }
}

function filterByPeriod(orders: MockOrder[], period: string, monthParam: string | null, yearParam: string | null): MockOrder[] {
  const now = new Date()
  return orders.filter(o => {
    const d = new Date(o.created_at)
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
    const db = getDB()
    const filtered = filterByPeriod(db.orders, period, monthParam, yearParam)

    const total_sales = filtered.reduce((s, o) => s + Number(o.total_value), 0)
    const total_supplier_cost = filtered.reduce((s, o) => s + Number(o.supplier_cost), 0)
    const total_shipping_cost = filtered.reduce((s, o) => s + Number(o.shipping_cost), 0)
    const total_profit = filtered.reduce((s, o) => s + Number(o.profit), 0)
    const margin = total_sales > 0 ? Math.round((total_profit / total_sales) * 100) : 0

    // Evolucao mensal (ultimos 12 meses)
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = subMonths(new Date(), 11 - i)
      const monthOrders = db.orders.filter(o => {
        const d = new Date(o.created_at)
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear()
      })
      return {
        month: format(m, 'MMM/yyyy', { locale: ptBR }),
        faturamento: monthOrders.reduce((s, o) => s + Number(o.total_value), 0),
        custo: monthOrders.reduce((s, o) => s + Number(o.supplier_cost) + Number(o.shipping_cost), 0),
        lucro: monthOrders.reduce((s, o) => s + Number(o.profit), 0),
      }
    })

    // Top clientes
    const clientTotals: Record<number, { id: number; name: string; total: number; orders: number }> = {}
    filtered.forEach(o => {
      const client = db.clients.find(c => c.id === o.client_id)
      if (!client) return
      if (!clientTotals[client.id]) clientTotals[client.id] = { id: client.id, name: client.name, total: 0, orders: 0 }
      clientTotals[client.id].total += Number(o.total_value)
      clientTotals[client.id].orders += 1
    })
    const top_clients = Object.values(clientTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((c, i) => ({ rank: i + 1, ...c }))

    // Melhores meses
    const monthMap: Record<string, { month: string; faturamento: number }> = {}
    db.orders.forEach(o => {
      const key = format(new Date(o.created_at), 'MMM/yyyy', { locale: ptBR })
      if (!monthMap[key]) monthMap[key] = { month: key, faturamento: 0 }
      monthMap[key].faturamento += Number(o.total_value)
    })
    const best_months = Object.values(monthMap).sort((a, b) => b.faturamento - a.faturamento).slice(0, 8)

    return NextResponse.json({
      summary: { total_sales, total_supplier_cost, total_shipping_cost, total_profit, total_orders: filtered.length, margin_pct: margin },
      monthly,
      top_clients,
      best_months,
    })
  } catch (error) {
    console.error('[financeiro]', error)
    return NextResponse.json({ error: 'Erro ao buscar dados financeiros' }, { status: 500 })
  }
}

