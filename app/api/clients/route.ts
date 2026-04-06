import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  try {
    const clients = await sql`
      SELECT
        c.*,
        COALESCE(SUM(i.value) FILTER (WHERE i.status = 'pending'), 0) AS total_debt
      FROM clients c
      LEFT JOIN orders o ON o.client_id = c.id
      LEFT JOIN installments i ON i.order_id = o.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `
    return NextResponse.json(clients)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { name, phone, notes } = await req.json()
    if (!name) return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 })
    const [client] = await sql`
      INSERT INTO clients (name, phone, notes)
      VALUES (${name}, ${phone || null}, ${notes || null})
      RETURNING *
    `
    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
  }
}
