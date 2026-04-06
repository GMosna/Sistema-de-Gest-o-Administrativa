import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  try {
    const orders = await sql`
      SELECT o.*, c.name AS client_name,
        COALESCE(json_agg(oi.*) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, c.name
      ORDER BY o.created_at DESC
    `
    return NextResponse.json(orders)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar pedidos' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { client_id, items, payment_method, pix_key, installments_data, supplier_cost, shipping_cost } = await req.json()

    if (!client_id || !items?.length) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const total_value = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0,
    )

    const supplierCost = Number(supplier_cost) || 0
    const shippingCost = Number(shipping_cost) || 0

    const [order] = await sql`
      INSERT INTO orders (client_id, total_value, payment_method, pix_key, status, supplier_cost, shipping_cost)
      VALUES (${client_id}, ${total_value}, ${payment_method}, ${pix_key || null}, 'pending', ${supplierCost}, ${shippingCost})
      RETURNING *
    `

    for (const item of items) {
      await sql`
        INSERT INTO order_items (order_id, product_code, product_name, size, color, price, quantity)
        VALUES (${order.id}, ${item.product_code}, ${item.product_name}, ${item.size || null}, ${item.color || null}, ${item.price}, ${item.quantity})
      `
    }

    if (payment_method === 'installments' && installments_data?.length) {
      for (const inst of installments_data) {
        await sql`
          INSERT INTO installments (order_id, value, due_date)
          VALUES (${order.id}, ${inst.value}, ${inst.due_date})
        `
      }
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
  }
}
