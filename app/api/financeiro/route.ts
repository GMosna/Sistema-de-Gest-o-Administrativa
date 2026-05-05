import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, subMonths, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'month'
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    let startDate: Date
    let endDate: Date = new Date()

    switch (period) {
      case 'week':
        startDate = subDays(endDate, 7)
        break
      case 'month':
        startDate = startOfMonth(endDate)
        endDate = endOfMonth(endDate)
        break
      case 'quarter':
        startDate = subDays(endDate, 90)
        break
      case 'year':
        startDate = new Date(endDate.getFullYear(), 0, 1)
        break
      case 'custom':
        if (month) {
          const [y, m] = month.split('-').map(Number)
          startDate = new Date(y, m - 1, 1)
          endDate = endOfMonth(startDate)
        } else {
          startDate = startOfMonth(endDate)
          endDate = endOfMonth(endDate)
        }
        break
      case 'custom_year':
        if (year) {
          const y = parseInt(year)
          startDate = new Date(y, 0, 1)
          endDate = new Date(y, 11, 31)
        } else {
          startDate = new Date(endDate.getFullYear(), 0, 1)
        }
        break
      default:
        startDate = startOfMonth(endDate)
        endDate = endOfMonth(endDate)
    }

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const totalSales = orders.reduce((sum, o) => sum + Number(o.totalValue), 0)
    const totalSupplierCost = orders.reduce((sum, o) => sum + Number(o.supplierCost), 0)
    const totalShippingCost = orders.reduce((sum, o) => sum + Number(o.shippingCost), 0)
    const totalProfit = orders.reduce((sum, o) => sum + Number(o.profit), 0)
    const marginPct = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0

    const monthlyData = []
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)

      const monthOrders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      })

      const faturamento = monthOrders.reduce((sum, o) => sum + Number(o.totalValue), 0)
      const custo = monthOrders.reduce(
        (sum, o) => sum + Number(o.supplierCost) + Number(o.shippingCost),
        0
      )
      const lucro = monthOrders.reduce((sum, o) => sum + Number(o.profit), 0)

      monthlyData.push({
        month: format(monthDate, 'MMM/yyyy', { locale: ptBR }),
        faturamento,
        custo,
        lucro,
      })
    }

    const clientTotals: Record
      number,
      { id: number; name: string; total: number; orders: number }
    > = {}

    orders.forEach(order => {
      const clientId = order.client.id
      if (!clientTotals[clientId]) {
        clientTotals[clientId] = {
          id: clientId,
          name: order.client.name,
          total: 0,
          orders: 0,
        }
      }
      clientTotals[clientId].total += Number(order.totalValue)
      clientTotals[clientId].orders += 1
    })

    const topClients = Object.values(clientTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((c, i) => ({ rank: i + 1, ...c }))

    const allOrders = await prisma.order.findMany({
      select: {
        totalValue: true,
        createdAt: true,
      },
    })

    const monthTotals: Record<string, { month: string; faturamento: number }> = {}

    allOrders.forEach(order => {
      const monthKey = format(new Date(order.createdAt), 'MMM/yyyy', { locale: ptBR })
      if (!monthTotals[monthKey]) {
        monthTotals[monthKey] = { month: monthKey, faturamento: 0 }
      }
      monthTotals[monthKey].faturamento += Number(order.totalValue)
    })

    const bestMonths = Object.values(monthTotals)
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 8)

    return NextResponse.json({
      summary: {
        total_sales: totalSales,
        total_supplier_cost: totalSupplierCost,
        total_shipping_cost: totalShippingCost,
        total_profit: totalProfit,
        total_orders: orders.length,
        margin_pct: marginPct,
      },
      monthly: monthlyData,
      top_clients: topClients,
      best_months: bestMonths,
    })
  } catch (error) {
    console.error('[GET /api/financeiro]', error)
    return NextResponse.json({ error: 'Erro ao buscar dados financeiros' }, { status: 500 })
  }
}