'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useState } from 'react'
import { Plus, Eye, Trash2, ShoppingBag, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Order } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type StatusKey = 'pending' | 'paid' | 'partial' | 'delivered'

const statusConfig: Record<StatusKey, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  paid: { label: 'Pago', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  partial: { label: 'Parcial', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  delivered: { label: 'Entregue', className: 'bg-violet-100 text-violet-700 border-violet-200' },
}

const paymentConfig: Record<string, { label: string; className: string }> = {
  pix: { label: 'Pix', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  cash: { label: 'Dinheiro', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  installments: { label: 'Parcelado', className: 'bg-orange-100 text-orange-700 border-orange-200' },
}

function Tag({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  )
}

export default function PedidosPage() {
  const { data: orders, isLoading, mutate } = useSWR<Order[]>('/api/orders', fetcher)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filtered = orders?.filter(o =>
    (o.client_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(o.id).includes(search),
  )

  async function handleDelete(id: number) {
    await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    await mutate()
    setDeleteId(null)
  }

  async function handleMarkAsPaid(id: number) {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
    })
    await mutate()
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {orders ? `${orders.length} pedido${orders.length !== 1 ? 's' : ''} no total` : 'Gerencie seus pedidos'}
          </p>
        </div>
        <Link href="/pedidos/novo">
          <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-md hover:shadow-lg transition-shadow">
            <Plus className="w-4 h-4" /> Novo Pedido
          </Button>
        </Link>
      </div>

      <div className="mb-5">
        <Input
          placeholder="Buscar por cliente ou numero do pedido..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}
              </p>
              {!search && (
                <p className="text-xs text-muted-foreground mt-1">
                  <Link href="/pedidos/novo" className="text-primary hover:underline">Crie seu primeiro pedido</Link>
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered?.map(order => {
                const items = Array.isArray(order.items) ? order.items : []
                const codes = items.map(i => i.product_code).slice(0, 3).join(', ')
                const itemsLabel = items.length > 0
                  ? `${items.length} ${items.length === 1 ? 'item' : 'itens'}${codes ? ` · cód: ${codes}${items.length > 3 ? '...' : ''}` : ''}`
                  : null
                const statusCfg = statusConfig[order.status as StatusKey] ?? { label: order.status, className: 'bg-muted text-muted-foreground border-border' }
                const paymentCfg = paymentConfig[order.payment_method] ?? { label: order.payment_method, className: 'bg-muted text-muted-foreground border-border' }

                return (
                  <div key={order.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors group">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0">#{order.id}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{order.client_name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {itemsLabel && (
                            <span className="text-xs text-muted-foreground">{itemsLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Tag label={paymentCfg.label} className={paymentCfg.className} />
                      <Tag label={statusCfg.label} className={statusCfg.className} />
                      <span className="text-sm font-bold text-foreground min-w-[80px] text-right">
                        {formatBRL(Number(order.total_value))}
                      </span>
                      <div className="flex items-center gap-0.5 ml-1">
                        {order.status !== 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 px-2"
                            onClick={() => handleMarkAsPaid(order.id)}
                            title="Marcar como pago"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Marcar pago</span>
                          </Button>
                        )}
                        <Link href={`/pedidos/${order.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(order.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir este pedido? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
