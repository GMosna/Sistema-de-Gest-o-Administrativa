import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const clientId = parseInt(id)
    if (isNaN(clientId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const orders = await prisma.order.findMany({
      where: { clientId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })

    const installments = await prisma.installment.findMany({
      where: { clientId },
      orderBy: { dueDate: 'asc' },
    })

    const totalDebt = installments
      .filter((i) => i.status === 'pending')
      .reduce((sum, i) => sum + Number(i.value), 0)

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        address: client.address,
        notes: client.notes,
        created_at: client.createdAt,
      },
      orders: orders.map((o) => ({
        id: o.id,
        client_id: o.clientId,
        total_value: Number(o.totalValue),
        payment_method: o.paymentMethod,
        pix_key: o.pixKey,
        status: o.status,
        supplier_name: o.supplierName,
        supplier_cost: Number(o.supplierCost),
        shipping_cost: Number(o.shippingCost),
        profit: Number(o.profit),
        created_at: o.createdAt,
        items: o.items.map((i) => ({
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
      })),
      installments: installments.map((i) => ({
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
      totalDebt,
    })
  } catch (error) {
    console.error('[GET /api/clients/:id]', error)
    return NextResponse.json({ error: 'Erro ao buscar cliente' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const clientId = parseInt(id)
    if (isNaN(clientId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { name, phone, notes, email, address } = await req.json()
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    })

    return NextResponse.json({
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      address: client.address,
      notes: client.notes,
      created_at: client.createdAt,
    })
  } catch (error: unknown) {
    console.error('[PUT /api/clients/:id]', error)
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const clientId = parseInt(id)
    if (isNaN(clientId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const ordersCount = await prisma.order.count({ where: { clientId } })
    if (ordersCount > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar cliente com pedidos associados' },
        { status: 400 },
      )
    }

    await prisma.client.delete({ where: { id: clientId } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[DELETE /api/clients/:id]', error)
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao deletar cliente' }, { status: 500 })
  }
}
