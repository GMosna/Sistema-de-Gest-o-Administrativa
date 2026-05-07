import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('client_id')

    const parsedClientId = clientId ? parseInt(clientId) : null
    if (parsedClientId !== null && isNaN(parsedClientId)) {
      return NextResponse.json({ error: 'client_id inválido' }, { status: 400 })
    }

    const installments = await prisma.installment.findMany({
      where: parsedClientId ? { clientId: parsedClientId } : undefined,
      include: {
        client: { select: { name: true } },
        order: { select: { id: true, paymentMethod: true, supplierName: true, createdAt: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json(
      installments.map((i) => ({
        id: i.id,
        order_id: i.orderId,
        client_id: i.clientId,
        client_name: i.client?.name ?? null,
        installment_number: i.installmentNumber,
        total_installments: i.totalInstallments,
        value: Number(i.value),
        due_date: i.dueDate.toISOString().split('T')[0],
        status: i.status,
        paid_at: i.paidAt,
        created_at: i.createdAt,
        supplier_name: i.order?.supplierName ?? null,
        order_created_at: i.order?.createdAt?.toISOString() ?? null,
      }))
    )
  } catch (error) {
    console.error('[GET /api/installments]', error)
    return NextResponse.json({ error: 'Erro ao buscar parcelas' }, { status: 500 })
  }
}
