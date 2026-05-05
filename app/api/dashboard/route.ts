import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const totals = await prisma.order.aggregate({
      _sum: {
        totalValue: true,
        supplierCost: true,
        shippingCost: true,
        profit: true,
      },
      _count: { id: true },
    })

    const pendingAgg = await prisma.installment.aggregate({
      where: { status: 'pending' },
      _sum: { value: true },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueAgg = await prisma.installment.aggregate({
      where: { status: 'pending', dueDate: { lt: today } },
      _sum: { value: true },
      _count: { id: true },
    })

    const recentOrders = await prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { name: true } } },
    })

    return NextResponse.json({
      total_sales: Number(totals._sum.totalValue ?? 0),
      total_orders: totals._count.id,
      total_supplier_cost: Number(totals._sum.supplierCost ?? 0),
      total_shipping_cost: Number(totals._sum.shippingCost ?? 0),
      total_profit: Number(totals._sum.profit ?? 0),
      total_pending: Number(pendingAgg._sum.value ?? 0),
      overdue_count: overdueAgg._count.id,
      overdue_value: Number(overdueAgg._sum.value ?? 0),
      recent_orders: recentOrders.map((o) => ({
        id: o.id,
        total_value: Number(o.totalValue),
        payment_method: o.paymentMethod,
        status: o.status,
        created_at: o.createdAt,
        client_name: o.client.name,
      })),
    })
  } catch (error) {
    console.error('[GET /api/dashboard]', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
