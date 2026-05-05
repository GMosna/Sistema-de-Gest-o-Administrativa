import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─── Serializers ─────────────────────────────────────────────────────────────

function serializeItem(i: {
  id: number; orderId: number; productCode: string; productName: string
  size: string | null; color: string | null; price: unknown; quantity: number
  commission: unknown; shipping: unknown
}) {
  return {
    id: i.id,
    order_id: i.orderId,
    product_code: i.productCode,
    product_name: i.productName,
    size: i.size,
    color: i.color,
    price: Number(i.price),
    quantity: i.quantity,
    commission: Number(i.commission),
    shipping: Number(i.shipping),
  }
}

function serializeOrder(o: {
  id: number; clientId: number; totalValue: unknown; paymentMethod: string
  pixKey: string | null; status: string; supplierName: string | null
  supplierCost: unknown; shippingCost: unknown; profit: unknown; createdAt: Date
  client?: { name: string }; items?: Parameters<typeof serializeItem>[0][]
}) {
  return {
    id: o.id,
    client_id: o.clientId,
    client_name: o.client?.name ?? null,
    total_value: Number(o.totalValue),
    payment_method: o.paymentMethod,
    pix_key: o.pixKey,
    status: o.status,
    supplier_name: o.supplierName,
    supplier_cost: Number(o.supplierCost),
    shipping_cost: Number(o.shippingCost),
    profit: Number(o.profit),
    created_at: o.createdAt.toISOString(),
    items: o.items?.map(serializeItem) ?? [],
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        client: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders.map(serializeOrder))
  } catch (error) {
    console.error('[GET /api/orders]', error)
    return NextResponse.json({ error: 'Erro ao buscar pedidos' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const {
      client_id,
      items,
      payment_method,
      pix_key,
      installments_data,
      supplier_name,
      supplier_cost,
      shipping_cost,
      order_shipping,
    } = await req.json()

    if (!client_id) {
      return NextResponse.json({ error: 'Cliente é obrigatório' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Pelo menos um item é obrigatório' }, { status: 400 })
    }
    if (!payment_method || !['pix', 'cash', 'installments'].includes(payment_method)) {
      return NextResponse.json({ error: 'Método de pagamento inválido' }, { status: 400 })
    }

    const orderShipping = Number(order_shipping) || 0
    const totalValue =
      items.reduce(
        (sum: number, item: { price: number; quantity: number }) =>
          sum + Number(item.price) * Number(item.quantity),
        0,
      ) + orderShipping

    const supplierCostValue = Number(supplier_cost) || 0
    const shippingCostValue = Number(shipping_cost) || 0
    const profitValue = totalValue - supplierCostValue - shippingCostValue

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          clientId: parseInt(client_id),
          totalValue,
          paymentMethod: payment_method,
          pixKey: pix_key?.trim() || null,
          status: 'pending',
          supplierName: supplier_name?.trim() || null,
          supplierCost: supplierCostValue,
          shippingCost: shippingCostValue,
          profit: profitValue,
        },
        include: { items: true },
      })

      await tx.orderItem.createMany({
        data: items.map((item: {
          product_code: string; product_name: string; size?: string
          color?: string; price: number; quantity: number; commission?: number; shipping?: number
        }) => ({
          orderId: newOrder.id,
          productCode: item.product_code,
          productName: item.product_name,
          size: item.size?.trim() || null,
          color: item.color?.trim() || null,
          price: Number(item.price),
          quantity: Number(item.quantity),
          commission: Number(item.commission) || 0,
          shipping: Number(item.shipping) || 0,
        })),
      })

      if (payment_method === 'installments' && Array.isArray(installments_data) && installments_data.length > 0) {
        await tx.installment.createMany({
          data: installments_data.map((inst: { value: number; due_date: string }, index: number) => ({
            orderId: newOrder.id,
            clientId: parseInt(client_id),
            installmentNumber: index + 1,
            totalInstallments: installments_data.length,
            value: Number(inst.value),
            dueDate: new Date(inst.due_date),
            status: 'pending',
          })),
        })
      }

      return newOrder
    })

    return NextResponse.json(serializeOrder(order), { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/orders]', error)
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2003') {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
  }
}
