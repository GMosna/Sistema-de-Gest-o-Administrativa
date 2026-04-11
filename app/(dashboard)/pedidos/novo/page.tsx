'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Plus, Trash2, ArrowLeft, Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { addMonths, format } from 'date-fns'
import type { Client } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type Item = {
  product_code: string
  product_name: string
  size: string
  color: string
  price: string
  quantity: string
  commission: string
}

const emptyItem = (): Item => ({
  product_code: '',
  product_name: '',
  size: '',
  color: '',
  price: '',
  quantity: '1',
  commission: '',
})

// Retorna o subtotal do item já com comissão embutida (frete é por pedido)
function calcItemTotal(item: Item): { base: number; commissionVal: number; total: number } {
  const price = parseFloat(item.price) || 0
  const qty = parseInt(item.quantity) || 0
  const commPct = parseFloat(item.commission) || 0
  const base = price * qty
  const commissionVal = base * (commPct / 100)
  return { base, commissionVal, total: base + commissionVal }
}

type InstallmentRow = { value: string; due_date: string }

type FormErrors = {
  client?: boolean
  supplier?: boolean
  items?: { [key: number]: { product_code?: boolean; price?: boolean; quantity?: boolean } }
}

export default function NovoPedidoPage() {
  const router = useRouter()
  const { data: clients } = useSWR<Client[]>('/api/clients', fetcher)

  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState<Item[]>([emptyItem()])
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cash' | 'installments'>('pix')
  const [pixKey, setPixKey] = useState('')
  const [numInstallments, setNumInstallments] = useState(2)
  const [installments, setInstallments] = useState<InstallmentRow[]>([])
  const [firstDueDate, setFirstDueDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [supplierName, setSupplierName] = useState('')
  const [supplierCost, setSupplierCost] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [orderShipping, setOrderShipping] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showGlobalError, setShowGlobalError] = useState(false)

  // Subtotal dos itens (preço × qtd + comissão por item)
  const itemsSubtotal = useMemo(
    () => items.reduce((sum, i) => sum + calcItemTotal(i).total, 0),
    [items],
  )

  // Total do pedido = subtotal dos itens + frete do pedido
  const total = useMemo(
    () => itemsSubtotal + (parseFloat(orderShipping) || 0),
    [itemsSubtotal, orderShipping],
  )

  function updateItem(index: number, field: keyof Item, value: string) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem()])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function generateInstallments(num: number, startDate?: string) {
    const base = startDate ? new Date(startDate + 'T12:00:00') : new Date()
    const installmentValue = total / num
    const rows: InstallmentRow[] = Array.from({ length: num }, (_, i) => ({
      value: installmentValue.toFixed(2),
      due_date: format(addMonths(base, i + (startDate ? 0 : 1)), 'yyyy-MM-dd'),
    }))
    setInstallments(rows)
    setNumInstallments(num)
  }

  function updateInstallment(index: number, field: keyof InstallmentRow, value: string) {
    setInstallments(prev => prev.map((inst, i) => (i === index ? { ...inst, [field]: value } : inst)))
  }

  function validateForm(): boolean {
    const newErrors: FormErrors = {}
    let hasError = false

    // Validar cliente
    if (!clientId) {
      newErrors.client = true
      hasError = true
    }

    // Validar fornecedor
    if (!supplierName.trim()) {
      newErrors.supplier = true
      hasError = true
    }

    // Validar itens
    const itemErrors: FormErrors['items'] = {}
    items.forEach((item, index) => {
      const itemError: { product_code?: boolean; price?: boolean; quantity?: boolean } = {}
      
      if (!item.product_code.trim()) {
        itemError.product_code = true
        hasError = true
      }
      if (!item.price || parseFloat(item.price) <= 0) {
        itemError.price = true
        hasError = true
      }
      if (!item.quantity || parseInt(item.quantity) <= 0) {
        itemError.quantity = true
        hasError = true
      }
      
      if (Object.keys(itemError).length > 0) {
        itemErrors[index] = itemError
      }
    })

    if (Object.keys(itemErrors).length > 0) {
      newErrors.items = itemErrors
    }

    // Validar se tem pelo menos 1 item
    if (items.length === 0) {
      hasError = true
    }

    setErrors(newErrors)
    setShowGlobalError(hasError)
    return !hasError
  }

  async function handleSubmit() {
    if (!validateForm()) return
    setSaving(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: parseInt(clientId),
          items: items.map(i => {
            const calc = calcItemTotal(i)
            return {
              ...i,
              price: calc.total / (parseInt(i.quantity) || 1),
              quantity: parseInt(i.quantity),
              commission: parseFloat(i.commission) || 0,
            }
          }),
          order_shipping: parseFloat(orderShipping) || 0,
          payment_method: paymentMethod,
          pix_key: paymentMethod === 'pix' ? pixKey : null,
          installments_data: paymentMethod === 'installments' ? installments : [],
          supplier_name: supplierName.trim(),
          supplier_cost: parseFloat(supplierCost) || 0,
          shipping_cost: parseFloat(shippingCost) || 0,
        }),
      })
      const order = await res.json()
      router.push(`/pedidos/${order.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/pedidos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Novo Pedido</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Preencha os dados do pedido</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Global Error Alert */}
        {showGlobalError && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nao foi possivel criar o pedido. Corrija os campos destacados.
            </AlertDescription>
          </Alert>
        )}

        {/* Client */}
        <Card>
          <CardHeader><CardTitle className="text-base">Cliente *</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Select 
                value={clientId} 
                onValueChange={(v) => {
                  setClientId(v)
                  if (errors.client) setErrors(prev => ({ ...prev, client: false }))
                }}
              >
                <SelectTrigger className={`max-w-sm ${errors.client ? 'border-red-500 focus:ring-red-500' : ''}`}>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client && (
                <p className="text-xs text-red-500">Este campo e obrigatorio</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Itens do Pedido</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Adicionar Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Codigo *</Label>
                    <Input
                      value={item.product_code}
                      onChange={e => {
                        updateItem(index, 'product_code', e.target.value)
                        if (errors.items?.[index]?.product_code) {
                          setErrors(prev => ({
                            ...prev,
                            items: { ...prev.items, [index]: { ...prev.items?.[index], product_code: false } }
                          }))
                        }
                      }}
                      placeholder="COD-001"
                      className={errors.items?.[index]?.product_code ? 'border-red-500' : ''}
                    />
                    {errors.items?.[index]?.product_code && (
                      <p className="text-xs text-red-500">Este campo e obrigatorio</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do Produto</Label>
                    <Input
                      value={item.product_name}
                      onChange={e => updateItem(index, 'product_name', e.target.value)}
                      placeholder="Camiseta Basica"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tamanho</Label>
                    <Input
                      value={item.size}
                      onChange={e => updateItem(index, 'size', e.target.value)}
                      placeholder="M, G, GG..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor</Label>
                    <Input
                      value={item.color}
                      onChange={e => updateItem(index, 'color', e.target.value)}
                      placeholder="Azul, Branco..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Preco (R$) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={e => {
                        updateItem(index, 'price', e.target.value)
                        if (errors.items?.[index]?.price) {
                          setErrors(prev => ({
                            ...prev,
                            items: { ...prev.items, [index]: { ...prev.items?.[index], price: false } }
                          }))
                        }
                      }}
                      placeholder="0,00"
                      className={errors.items?.[index]?.price ? 'border-red-500' : ''}
                    />
                    {errors.items?.[index]?.price && (
                      <p className="text-xs text-red-500">Este campo e obrigatorio</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quantidade *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => {
                        updateItem(index, 'quantity', e.target.value)
                        if (errors.items?.[index]?.quantity) {
                          setErrors(prev => ({
                            ...prev,
                            items: { ...prev.items, [index]: { ...prev.items?.[index], quantity: false } }
                          }))
                        }
                      }}
                      placeholder="1"
                      className={errors.items?.[index]?.quantity ? 'border-red-500' : ''}
                    />
                    {errors.items?.[index]?.quantity && (
                      <p className="text-xs text-red-500">Este campo e obrigatorio</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Comissao (%)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={item.commission}
                        onChange={e => updateItem(index, 'commission', e.target.value)}
                        placeholder="Ex: 10"
                        className="pr-7"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                </div>
                {item.price && item.quantity && (() => {
                  const calc = calcItemTotal(item)
                  return (
                    <div className="mt-2 text-right">
                      {calc.commissionVal > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {formatBRL(calc.base)}
                          {' + comissao '}{formatBRL(calc.commissionVal)}
                          {' = '}
                          <span className="font-semibold text-foreground">{formatBRL(calc.total)}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Subtotal: <span className="font-semibold text-foreground">{formatBRL(calc.base)}</span>
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>
            ))}

            <Separator />
            <div className="flex justify-end">
              <div className="text-right space-y-0.5">
                {(parseFloat(orderShipping) || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Itens: {formatBRL(itemsSubtotal)} + Frete: {formatBRL(parseFloat(orderShipping) || 0)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Total do Pedido</p>
                <p className="text-2xl font-semibold text-foreground">{formatBRL(total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader><CardTitle className="text-base">Pagamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => {
                  setPaymentMethod(v as typeof paymentMethod)
                  if (v === 'installments' && total > 0) generateInstallments(numInstallments)
                }}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="installments">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'pix' && (
              <div className="space-y-1.5 max-w-sm">
                <Label>Chave Pix</Label>
                <Input
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatoria"
                />
              </div>
            )}

            {paymentMethod === 'installments' && (
              <div className="space-y-4">
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="space-y-1.5">
                    <Label>Numero de Parcelas</Label>
                    <Select
                      value={String(numInstallments)}
                      onValueChange={v => generateInstallments(parseInt(v), firstDueDate)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data da primeira parcela</Label>
                    <Input
                      type="date"
                      value={firstDueDate}
                      onChange={e => {
                        setFirstDueDate(e.target.value)
                        if (installments.length > 0) generateInstallments(numInstallments, e.target.value)
                      }}
                      className="w-44"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateInstallments(numInstallments, firstDueDate)}
                    disabled={total === 0}
                  >
                    Recalcular
                  </Button>
                </div>

                {installments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Parcelas:</p>
                    {installments.map((inst, i) => (
                      <div key={i} className="flex items-center gap-3 border border-border rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground w-16">{i + 1}/{numInstallments}</span>
                        <div className="flex items-center gap-2 flex-1">
                          <Label className="text-xs text-muted-foreground">Valor</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={inst.value}
                            onChange={e => updateInstallment(i, 'value', e.target.value)}
                            className="w-28 h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Vencimento</Label>
                          <Input
                            type="date"
                            value={inst.due_date}
                            onChange={e => updateInstallment(i, 'due_date', e.target.value)}
                            className="w-40 h-8 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Data */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Fornecedor *</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-sm">
              <Label className="text-xs">Nome do Fornecedor *</Label>
              <Input
                value={supplierName}
                onChange={e => {
                  setSupplierName(e.target.value)
                  if (errors.supplier) setErrors(prev => ({ ...prev, supplier: false }))
                }}
                placeholder="Ex: Fornecedor Silva, Atacado ABC..."
                className={errors.supplier ? 'border-red-500' : ''}
              />
              {errors.supplier && (
                <p className="text-xs text-red-500">Este campo e obrigatorio</p>
              )}
            </div>
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs">Frete repassado ao cliente (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={orderShipping}
                onChange={e => setOrderShipping(e.target.value)}
                placeholder="Ex: 4,50"
              />
              <p className="text-xs text-muted-foreground">
                Valor cobrado do cliente pelo frete. Sera somado ao total do pedido.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Supplier Costs */}
        <Card className="border-dashed border-muted-foreground/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Custos do Fornecedor</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Estes dados sao internos e nao aparecem no PDF do cliente.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor pago ao fornecedor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={supplierCost}
                  onChange={e => setSupplierCost(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor do frete (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={e => setShippingCost(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            {(supplierCost || shippingCost || total > 0) && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-emerald-800">Lucro estimado</p>
                  <p className={`text-lg font-bold ${
                    total - (parseFloat(supplierCost) || 0) - (parseFloat(shippingCost) || 0) >= 0
                      ? 'text-emerald-700'
                      : 'text-red-600'
                  }`}>
                    {formatBRL(total - (parseFloat(supplierCost) || 0) - (parseFloat(shippingCost) || 0))}
                  </p>
                </div>
                <p className="text-xs text-emerald-700/70">
                  Total cobrado {formatBRL(total)}
                  {(parseFloat(supplierCost) || 0) > 0 && <> &minus; custo fornecedor {formatBRL(parseFloat(supplierCost))}</>}
                  {(parseFloat(shippingCost) || 0) > 0 && <> &minus; frete pago {formatBRL(parseFloat(shippingCost))}</>}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/pedidos">
            <Button variant="outline">Cancelar</Button>
          </Link>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-md hover:shadow-lg transition-shadow"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Criar Pedido'}
          </Button>
        </div>
      </div>
    </div>
  )
}
