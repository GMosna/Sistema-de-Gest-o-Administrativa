'use client'

import useSWR from 'swr'
import { useState, useMemo } from 'react'
import { FileDown, FileText, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { format, startOfWeek, startOfMonth, endOfMonth, endOfWeek, parseISO, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import type { Client, Order, OrderItem } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const paymentMap: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  installments: 'Parcelado',
}

type StatusKey = 'pending' | 'paid' | 'partial' | 'delivered'
const statusConfig: Record<StatusKey, { label: string; className: string }> = {
  pending:   { label: 'Pendente',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  paid:      { label: 'Pago',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  partial:   { label: 'Parcial',   className: 'bg-sky-100 text-sky-700 border-sky-200' },
  delivered: { label: 'Entregue',  className: 'bg-violet-100 text-violet-700 border-violet-200' },
}

type DateFilter = 'all' | 'week' | 'month' | 'custom'

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
      14, 57,
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
  doc.save(`pedidos-fornecedor-${today}.pdf`)
}

export default function PDFFornecedorPage() {
  const { data: clients } = useSWR<Client[]>('/api/clients', fetcher)
  const { data: orders, isLoading } = useSWR<(Order & { items: OrderItem[] })[]>('/api/orders', fetcher)

  const [clientFilter, setClientFilter]   = useState<string>('all')
  const [statusFilter, setStatusFilter]   = useState<string>('all')
  const [dateFilter, setDateFilter]       = useState<DateFilter>('all')
  const [customFrom, setCustomFrom]       = useState('')
  const [customTo, setCustomTo]           = useState('')
  const [selected, setSelected]           = useState<Set<number>>(new Set())

  const filtered = useMemo(() => {
    if (!orders) return []
    const now = new Date()

    return orders.filter(o => {
      if (clientFilter !== 'all' && String(o.client_id) !== clientFilter) return false
      if (statusFilter !== 'all' && o.status !== statusFilter) return false

      if (dateFilter === 'week') {
        const start = startOfWeek(now, { locale: ptBR })
        const end   = endOfWeek(now, { locale: ptBR })
        if (!isWithinInterval(parseISO(o.created_at), { start, end })) return false
      } else if (dateFilter === 'month') {
        const start = startOfMonth(now)
        const end   = endOfMonth(now)
        if (!isWithinInterval(parseISO(o.created_at), { start, end })) return false
      } else if (dateFilter === 'custom') {
        if (customFrom && customTo) {
          const start = new Date(customFrom + 'T00:00:00')
          const end   = new Date(customTo   + 'T23:59:59')
          if (!isWithinInterval(parseISO(o.created_at), { start, end })) return false
        }
      }

      return true
    })
  }, [orders, clientFilter, statusFilter, dateFilter, customFrom, customTo])

  const allSelected  = filtered.length > 0 && filtered.every(o => selected.has(o.id))
  const someSelected = selected.size > 0 && !allSelected

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map(o => o.id)))
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleClientFilter = (v: string) => { setClientFilter(v); setSelected(new Set()) }
  const handleStatusFilter = (v: string) => { setStatusFilter(v); setSelected(new Set()) }
  const handleDateFilter   = (v: string) => { setDateFilter(v as DateFilter); setSelected(new Set()) }

  const selectedOrders  = filtered.filter(o => selected.has(o.id))
  const exportTarget    = selectedOrders.length > 0 ? selectedOrders : filtered
  const exportCount     = exportTarget.length

  const summaryOrders   = selectedOrders.length > 0 ? selectedOrders : []
  const summaryItems    = summaryOrders.reduce((s, o) => s + (Array.isArray(o.items) ? o.items.reduce((si, i) => si + i.quantity, 0) : 0), 0)
  const summaryValue    = summaryOrders.reduce((s, o) => s + Number(o.total_value), 0)

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">PDF Fornecedor</h1>
          <p className="text-muted-foreground mt-1 text-sm">Selecione os pedidos e exporte o PDF para o fornecedor</p>
        </div>
        <Button
          size="lg"
          className={`gap-2 font-semibold px-5 shadow-sm transition-colors ${
            exportCount > 0
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
          onClick={() => exportCount > 0 && generateBatchPDF(exportTarget)}
          disabled={exportCount === 0}
        >
          <FileDown className="w-4 h-4" />
          Exportar PDF ({exportCount} {exportCount === 1 ? 'pedido' : 'pedidos'})
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={clientFilter} onValueChange={handleClientFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os clientes" />
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
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateFilter} onValueChange={handleDateFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os periodos</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom date range */}
      {dateFilter === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 mb-5 p-4 bg-muted/40 rounded-lg border border-border">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={customFrom}
              onChange={e => { setCustomFrom(e.target.value); setSelected(new Set()) }}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ate</Label>
            <Input
              type="date"
              value={customTo}
              onChange={e => { setCustomTo(e.target.value); setSelected(new Set()) }}
              className="w-40"
            />
          </div>
        </div>
      )}

      {/* Selection summary bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-3 mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
          <p className="text-sm font-medium">
            {selected.size} {selected.size === 1 ? 'pedido selecionado' : 'pedidos selecionados'}
            {' · '}
            {summaryItems} {summaryItems === 1 ? 'item' : 'itens'} no total
            {' · '}
            <span className="font-bold">{formatBRL(summaryValue)}</span>
          </p>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-emerald-600 hover:text-emerald-800 underline underline-offset-2"
          >
            Limpar selecao
          </button>
        </div>
      )}

      {/* Orders list */}
      <Card>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleAll}
              aria-label="Selecionar todos"
            />
            <CardTitle className="text-base">
              Pedidos{filtered.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum pedido encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros acima para ver mais pedidos</p>
              <Link href="/pedidos">
                <Button variant="outline" size="sm" className="mt-4 gap-2">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Ir para Pedidos
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(order => {
                const isChecked  = selected.has(order.id)
                const statusCfg  = statusConfig[order.status as StatusKey] ?? { label: order.status, className: 'bg-muted text-muted-foreground border-border' }
                const itemCount  = Array.isArray(order.items) ? order.items.reduce((s, i) => s + i.quantity, 0) : 0
                const itemCodes  = Array.isArray(order.items) && order.items.length > 0
                  ? order.items.map(i => i.product_code).filter(Boolean).join(', ')
                  : null

                return (
                  <div
                    key={order.id}
                    className={`flex items-start justify-between px-6 py-4 hover:bg-muted/40 transition-colors cursor-pointer gap-4 ${isChecked ? 'bg-emerald-50/60' : ''}`}
                    onClick={() => toggleOne(order.id)}
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleOne(order.id)}
                        onClick={e => e.stopPropagation()}
                        aria-label={`Selecionar pedido #${order.id}`}
                        className="mt-0.5"
                      />
                      <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0 pt-0.5">#{order.id}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{order.client_name}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                          </span>
                          {itemCodes && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground truncate max-w-xs">
                                cod: {itemCodes}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                      <span className="text-sm font-bold whitespace-nowrap">{formatBRL(Number(order.total_value))}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
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
