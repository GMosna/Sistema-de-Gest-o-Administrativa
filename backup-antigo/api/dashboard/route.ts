import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  try {
    const [totals] = await sql`
      SELECT
        COALESCE(SUM(total_value), 0) AS total_sales,
        COUNT(*) AS total_orders,
        COALESCE(SUM(supplier_cost), 0) AS total_supplier_cost,
        COALESCE(SUM(shipping_cost), 0) AS total_shipping_cost,
        COALESCE(SUM(profit), 0) AS total_profit
      FROM orders
    `
    const [pending] = await sql`
      SELECT COALESCE(SUM(value), 0) AS total_pending
      FROM installments
      WHERE status = 'pending'
    `
    const [overdue] = await sql`
      SELECT
        COUNT(*) AS overdue_count,
        COALESCE(SUM(value), 0) AS overdue_value
      FROM installments
      WHERE status = 'pending' AND due_date < CURRENT_DATE
    `
    const recent = await sql`
      SELECT o.id, o.total_value, o.payment_method, o.status, o.created_at, c.name AS client_name
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      ORDER BY o.created_at DESC
      LIMIT 8
    `

    return NextResponse.json({
      total_sales: Number(totals.total_sales),
      total_orders: Number(totals.total_orders),
      total_supplier_cost: Number(totals.total_supplier_cost),
      total_shipping_cost: Number(totals.total_shipping_cost),
      total_profit: Number(totals.total_profit),
      total_pending: Number(pending.total_pending),
      overdue_count: Number(overdue.overdue_count),
      overdue_value: Number(overdue.overdue_value),
      recent_orders: recent,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
