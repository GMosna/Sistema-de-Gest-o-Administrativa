import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

// Build a WHERE clause string + params array for a given period.
// Returns { clause: string, params: unknown[] } where clause uses $1, $2...
function buildDateFilter(
  period: string,
  monthParam: string | null,
  yearParam: string | null,
): { clause: string; params: unknown[] } {
  if (period === 'week') {
    return { clause: `WHERE created_at >= date_trunc('week', NOW())`, params: [] }
  }
  if (period === 'month') {
    return {
      clause: `WHERE date_trunc('month', created_at) = date_trunc('month', NOW())`,
      params: [],
    }
  }
  if (period === 'quarter') {
    return { clause: `WHERE created_at >= NOW() - INTERVAL '3 months'`, params: [] }
  }
  if (period === 'year') {
    return {
      clause: `WHERE date_trunc('year', created_at) = date_trunc('year', NOW())`,
      params: [],
    }
  }
  if (period === 'custom' && monthParam) {
    return {
      clause: `WHERE date_trunc('month', created_at) = date_trunc('month', $1::date)`,
      params: [monthParam + '-01'],
    }
  }
  if (period === 'custom_year' && yearParam) {
    return {
      clause: `WHERE EXTRACT(year FROM created_at) = $1`,
      params: [Number(yearParam)],
    }
  }
  return { clause: '', params: [] }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'month'
  const monthParam = searchParams.get('month')
  const yearParam = searchParams.get('year')

  const db = neon(process.env.DATABASE_URL!)
  const { clause, params } = buildDateFilter(period, monthParam, yearParam)

  try {
    // Summary totals – uses dynamic WHERE via raw query
    const totalsQuery = await db(
      `SELECT
        COALESCE(SUM(total_value), 0)    AS total_sales,
        COALESCE(SUM(supplier_cost), 0)  AS total_supplier_cost,
        COALESCE(SUM(shipping_cost), 0)  AS total_shipping_cost,
        COALESCE(SUM(profit), 0)         AS total_profit,
        COUNT(*)                          AS total_orders
      FROM orders
      ${clause}`,
      params,
    )

    // Monthly evolution – last 12 months fixed, no dynamic params
    const monthly = await db(
      `SELECT
        TO_CHAR(date_trunc('month', created_at), 'Mon/YYYY') AS month,
        date_trunc('month', created_at)                       AS month_date,
        COALESCE(SUM(total_value), 0)                         AS faturamento,
        COALESCE(SUM(supplier_cost) + SUM(shipping_cost), 0)  AS custo,
        COALESCE(SUM(profit), 0)                              AS lucro
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY month_date ASC`,
    )

    // Top clients with dynamic date filter – offset params after dateFilter params
    const topClientsClause = clause.replace(/created_at/g, 'o.created_at')
    const topClients = await db(
      `SELECT
        c.id,
        c.name,
        COALESCE(SUM(o.total_value), 0) AS total_comprado,
        COUNT(o.id)                       AS total_pedidos
      FROM clients c
      JOIN orders o ON o.client_id = c.id
      ${topClientsClause}
      GROUP BY c.id, c.name
      ORDER BY total_comprado DESC
      LIMIT 8`,
      params,
    )

    // Best months all-time – no params
    const bestMonths = await db(
      `SELECT
        TO_CHAR(date_trunc('month', created_at), 'Mon/YYYY') AS month,
        date_trunc('month', created_at)                       AS month_date,
        COALESCE(SUM(total_value), 0)                         AS faturamento
      FROM orders
      GROUP BY date_trunc('month', created_at)
      ORDER BY faturamento DESC
      LIMIT 8`,
    )

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
      monthly: monthly.map((r: Record<string, unknown>) => ({
        month: r.month as string,
        faturamento: Number(r.faturamento),
        custo: Number(r.custo),
        lucro: Number(r.lucro),
      })),
      top_clients: topClients.map((c: Record<string, unknown>, i: number) => ({
        rank: i + 1,
        id: c.id,
        name: c.name,
        total: Number(c.total_comprado),
        orders: Number(c.total_pedidos),
      })),
      best_months: bestMonths.map((r: Record<string, unknown>) => ({
        month: r.month as string,
        faturamento: Number(r.faturamento),
      })),
    })
  } catch (error) {
    console.error('[financeiro]', error)
    return NextResponse.json({ error: 'Erro ao buscar dados financeiros' }, { status: 500 })
  }
}

