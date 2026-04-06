'use client'

import useSWR from 'swr'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Order, Installment } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const paymentMap: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  installments: 'Parcelado',
}

type Props = {
  clientId: number | null
  onClose: () => void
}

export default function ClientDetailSheet({ clientId, onClose }: Props) {
  const { data, isLoading } = useSWR(
    clientId ? `/api/clients/${clientId}` : null,
    fetcher,
  )

  return (
    <Dialog open={clientId !== null} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto p-0">
        {isLoading || !data ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-border">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold">{data.client?.name}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                {data.client?.phone && (
                  <span>{data.client.phone}</span>
                )}
                {data.client?.notes && (
                  <span className="italic">{data.client.notes}</span>
                )}
              </div>
            </div>

            <div className="px-8 py-6 space-y-8">
              {/* Debt Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-accent/60 rounded-xl px-5 py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Divida pendente</p>
                  <p className="text-2xl font-bold mt-1.5">
                    {formatBRL(data.totalDebt ?? 0)}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-xl px-5 py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total pedidos</p>
                  <p className="text-2xl font-bold mt-1.5">{data.orders?.length ?? 0}</p>
                </div>
                <div className="bg-muted/50 rounded-xl px-5 py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Parcelas</p>
                  <p className="text-2xl font-bold mt-1.5">{data.installments?.length ?? 0}</p>
                </div>
              </div>

              {/* Orders */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Historico de Pedidos ({data.orders?.length ?? 0})
                </h3>
                {data.orders?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.orders?.map((order: Order) => (
                      <div key={order.id} className="border border-border rounded-xl px-5 py-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground font-mono">#{order.id}</span>
                          <span className="text-sm font-bold">{formatBRL(Number(order.total_value))}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {paymentMap[order.payment_method] ?? order.payment_method}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        {Array.isArray(order.items) && order.items.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {order.items.map((item, i) => (
                              <span key={i}>
                                {item.quantity}x {item.product_name}
                                {i < order.items!.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Installments */}
              {data.installments?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Parcelas ({data.installments.length})
                  </h3>
                  <div className="space-y-2">
                    {data.installments?.map((inst: Installment) => (
                      <div key={inst.id} className="flex items-center justify-between border border-border rounded-lg px-5 py-3 hover:bg-muted/20 transition-colors">
                        <div>
                          <p className="text-sm font-semibold">{formatBRL(Number(inst.value))}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Vence: {format(new Date(inst.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge variant={inst.status === 'paid' ? 'default' : 'secondary'}>
                          {inst.status === 'paid' ? 'Pago' : 'Pendente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
