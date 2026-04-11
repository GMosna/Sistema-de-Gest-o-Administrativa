// Mock de banco de dados em memória — sem DATABASE_URL necessário
// Os dados ficam salvos enquanto o servidor de preview estiver rodando.

import { addMonths, format, subDays, addDays } from 'date-fns'

// ─── Tipos internos ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>

interface MockDB {
  clients: Row[]
  orders: Row[]
  order_items: Row[]
  installments: Row[]
  _seq: { clients: number; orders: number; order_items: number; installments: number }
}

// ─── Estado global (sobrevive entre requisições no mesmo processo) ────────────

const db: MockDB = (global as Record<string, unknown>).__mockDB as MockDB ?? (() => {
  const today = new Date()
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  const data: MockDB = {
    _seq: { clients: 3, orders: 2, order_items: 5, installments: 3 },
    clients: [
      { id: 1, name: 'Ana Paula Ferreira', phone: '(11) 99234-5678', email: 'ana@email.com', address: 'Rua das Flores, 142 - SP', notes: 'Cliente VIP', total_debt: 320, created_at: new Date(today.getTime() - 86400000 * 10).toISOString() },
      { id: 2, name: 'Carlos Henrique Lima', phone: '(21) 98765-4321', email: null, address: null, notes: null, total_debt: 0, created_at: new Date(today.getTime() - 86400000 * 5).toISOString() },
      { id: 3, name: 'Mariana Souza Costa', phone: '(31) 97654-3210', email: 'mari@email.com', address: 'BH/MG', notes: 'Paga sempre no PIX', total_debt: 107.5, created_at: new Date(today.getTime() - 86400000 * 2).toISOString() },
    ],
    orders: [
      { id: 1, client_id: 1, client_name: 'Ana Paula Ferreira', total_value: 450, payment_method: 'pix', pix_key: 'ana@email.com', status: 'paid', supplier_name: 'Atacado Moda Brasil', supplier_cost: 280, shipping_cost: 35, profit: 135, created_at: new Date(today.getTime() - 86400000 * 8).toISOString(), items: [] },
      { id: 2, client_id: 3, client_name: 'Mariana Souza Costa', total_value: 215, payment_method: 'installments', pix_key: null, status: 'pending', supplier_name: 'Fornecedor Silva', supplier_cost: 130, shipping_cost: 18, profit: 67, created_at: new Date(today.getTime() - 86400000 * 3).toISOString(), items: [] },
    ],
    order_items: [
      { id: 1, order_id: 1, product_code: 'CAM-001', product_name: 'Camiseta Basica', size: 'M', color: 'Branco', price: 75, quantity: 2 },
      { id: 2, order_id: 1, product_code: 'CAL-003', product_name: 'Calca Jeans', size: '40', color: 'Azul', price: 150, quantity: 2 },
      { id: 3, order_id: 2, product_code: 'BLU-007', product_name: 'Blusa Floral', size: 'P', color: 'Rosa', price: 80, quantity: 2 },
      { id: 4, order_id: 2, product_code: 'SAI-012', product_name: 'Saia Midi', size: 'M', color: 'Preto', price: 120, quantity: 1 },
    ],
    installments: [
      { id: 1, order_id: 2, client_id: 3, installment_number: 1, value: 107.5, due_date: fmt(subDays(today, 3)), status: 'pending', paid_at: null, client_name: 'Mariana Souza Costa', order_created_at: new Date(today.getTime() - 86400000 * 3).toISOString(), total_installments: 2 },
      { id: 2, order_id: 2, client_id: 3, installment_number: 2, value: 107.5, due_date: fmt(addDays(today, 27)), status: 'pending', paid_at: null, client_name: 'Mariana Souza Costa', order_created_at: new Date(today.getTime() - 86400000 * 3).toISOString(), total_installments: 2 },
    ],
  }

  // Adicionar items dentro dos pedidos
  data.orders[0].items = data.order_items.filter(i => i.order_id === 1)
  data.orders[1].items = data.order_items.filter(i => i.order_id === 2)
  ;(global as Record<string, unknown>).__mockDB = data
  return data
})()

