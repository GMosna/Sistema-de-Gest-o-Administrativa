'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { CheckCircle2, CircleDashed, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format, isToday, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Client, Installment } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type DueDateInfo = {
  label: string | null
  rowClass: string
  dotClass: string
  badgeClass: string
  badgeLabel: string
  isPaid: boolean
  isOverdue: boolean
  isToday: boolean
}

function getDueDateInfo(dueDateStr: string, status: string): DueDateInfo {
  if (status === 'paid') {
    return {
      label: null,
      rowClass: 'bg-emerald-50/60',
      dotClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      badgeLabel: 'Pago',
      isPaid: true, isOverdue: false, isToday: false,
    }
  }
  const date = parseISO(dueDateStr)
  if (isToday(date)) {
    return {
      label: 'Vence hoje',
      rowClass: 'bg-amber-50/70',
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
      badgeLabel: 'Vence hoje',
      isPaid: false, isOverdue: false, isToday: true,
    }
  }
  if (isPast(date)) {
    return {
      label: 'Atrasada',
      rowClass: 'bg-red-50/70',
      dotClass: 'bg-red-500',
      badgeClass: 'bg-red-100 text-red-700 border-red-200',
      badgeLabel: 'Atrasada',
      isPaid: false, isOverdue: true, isToday: false,
    }
  }
  return {
    label: null,
    rowClass: 'bg-slate-50',
    dotClass: 'bg-slate-300',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    badgeLabel: 'Pendente',
    isPaid: false, isOverdue: false, isToday: false,
  }
}

export default function ParcelasPage() {
  const { data: clients } = useSWR<Client[]>('/api/clients', fetcher)
  const [clientFilter, setClientFilter] = useState<string>('all')

  const url = clientFilter !== 'all' ? `/api/installments?client_id=${clientFilter}` : '/api/installments'
  const { data: installments, isLoading, mutate } = useSWR<Installment[]>(url, fetcher)

  const pending = installments?.filter(i => i.status === 'pending') ?? []
  const paid = installments?.filter(i => i.status === 'paid') ?? []
  const overdue = pending.filter(i => isPast(parseISO(i.due_date)) && !isToday(parseISO(i.due_date)))
  const totalPending = pending.reduce((s, i) => s + Number(i.value), 0)

  async function toggleStatus(inst: Installment) {
    const newStatus = inst.status === 'paid' ? 'pending' : 'paid'
    await fetch(`/api/installments/${inst.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    await mutate()
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Parcelas</h1>
          <p className="text-muted-foreground mt-1 text-sm">Controle de pagamentos parcelados</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">A Receber</p>
            <p className="text-xl font-bold mt-1.5">{formatBRL(totalPending)}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pendentes</p>
            <p className="text-xl font-bold mt-1.5">{pending.length}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-red-100">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-red-500 font-medium uppercase tracking-wide">Atrasadas</p>
            <p className="text-xl font-bold mt-1.5 text-red-600">{overdue.length}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-emerald-100">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Pagas</p>
            <p className="text-xl font-bold mt-1.5 text-emerald-600">{paid.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-5">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filtrar por cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients?.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : installments?.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <CircleDashed className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma parcela encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">Parcelas aparecem ao criar pedidos parcelados</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {installments?.map(inst => {
                const info = getDueDateInfo(inst.due_date, inst.status)
                const numLabel = inst.installment_number && inst.total_installments
                  ? `Parcela ${inst.installment_number}/${inst.total_installments}`
                  : `Pedido #${inst.order_id}`

                return (
                  <div
                    key={inst.id}
                    className={`flex items-center justify-between px-6 py-4 transition-colors ${info.rowClass}`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Status dot */}
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${info.dotClass}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{inst.client_name}</p>
                          {/* Overdue / today badge inline */}
                          {(info.isOverdue || info.isToday) && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${info.badgeClass}`}>
                              <AlertCircle className="w-3 h-3" />
                              {info.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {numLabel}
                          {' · '}
                          Vence: {format(parseISO(inst.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          {inst.status === 'paid' && inst.paid_at && (
                            <> · Pago em: {format(new Date(inst.paid_at), "dd/MM/yyyy", { locale: ptBR })}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-bold tabular-nums">{formatBRL(Number(inst.value))}</span>
                      {/* Status badge */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${info.badgeClass}`}>
                        {info.badgeLabel}
                      </span>
                      {inst.status !== 'paid' ? (
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
                          onClick={() => toggleStatus(inst)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Marcar pago
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-muted-foreground h-8"
                          onClick={() => toggleStatus(inst)}
                        >
                          Desmarcar
                        </Button>
                      )}
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
