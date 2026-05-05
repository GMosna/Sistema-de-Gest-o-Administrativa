import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        client: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      orders.map((o) => ({
        id: o.id,
        client_id: o.clientId,
        client_name: o.client.name,
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
    )
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

    if (!client_id || !items?.length) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const orderShipping = Number(order_shipping) || 0
    const total_value =
      items.reduce(
        (sum: number, item: { price: number; quantity: number }) =>
          sum + item.price * item.quantity,
        0,
      ) + orderShipping

    const supplierCost = Number(supplier_cost) || 0
    const shippingCost = Number(shipping_cost) || 0
    const profit = total_value - supplierCost - shippingCost

    const order = await prisma.order.create({
      data: {
        clientId: Number(client_id),
        totalValue: total_value,
        paymentMethod: payment_method,
        pixKey: pix_key || null,
        status: 'pending',
        supplierName: supplier_name?.trim() || null,
        supplierCost,
        shippingCost,
        profit,
        items: {
          create: items.map(
            (item: {
              product_code: string
              product_name: string
              size?: string
              color?: string
              price: number
              quantity: number
              commission?: number
            }) => ({
              productCode: item.product_code,
              productName: item.product_name,
              size: item.size || null,
              color: item.color || null,
              price: item.price,
              quantity: item.quantity,
              commission: item.commission || 0,
            }),
          ),
        },
      },
      include: { items: true },
    })

    if (payment_method === 'installments' && installments_data?.length) {
      const total = installments_data.length
      for (let idx = 0; idx < installments_data.length; idx++) {
        const inst = installments_data[idx]
        await prisma.installment.create({
          data: {
            orderId: order.id,
            clientId: Number(client_id),
            installmentNumber: idx + 1,
            totalInstallments: total,
            value: inst.value,
            dueDate: new Date(inst.due_date),
            status: 'pending',
          },
        })
      }
    }

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/orders]', error)
    return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
  }
}
