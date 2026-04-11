export type Client = {
  id: number
  name: string
  phone: string | null
  notes: string | null
  total_debt?: number
  created_at: string
}

export type Order = {
  id: number
  client_id: number
  client_name?: string
  total_value: number
  payment_method: 'pix' | 'cash' | 'installments'
  pix_key: string | null
  status: 'pending' | 'paid' | 'partial' | 'delivered'
  supplier_name: string | null
  supplier_cost: number
  shipping_cost: number
  profit: number
  created_at: string
  items?: OrderItem[]
  installments?: Installment[]
}

export type OrderItem = {
  id: number
  order_id: number
  product_code: string
  product_name: string
  size: string | null
  color: string | null
  price: number
  quantity: number
}

export type Installment = {
  id: number
  order_id: number
  client_name?: string
  order_created_at?: string
  supplier_name?: string | null
  installment_number?: number
  total_installments?: number
  value: number
  due_date: string
  status: 'pending' | 'paid'
  paid_at: string | null
  created_at: string
}
