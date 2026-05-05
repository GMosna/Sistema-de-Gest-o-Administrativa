import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const clientIdParam = searchParams.get('client_id')

    const where = clientIdParam ? { clientId: parseInt(clientIdParam) } : {}

    const installments = await prisma.installment.findMany({
      where,
      include: {
        order: { select: { createdAt: true, supplierName: true } },
        client: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json(
      installments.map((i) => ({
        id: i.id,
        order_id: i.orderId,
        client_id: i.clientId,
        installment_number: i.installmentNumber,
        total_installments: i.totalInstallments,
        value: Number(i.value),
        due_date: i.dueDate.toISOString().split('T')[0],
        status: i.status,
        paid_at: i.paidAt,
        created_at: i.createdAt,
        client_name: i.client?.name ?? null,
        order_created_at: i.order.createdAt,
        supplier_name: i.order.supplierName,
      })),
    )
  } catch (error) {
    console.error('[GET /api/installments]', error)
    return NextResponse.json({ error: 'Erro ao buscar parcelas' }, { status: 500 })
  }
}
