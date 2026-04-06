import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('client_id')

    const installments = clientId
      ? await sql`
          SELECT
            i.*,
            c.name AS client_name,
            o.created_at AS order_created_at,
            ROW_NUMBER() OVER (PARTITION BY i.order_id ORDER BY i.due_date ASC) AS installment_number,
            COUNT(*) OVER (PARTITION BY i.order_id) AS total_installments
          FROM installments i
          JOIN orders o ON o.id = i.order_id
          JOIN clients c ON c.id = o.client_id
          WHERE o.client_id = ${clientId}
          ORDER BY i.due_date ASC
        `
      : await sql`
          SELECT
            i.*,
            c.name AS client_name,
            o.created_at AS order_created_at,
            ROW_NUMBER() OVER (PARTITION BY i.order_id ORDER BY i.due_date ASC) AS installment_number,
            COUNT(*) OVER (PARTITION BY i.order_id) AS total_installments
          FROM installments i
          JOIN orders o ON o.id = i.order_id
          JOIN clients c ON c.id = o.client_id
          ORDER BY i.due_date ASC
        `

    return NextResponse.json(installments)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar parcelas' }, { status: 500 })
  }
}
