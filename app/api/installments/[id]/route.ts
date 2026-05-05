import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const installmentId = parseInt(id)

    if (isNaN(installmentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { status } = await req.json()
    const paidAt = status === 'paid' ? new Date() : null

    const installment = await prisma.installment.update({
      where: { id: installmentId },
      data: { status, paidAt },
    })

    return NextResponse.json({
      id: installment.id,
      order_id: installment.orderId,
      client_id: installment.clientId,
      installment_number: installment.installmentNumber,
      total_installments: installment.totalInstallments,
      value: Number(installment.value),
      due_date: installment.dueDate.toISOString().split('T')[0],
      status: installment.status,
      paid_at: installment.paidAt,
      created_at: installment.createdAt,
    })
  } catch (error) {
    console.error('[PUT /api/installments/:id]', error)
    return NextResponse.json({ error: 'Erro ao atualizar parcela' }, { status: 500 })
  }
}
