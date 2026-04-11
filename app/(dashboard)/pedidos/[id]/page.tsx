'use client'

import { use } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, FileDown, CheckCircle2, AlertCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Order, OrderItem, Installment } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  paid:    { label: 'Pago',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  partial: { label: 'Parcial',  cls: 'bg-sky-100 text-sky-700 border-sky-200' },
}

const paymentMap: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  installments: 'Parcelado',
}

async function generatePDF(order: Order & { items: OrderItem[] }) {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo do Pedido para Fornecedor', 14, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text('Sistema de Gestao de Pedidos', 14, 28)

  doc.setTextColor(0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Informacoes do Pedido', 14, 42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Pedido #${order.id}`, 14, 50)
  doc.text(`Cliente: ${order.client_name}`, 14, 57)
  doc.text(`Data: ${format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 14, 64)
  doc.text(`Pagamento: ${paymentMap[order.payment_method] ?? order.payment_method}`, 14, 71)

  // Table
  autoTable(doc, {
    startY: 82,
    head: [['Codigo', 'Produto', 'Tamanho', 'Cor', 'Qtd']],
    body: order.items.map(item => [
      item.product_code,
      item.product_name,
      item.size ?? '-',
      item.color ?? '-',
      String(item.quantity),
    ]),
    headStyles: { fillColor: [52, 120, 68], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    styles: { fontSize: 10 },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
  const totalVal = order.items.reduce((s, i) => s + i.price * i.quantity, 0)

  doc.setFont('helvetica', 'bold')
  doc.text(`Total de Itens: ${totalQty}`, 14, finalY)
  doc.text(`Valor Total: ${formatBRL(totalVal)}`, 14, finalY + 8)

  doc.save(`pedido-${order.id}-${order.client_name?.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

export default function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: order, isLoading, mutate } = useSWR<Order & { items: OrderItem[]; installments: Installment[] }>(
    `/api/orders/${id}`,
    fetcher,
  )

  async function markInstallmentPaid(instId: number, current: string) {
    const newStatus = current === 'paid' ? 'pending' : 'paid'
    await fetch(`/api/installments/${instId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    await mutate()
  }

  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!order) return <div className="px-6 py-8 text-muted-foreground">Pedido nao encontrado.</div>

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/pedidos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Pedido #{order.id}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{order.client_name}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => generatePDF(order)}
        >
          <FileDown className="w-4 h-4" />
          PDF para Fornecedor
        </Button>
      </div>

      <div className="space-y-6">
        {/* Summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${(statusConfig[order.status] ?? { cls: 'bg-muted text-muted-foreground border-border' }).cls}`}>
                  {statusConfig[order.status]?.label ?? order.status}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Pagamento</p>
                <p className="font-medium">{paymentMap[order.payment_method] ?? order.payment_method}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Data</p>
                <p className="font-medium">
                  {format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Total</p>
                <p className="text-lg font-semibold text-foreground">{formatBRL(Number(order.total_value))}</p>
              </div>
            </div>
            {order.pix_key && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Chave Pix</p>
                <p className="text-sm font-mono">{order.pix_key}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader><CardTitle className="text-base">Itens do Pedido</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3 text-xs text-muted-foreground font-medium">Codigo</th>
                    <th className="text-left px-6 py-3 text-xs text-muted-foreground font-medium">Produto</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Tamanho</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Cor</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Qtd</th>
                    <th className="text-right px-6 py-3 text-xs text-muted-foreground font-medium">Preco</th>
                    <th className="text-right px-6 py-3 text-xs text-muted-foreground font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.items?.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{item.product_code}</td>
                      <td className="px-6 py-3 font-medium">{item.product_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.size ?? '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.color ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-6 py-3 text-right">{formatBRL(Number(item.price))}</td>
                      <td className="px-6 py-3 text-right font-medium">
                        {formatBRL(Number(item.price) * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={4} className="px-6 py-3 text-sm text-muted-foreground">
                      {order.items?.reduce((s, i) => s + i.quantity, 0)} {order.items?.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'itens'}
                    </td>
                    <td colSpan={3} className="px-6 py-3 text-right">
                      {(() => {
                        const itemsTotal = order.items?.reduce((s, i) => s + Number(i.price) * i.quantity, 0) ?? 0
                        const shipping = Number(order.total_value) - itemsTotal
                        return (
                          <div className="space-y-0.5">
                            {shipping > 0.01 && (
                              <p className="text-xs text-muted-foreground">
                                Itens {formatBRL(itemsTotal)} + Frete {formatBRL(shipping)}
                              </p>
                            )}
                            <p className="font-semibold text-base">{formatBRL(Number(order.total_value))}</p>
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Internal Costs */}
        {(Number(order.supplier_cost) > 0 || Number(order.shipping_cost) > 0) && (
          <Card className="border-dashed border-muted-foreground/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">Custos Internos</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Informacoes internas, nao aparecem no PDF do cliente.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Custo Fornecedor</p>
                  <p className="font-semibold">{formatBRL(Number(order.supplier_cost))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Frete</p>
                  <p className="font-semibold">{formatBRL(Number(order.shipping_cost))}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-600 mb-1">Lucro Liquido</p>
                  <p className={`text-base font-bold ${Number(order.profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatBRL(Number(order.profit))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Installments */}
        {order.payment_method === 'installments' && order.installments?.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Parcelas</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-hidden">
              <div className="divide-y divide-border">
                {order.installments.map((inst, i) => {
                  const total = order.installments.length
                  const isPaid = inst.status === 'paid'
                  const date = parseISO(inst.due_date)
                  const todayDue = isToday(date)
                  const overdue = !isPaid && isPast(date) && !todayDue

                  const rowBg = isPaid
                    ? 'bg-emerald-50/60'
                    : overdue
                    ? 'bg-red-50/60'
                    : todayDue
                    ? 'bg-amber-50/60'
                    : ''

                  const badge = isPaid
                    ? { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                    : overdue
                    ? { label: 'Atrasada', cls: 'bg-red-100 text-red-700 border-red-200' }
                    : todayDue
                    ? { label: 'Vence hoje', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
                    : { label: 'Pendente', cls: 'bg-slate-100 text-slate-600 border-slate-200' }

                  return (
                    <div key={inst.id} className={`flex items-center justify-between px-6 py-3.5 transition-colors ${rowBg}`}>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-muted-foreground w-20 flex-shrink-0">
                          Parcela {i + 1}/{total}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{formatBRL(Number(inst.value))}</p>
                          <p className="text-xs text-muted-foreground">
                            Vence: {format(date, "dd/MM/yyyy", { locale: ptBR })}
                            {isPaid && inst.paid_at && (
                              <> · Pago em: {format(new Date(inst.paid_at), "dd/MM/yyyy", { locale: ptBR })}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                          {(overdue || todayDue) && !isPaid && <AlertCircle className="w-3 h-3" />}
                          {badge.label}
                        </span>
                        <Button
                          variant={isPaid ? 'ghost' : 'default'}
                          size="sm"
                          onClick={() => markInstallmentPaid(inst.id, inst.status)}
                          className={`gap-1.5 text-xs h-8 ${!isPaid ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-muted-foreground'}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isPaid ? 'Desmarcar' : 'Marcar Pago'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
