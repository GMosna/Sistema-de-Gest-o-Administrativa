import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [client] = await sql`SELECT * FROM clients WHERE id = ${id}`
    if (!client) return NextResponse.json({ error: 'Cliente nao encontrado' }, { status: 404 })

    const orders = await sql`
      SELECT o.*, 
        COALESCE(json_agg(oi.*) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.client_id = ${id}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `

    const installments = await sql`
      SELECT i.* FROM installments i
      JOIN orders o ON o.id = i.order_id
      WHERE o.client_id = ${id}
      ORDER BY i.due_date ASC
    `

    const totalDebt = (installments as Array<{ status: string; value: number }>)
      .filter(i => i.status === 'pending')
      .reduce((sum, i) => sum + Number(i.value), 0)

    return NextResponse.json({ client, orders, installments, totalDebt })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar cliente' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, phone, notes } = await req.json()
    const [client] = await sql`
      UPDATE clients SET name = ${name}, phone = ${phone || null}, notes = ${notes || null}
      WHERE id = ${id} RETURNING *
    `
    return NextResponse.json(client)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await sql`DELETE FROM clients WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar cliente' }, { status: 500 })
  }
}
