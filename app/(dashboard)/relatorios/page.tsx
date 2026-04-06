'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { FileDown, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Client, Order, OrderItem } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const paymentMap: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  installments: 'Parcelado',
}

type StatusKey = 'pending' | 'paid' | 'partial'
const statusConfig: Record<StatusKey, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  paid: { label: 'Pago', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  partial: { label: 'Parcial', className: 'bg-sky-100 text-sky-700 border-sky-200' },
}

async function generateBatchPDF(orders: (Order & { items: OrderItem[] })[]) {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF()

  orders.forEach((order, idx) => {
    if (idx > 0) doc.addPage()

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Pedido para Fornecedor', 14, 18)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text('Sistema de Gestao de Pedidos', 14, 25)

    doc.setTextColor(0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Dados do Pedido', 14, 36)
    doc.setFont('helvetica', 'normal')
    doc.text(`Pedido #${order.id}`, 14, 43)
    doc.text(`Cliente: ${order.client_name}`, 14, 50)
    doc.text(
      `Data: ${format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
      14, 57
    )
    doc.text(`Pagamento: ${paymentMap[order.payment_method] ?? order.payment_method}`, 14, 64)

    autoTable(doc, {
      startY: 72,
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
      styles: { fontSize: 9 },
    })

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total de Itens: ${totalQty}`, 14, finalY)
    doc.text(`Valor Total: ${formatBRL(Number(order.total_value))}`, 14, finalY + 7)
  })

  const today = format(new Date(), 'yyyy-MM-dd')
  doc.save(`relatorio-pedidos-${today}.pdf`)
}

export default function RelatoriosPage() {
  const { data: clients } = useSWR<Client[]>('/api/clients', fetcher)
  const { data: orders, isLoading } = useSWR<(Order & { items: OrderItem[] })[]>('/api/orders', fetcher)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const filtered = orders?.filter(o => {
    const matchClient = clientFilter === 'all' || String(o.client_id) === clientFilter
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchClient && matchStatus
  }) ?? []

  const selectedOrders = filtered.filter(o => selected.has(o.id))
  const allSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id))
  const someSelected = selected.size > 0 && !allSelected

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(o => o.id)))
    }
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // When filters change, reset selection
  const handleClientFilter = (v: string) => { setClientFilter(v); setSelected(new Set()) }
  const handleStatusFilter = (v: string) => { setStatusFilter(v); setSelected(new Set()) }

  const exportTarget = selectedOrders.length > 0 ? selectedOrders : filtered
  const exportCount = exportTarget.length
  const totalSelected = selectedOrders.length > 0
    ? selectedOrders.reduce((s, o) => s + Number(o.total_value), 0)
    : filtered.reduce((s, o) => s + Number(o.total_value), 0)

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Relatorios</h1>
          <p className="text-muted-foreground mt-1 text-sm">Gere PDFs para fornecedores</p>
        </div>
        <Button
          size="lg"
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 shadow-sm"
          onClick={() => generateBatchPDF(exportTarget)}
          disabled={exportCount === 0}
        >
          <FileDown className="w-4 h-4" />
          Exportar PDF
          {exportCount > 0 && (
            <span className="ml-1 bg-white/20 rounded-full px-1.5 py-0.5 text-xs font-bold">
              {exportCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={clientFilter} onValueChange={handleClientFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients?.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary bar */}
      <Card className="mb-5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} pedido${selected.size !== 1 ? 's' : ''} selecionado${selected.size !== 1 ? 's' : ''} · exportar apenas esses`
                : `${filtered.length} pedido${filtered.length !== 1 ? 's' : ''} · exportar todos`
              }
            </p>
            <p className="text-lg font-bold">{formatBRL(totalSelected)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Orders list */}
      <Card>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleAll}
              aria-label="Selecionar todos"
            />
            <CardTitle className="text-base">Pedidos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum pedido encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros acima para ver mais pedidos</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(order => {
                const isChecked = selected.has(order.id)
                const statusCfg = statusConfig[order.status as StatusKey] ?? { label: order.status, className: 'bg-muted text-muted-foreground border-border' }
                return (
                  <div
                    key={order.id}
                    className={`flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors cursor-pointer ${isChecked ? 'bg-accent/30' : ''}`}
                    onClick={() => toggleOne(order.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleOne(order.id)}
                        onClick={e => e.stopPropagation()}
                        aria-label={`Selecionar pedido #${order.id}`}
                      />
                      <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0">#{order.id}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{order.client_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          {' · '}
                          {paymentMap[order.payment_method] ?? order.payment_method}
                          {' · '}
                          {Array.isArray(order.items) ? order.items.length : 0} item(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                      <span className="text-sm font-bold">{formatBRL(Number(order.total_value))}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        onClick={e => { e.stopPropagation(); generateBatchPDF([order]) }}
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        PDF
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
