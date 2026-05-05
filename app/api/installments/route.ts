import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const installmentId = parseInt(id)

    if (isNaN(installmentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { status } = await req.json()

    if (!status || !['pending', 'paid'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    const paidAt = status === 'paid' ? new Date() : null

    const installment = await prisma.installment.update({
      where: { id: installmentId },
      data: {
        status,
        paidAt,
      },
    })

    return NextResponse.json(installment)
  } catch (error: any) {
    console.error('[PUT /api/installments/:id]', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Erro ao atualizar parcela' }, { status: 500 })
  }
}