import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status } = await req.json()
    const paid_at = status === 'paid' ? new Date().toISOString() : null
    const [installment] = await sql`
      UPDATE installments SET status = ${status}, paid_at = ${paid_at}
      WHERE id = ${id} RETURNING *
    `
    return NextResponse.json(installment)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar parcela' }, { status: 500 })
  }
}
