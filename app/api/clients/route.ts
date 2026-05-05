import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        installments: { where: { status: 'pending' } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: c.notes,
        created_at: c.createdAt.toISOString(),
        total_debt: c.installments.reduce((sum, i) => sum + Number(i.value), 0),
      })),
    )
  } catch (error) {
    console.error('[GET /api/clients]', error)
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { name, phone, notes, email, address } = await req.json()

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    })

    return NextResponse.json(
      {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        address: client.address,
        notes: client.notes,
        created_at: client.createdAt.toISOString(),
        total_debt: 0,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/clients]', error)
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
  }
}