;(global as Record<string, unknown>).__mockDB = db

// ─── Helper: próximo ID ───────────────────────────────────────────────────────

function nextId(table: keyof MockDB['_seq']): number {
  db._seq[table] += 1
  return db._seq[table]
}

// ─── Tag template que interpreta SQL simples ─────────────────────────────────
// Não implementa SQL completo — apenas os padrões usados pelas rotas da API.

function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
  let query = ''
  strings.forEach((s, i) => {
    query += s
    if (i < values.length) query += `__p${i}__`
  })
  query = query.trim().replace(/\s+/g, ' ')

  const params: Record<string, unknown> = {}
  values.forEach((v, i) => { params[`__p${i}__`] = v })

  function resolve(val: string): unknown {
    const key = val.trim()
    return key in params ? params[key] : val
  }

  // ── SELECT de clientes com total_debt ────────────────────────────────────
  if (query.includes('total_debt') && query.includes('FROM clients')) {
    const rows = db.clients.map(c => {
      const clientOrders = db.orders.filter(o => o.client_id === c.id)
      const orderIds = clientOrders.map(o => o.id)
      const debt = db.installments
        .filter(i => orderIds.includes(i.order_id as number) && i.status === 'pending')
        .reduce((s, i) => s + Number(i.value), 0)
      return { ...c, total_debt: debt }
    }).sort((a, b) => String(a.name).localeCompare(String(b.name)))
    return Promise.resolve(rows)
  }

  // ── SELECT * FROM clients WHERE id = ? ──────────────────────────────────
  if (/SELECT \* FROM clients WHERE id/.test(query)) {
    const idVal = values[0]
    const row = db.clients.find(c => String(c.id) === String(idVal))
    return Promise.resolve(row ? [row] : [])
  }

  // ── INSERT INTO clients ──────────────────────────────────────────────────
  if (/INSERT INTO clients/.test(query)) {
    const id = nextId('clients')
    const [name, phone, notes] = values as [string, string|null, string|null]
    const row: Row = { id, name, phone: phone ?? null, notes: notes ?? null, email: null, address: null, total_debt: 0, created_at: new Date().toISOString() }
    db.clients.push(row)
    return Promise.resolve([row])
  }

  // ── UPDATE clients ───────────────────────────────────────────────────────
  if (/UPDATE clients SET/.test(query)) {
    const [name, phone, notes, id] = values as [string, string|null, string|null, string]
    const idx = db.clients.findIndex(c => String(c.id) === String(id))
    if (idx >= 0) {
      db.clients[idx] = { ...db.clients[idx], name, phone: phone ?? null, notes: notes ?? null }
      return Promise.resolve([db.clients[idx]])
    }
    return Promise.resolve([])
  }

  // ── DELETE FROM clients ──────────────────────────────────────────────────
  if (/DELETE FROM clients/.test(query)) {
    const idVal = values[0]
    db.clients = db.clients.filter(c => String(c.id) !== String(idVal))
    return Promise.resolve([])
  }

  // ── SELECT orders (lista) ────────────────────────────────────────────────
  if (/FROM orders o.*JOIN clients/.test(query) && /GROUP BY o\.id/.test(query) && !/WHERE o\.id/.test(query) && !/WHERE o\.client_id/.test(query)) {
    const rows = db.orders.map(o => ({
      ...o,
      items: db.order_items.filter(i => i.order_id === o.id),
    })).sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
    return Promise.resolve(rows)
  }

  // ── SELECT pedidos de um cliente (client detail) ─────────────────────────
  if (/FROM orders o.*WHERE o\.client_id/.test(query) && /GROUP BY o\.id/.test(query)) {
    const idVal = values[0]
    const rows = db.orders
      .filter(o => String(o.client_id) === String(idVal))
      .map(o => ({ ...o, items: db.order_items.filter(i => i.order_id === o.id) }))
      .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
    return Promise.resolve(rows)
  }

  // ── SELECT order por id ──────────────────────────────────────────────────
  if (/FROM orders o JOIN clients.*WHERE o\.id/.test(query)) {
    const idVal = values[0]
    const order = db.orders.find(o => String(o.id) === String(idVal))
    return Promise.resolve(order ? [order] : [])
  }

  // ── SELECT order_items WHERE order_id ────────────────────────────────────
  if (/SELECT \* FROM order_items WHERE order_id/.test(query)) {
    const idVal = values[0]
    return Promise.resolve(db.order_items.filter(i => String(i.order_id) === String(idVal)))
  }

  // ── SELECT installments WHERE order_id ───────────────────────────────────
  if (/SELECT \* FROM installments WHERE order_id/.test(query)) {
    const idVal = values[0]
    return Promise.resolve(db.installments.filter(i => String(i.order_id) === String(idVal)).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))))
  }

  // ── SELECT installments de um cliente (client detail) ────────────────────
  if (/FROM installments i.*WHERE o\.client_id/.test(query)) {
    const idVal = values[0]
    return Promise.resolve(db.installments.filter(i => String(i.client_id) === String(idVal)).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))))
  }

  // ── SELECT installments geral ou filtrado por client_id ──────────────────
  if (/FROM installments i.*JOIN orders.*JOIN clients/.test(query)) {
    let rows = db.installments.map(i => {
      const order = db.orders.find(o => o.id === i.order_id)
      const client = db.clients.find(c => c.id === i.client_id)
      return {
        ...i,
        client_name: client?.name ?? null,
        order_created_at: order?.created_at ?? null,
        supplier_name: order?.supplier_name ?? null,
      }
    })
    if (values.length > 0) {
      const idVal = values[0]
      rows = rows.filter(i => String(i.client_id) === String(idVal))
    }
    return Promise.resolve(rows.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))))
  }

  // ── INSERT INTO orders ────────────────────────────────────────────────────
  if (/INSERT INTO orders/.test(query)) {
    const [client_id, total_value, payment_method, pix_key, , supplier_name, supplier_cost, shipping_cost] = values
    const client = db.clients.find(c => String(c.id) === String(client_id))
    const cost = Number(supplier_cost) + Number(shipping_cost)
    const id = nextId('orders')
    const row: Row = {
      id,
      client_id: Number(client_id),
      client_name: client?.name ?? null,
      total_value: Number(total_value),
      payment_method,
      pix_key: pix_key ?? null,
      status: 'pending',
      supplier_name: supplier_name ?? null,
      supplier_cost: Number(supplier_cost),
      shipping_cost: Number(shipping_cost),
      profit: Number(total_value) - cost,
      created_at: new Date().toISOString(),
      items: [],
    }
    db.orders.push(row)
    return Promise.resolve([row])
  }

  // ── INSERT INTO order_items ───────────────────────────────────────────────
  if (/INSERT INTO order_items/.test(query)) {
    const [order_id, product_code, product_name, size, color, price, quantity, commission, item_shipping] = values
    const id = nextId('order_items')
    const row: Row = {
      id, order_id, product_code, product_name,
      size: size ?? null, color: color ?? null,
      price: Number(price), quantity: Number(quantity),
      commission: Number(commission) || 0,
      item_shipping: Number(item_shipping) || 0,
    }
    db.order_items.push(row)
    // Atualiza items dentro do pedido
    const order = db.orders.find(o => o.id === Number(order_id))
    if (order) (order.items as Row[]).push(row)
    return Promise.resolve([row])
  }

  // ── INSERT INTO installments ──────────────────────────────────────────────
  if (/INSERT INTO installments/.test(query)) {
    const [order_id, value, due_date] = values
    const order = db.orders.find(o => o.id === Number(order_id))
    const id = nextId('installments')
    const existingForOrder = db.installments.filter(i => i.order_id === Number(order_id)).length
    const total = db.installments.filter(i => i.order_id === Number(order_id)).length + 1
    const row: Row = {
      id,
      order_id: Number(order_id),
      client_id: order?.client_id ?? null,
      installment_number: existingForOrder + 1,
      value: Number(value),
      due_date,
      status: 'pending',
      paid_at: null,
      client_name: db.clients.find(c => c.id === order?.client_id)?.name ?? null,
      order_created_at: order?.created_at ?? null,
      total_installments: total,
    }
    db.installments.push(row)
    return Promise.resolve([row])
  }

  // ── UPDATE orders SET status ─────────────────────────────────────────────
  if (/UPDATE orders SET status/.test(query)) {
    const [status, id] = values
    const idx = db.orders.findIndex(o => String(o.id) === String(id))
    if (idx >= 0) {
      db.orders[idx] = { ...db.orders[idx], status }
      return Promise.resolve([db.orders[idx]])
    }
    return Promise.resolve([])
  }

  // ── DELETE FROM orders ───────────────────────────────────────────────────
  if (/DELETE FROM orders/.test(query)) {
    const idVal = values[0]
    db.orders = db.orders.filter(o => String(o.id) !== String(idVal))
    db.order_items = db.order_items.filter(i => String(i.order_id) !== String(idVal))
    db.installments = db.installments.filter(i => String(i.order_id) !== String(idVal))
    return Promise.resolve([])
  }

  // ── UPDATE installments ───────────────────────────────────────────────────
  if (/UPDATE installments SET status/.test(query)) {
    const [status, paid_at, id] = values
    const idx = db.installments.findIndex(i => String(i.id) === String(id))
    if (idx >= 0) {
      db.installments[idx] = { ...db.installments[idx], status, paid_at }
      return Promise.resolve([db.installments[idx]])
    }
    return Promise.resolve([])
  }

  // ── SELECT dashboard totals ──────────────────────────────────────────────
  if (query.includes('total_sales') && query.includes('FROM orders') && !query.includes('JOIN clients')) {
    const total_sales = db.orders.reduce((s, o) => s + Number(o.total_value), 0)
    const total_orders = db.orders.length
    const total_supplier_cost = db.orders.reduce((s, o) => s + Number(o.supplier_cost), 0)
    const total_shipping_cost = db.orders.reduce((s, o) => s + Number(o.shipping_cost), 0)
    const total_profit = db.orders.reduce((s, o) => s + Number(o.profit), 0)
    return Promise.resolve([{ total_sales, total_orders, total_supplier_cost, total_shipping_cost, total_profit }])
  }

  // ── SELECT total_pending das installments ─────���──────────────────────────
  if (/total_pending/.test(query)) {
    const total_pending = db.installments.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.value), 0)
    return Promise.resolve([{ total_pending }])
  }

  // ── SELECT overdue installments ──────────────────────────────────────────
  if (/overdue_count/.test(query)) {
    const today = format(new Date(), 'yyyy-MM-dd')
    const overdue = db.installments.filter(i => i.status === 'pending' && String(i.due_date) < today)
    return Promise.resolve([{ overdue_count: overdue.length, overdue_value: overdue.reduce((s, i) => s + Number(i.value), 0) }])
  }

  // ── SELECT recent orders (dashboard) ─────────────────────────────────────
  if (/LIMIT 8/.test(query) && /FROM orders o/.test(query)) {
    const rows = db.orders
      .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
      .slice(0, 8)
      .map(o => ({ id: o.id, total_value: o.total_value, payment_method: o.payment_method, status: o.status, created_at: o.created_at, client_name: o.client_name }))
    return Promise.resolve(rows)
  }

  // Fallback
  return Promise.resolve([])
}

export default sql
