import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: { select: { name: true } },
        items: true,
        installments: { orderBy: { dueDate: 'asc' } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      id: order.id,
      client_id: order.clientId,
      client_name: order.client.name,
      total_value: Number(order.totalValue),
      payment_method: order.paymentMethod,
      pix_key: order.pixKey,
      status: order.status,
      supplier_name: order.supplierName,
      supplier_cost: Number(order.supplierCost),
      shipping_cost: Number(order.shippingCost),
      profit: Number(order.profit),
      created_at: order.createdAt,
      items: order.items.map((i) => ({
        id: i.id,
        order_id: i.orderId,
        product_code: i.productCode,
        product_name: i.productName,
        size: i.size,
        color: i.color,
        price: Number(i.price),
        quantity: i.quantity,
        commission: Number(i.commission),
      })),
      installments: order.installments.map((i) => ({
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
      })),
    })
  } catch (error) {
    console.error('[GET /api/orders/:id]', error)
    return NextResponse.json({ error: 'Erro ao buscar pedido' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { status } = await req.json()
    if (!status || !['pending', 'paid', 'partial', 'delivered'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    })

    return NextResponse.json({
      id: order.id,
      client_id: order.clientId,
      total_value: Number(order.totalValue),
      payment_method: order.paymentMethod,
      pix_key: order.pixKey,
      status: order.status,
      supplier_name: order.supplierName,
      supplier_cost: Number(order.supplierCost),
      shipping_cost: Number(order.shippingCost),
      profit: Number(order.profit),
      created_at: order.createdAt,
    })
  } catch (error: unknown) {
    console.error('[PUT /api/orders/:id]', error)
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar pedido' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    await prisma.order.delete({ where: { id: orderId } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[DELETE /api/orders/:id]', error)
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao deletar pedido' }, { status: 500 })
  }
}
