import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  await prisma.installment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.client.deleteMany()

  const ana = await prisma.client.create({
    data: {
      name: 'Ana Paula Ferreira',
      phone: '(11) 99234-5678',
      email: 'ana@email.com',
      address: 'Rua das Flores, 142 - SP',
      notes: 'Cliente VIP',
    },
  })

  const carlos = await prisma.client.create({
    data: {
      name: 'Carlos Henrique Lima',
      phone: '(21) 98765-4321',
    },
  })

  const mariana = await prisma.client.create({
    data: {
      name: 'Mariana Souza Costa',
      phone: '(31) 97654-3210',
      email: 'mari@email.com',
      address: 'BH/MG',
      notes: 'Paga sempre no PIX',
    },
  })

  await prisma.order.create({
    data: {
      clientId: ana.id,
      totalValue: 450,
      paymentMethod: 'pix',
      pixKey: 'ana@email.com',
      status: 'paid',
      supplierName: 'Atacado Moda Brasil',
      supplierCost: 280,
      shippingCost: 35,
      profit: 135,
      items: {
        create: [
          {
            productCode: 'CAM-001',
            productName: 'Camiseta Basica',
            size: 'M',
            color: 'Branco',
            price: 75,
            quantity: 2,
          },
          {
            productCode: 'CAL-003',
            productName: 'Calca Jeans',
            size: '40',
            color: 'Azul',
            price: 150,
            quantity: 2,
          },
        ],
      },
    },
  })

  const today = new Date()
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
  const in27Days = new Date(today.getTime() + 27 * 24 * 60 * 60 * 1000)

  await prisma.order.create({
    data: {
      clientId: mariana.id,
      totalValue: 215,
      paymentMethod: 'installments',
      status: 'pending',
      supplierName: 'Fornecedor Silva',
      supplierCost: 130,
      shippingCost: 18,
      profit: 67,
      items: {
        create: [
          {
            productCode: 'BLU-007',
            productName: 'Blusa Floral',
            size: 'P',
            color: 'Rosa',
            price: 80,
            quantity: 2,
          },
          {
            productCode: 'SAI-012',
            productName: 'Saia Midi',
            size: 'M',
            color: 'Preto',
            price: 120,
            quantity: 1,
          },
        ],
      },
      installments: {
        create: [
          {
            clientId: mariana.id,
            installmentNumber: 1,
            totalInstallments: 2,
            value: 107.5,
            dueDate: threeDaysAgo,
            status: 'pending',
          },
          {
            clientId: mariana.id,
            installmentNumber: 2,
            totalInstallments: 2,
            value: 107.5,
            dueDate: in27Days,
            status: 'pending',
          },
        ],
      },
    },
  })

  // suppress unused variable warning
  void carlos

  console.log('✅ Seed concluído!')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
