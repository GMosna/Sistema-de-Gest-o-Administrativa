import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [order] = await sql`
      SELECT o.*, c.name AS client_name
      FROM orders o JOIN clients c ON c.id = o.client_id
      WHERE o.id = ${id}
    `
    if (!order) return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 })

    const items = await sql`SELECT * FROM order_items WHERE order_id = ${id}`
    const installments = await sql`SELECT * FROM installments WHERE order_id = ${id} ORDER BY due_date ASC`

    return NextResponse.json({ ...order, items, installments })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar pedido' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status } = await req.json()
    const [order] = await sql`UPDATE orders SET status = ${status} WHERE id = ${id} RETURNING *`
    return NextResponse.json(order)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar pedido' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await sql`DELETE FROM orders WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar pedido' }, { status: 500 })
  }
}
