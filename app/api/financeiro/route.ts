import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'month'
  const monthParam = searchParams.get('month') // YYYY-MM
  const yearParam = searchParams.get('year')

  // Build date filter
  let dateFilter = sql``
  if (period === 'week') {
    dateFilter = sql`WHERE created_at >= date_trunc('week', NOW())`
  } else if (period === 'month') {
    dateFilter = sql`WHERE date_trunc('month', created_at) = date_trunc('month', NOW())`
  } else if (period === 'quarter') {
    dateFilter = sql`WHERE created_at >= NOW() - INTERVAL '3 months'`
  } else if (period === 'year') {
    dateFilter = sql`WHERE date_trunc('year', created_at) = date_trunc('year', NOW())`
  } else if (period === 'custom' && monthParam) {
    dateFilter = sql`WHERE date_trunc('month', created_at) = date_trunc('month', ${monthParam + '-01'}::date)`
  } else if (period === 'custom_year' && yearParam) {
    dateFilter = sql`WHERE EXTRACT(year FROM created_at) = ${Number(yearParam)}`
  }

  try {
    // Summary totals
    const totalsQuery = await sql`
      SELECT
        COALESCE(SUM(total_value), 0)    AS total_sales,
        COALESCE(SUM(supplier_cost), 0)  AS total_supplier_cost,
        COALESCE(SUM(shipping_cost), 0)  AS total_shipping_cost,
        COALESCE(SUM(profit), 0)         AS total_profit,
        COUNT(*)                          AS total_orders
      FROM orders
      ${dateFilter}
    `

    // Monthly evolution (last 12 months always, or filtered year)
    const monthly = await sql`
      SELECT
        TO_CHAR(date_trunc('month', created_at), 'Mon/YYYY') AS month,
        date_trunc('month', created_at)                       AS month_date,
        COALESCE(SUM(total_value), 0)                         AS faturamento,
        COALESCE(SUM(supplier_cost) + SUM(shipping_cost), 0)  AS custo,
        COALESCE(SUM(profit), 0)                              AS lucro
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY month_date ASC
    `

    // Top clients
    const topClients = await sql`
      SELECT
        c.id,
        c.name,
        COALESCE(SUM(o.total_value), 0) AS total_comprado,
        COUNT(o.id)                       AS total_pedidos
      FROM clients c
      JOIN orders o ON o.client_id = c.id
      ${dateFilter}
      GROUP BY c.id, c.name
      ORDER BY total_comprado DESC
      LIMIT 8
    `

    // Best month (all time)
    const bestMonths = await sql`
      SELECT
        TO_CHAR(date_trunc('month', created_at), 'Mon/YYYY') AS month,
        date_trunc('month', created_at)                       AS month_date,
        COALESCE(SUM(total_value), 0)                         AS faturamento
      FROM orders
      GROUP BY date_trunc('month', created_at)
      ORDER BY faturamento DESC
      LIMIT 8
    `

    const totals = totalsQuery[0]
    const totalSales = Number(totals.total_sales)
    const totalProfit = Number(totals.total_profit)
    const margin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0

    return NextResponse.json({
      summary: {
        total_sales: totalSales,
        total_supplier_cost: Number(totals.total_supplier_cost),
        total_shipping_cost: Number(totals.total_shipping_cost),
        total_profit: totalProfit,
        total_orders: Number(totals.total_orders),
        margin_pct: margin,
      },
      monthly: monthly.map(r => ({
        month: r.month as string,
        faturamento: Number(r.faturamento),
        custo: Number(r.custo),
        lucro: Number(r.lucro),
      })),
      top_clients: topClients.map((c, i) => ({
        rank: i + 1,
        id: c.id,
        name: c.name,
        total: Number(c.total_comprado),
        orders: Number(c.total_pedidos),
      })),
      best_months: bestMonths.map(r => ({
        month: r.month as string,
        faturamento: Number(r.faturamento),
      })),
    })
  } catch (error) {
    console.error('[financeiro]', error)
    return NextResponse.json({ error: 'Erro ao buscar dados financeiros' }, { status: 500 })
  }
}
