import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Buscar totais dos pedidos
    const ordersAgg = await prisma.order.aggregate({
      _sum: {
        totalValue: true,
        supplierCost: true,
        shippingCost: true,
        profit: true,
      },
      _count: true,
    })

    // Buscar total de parcelas pendentes
    const installmentsAgg = await prisma.installment.aggregate({
      where: {
        status: 'pending',
      },
      _sum: {
        value: true,
      },
    })

    // Buscar parcelas atrasadas
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueInstallments = await prisma.installment.findMany({
      where: {
        status: 'pending',
        dueDate: {
          lt: today,
        },
      },
    })

    const overdueCount = overdueInstallments.length
    const overdueValue = overdueInstallments.reduce(
      (sum, inst) => sum + Number(inst.value),
      0
    )

    // Buscar pedidos recentes (últimos 8)
    const recentOrders = await prisma.order.findMany({
      take: 8,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        client: {
          select: {
            name: true,
          },
        },
      },
    })

    const recentOrdersFormatted = recentOrders.map(order => ({
      id: order.id,
      total_value: Number(order.totalValue),
      payment_method: order.paymentMethod,
      status: order.status,
      created_at: order.createdAt.toISOString(),
      client_name: order.client.name,
    }))

    return NextResponse.json({
      total_sales: Number(ordersAgg._sum.totalValue) || 0,
      total_orders: ordersAgg._count || 0,
      total_supplier_cost: Number(ordersAgg._sum.supplierCost) || 0,
      total_shipping_cost: Number(ordersAgg._sum.shippingCost) || 0,
      total_profit: Number(ordersAgg._sum.profit) || 0,
      total_pending: Number(installmentsAgg._sum.value) || 0,
      overdue_count: overdueCount,
      overdue_value: overdueValue,
      recent_orders: recentOrdersFormatted,
    })
  } catch (error) {
    console.error('[GET /api/dashboard]', error)
    return NextResponse.json({ error: 'Erro ao buscar dados do dashboard' }, { status: 500 })
  }
}