'use client'

import useSWR from 'swr'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
    <Sheet open={clientId !== null} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {isLoading || !data ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-xl">{data.client?.name}</SheetTitle>
              {data.client?.phone && (
                <p className="text-sm text-muted-foreground">{data.client.phone}</p>
              )}
              {data.client?.notes && (
                <p className="text-sm text-muted-foreground italic">{data.client.notes}</p>
              )}
            </SheetHeader>

            {/* Debt Summary */}
            <div className="bg-accent/60 rounded-xl px-4 py-3 mb-6">
              <p className="text-sm text-muted-foreground">Divida pendente</p>
              <p className="text-2xl font-semibold text-accent-foreground">
                {formatBRL(data.totalDebt ?? 0)}
              </p>
            </div>

            {/* Orders */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Historico de Pedidos ({data.orders?.length ?? 0})
              </h3>
              {data.orders?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
              ) : (
                <div className="space-y-2">
                  {data.orders?.map((order: Order) => (
                    <div key={order.id} className="border border-border rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground font-mono">#{order.id}</span>
                        <span className="text-sm font-semibold">{formatBRL(Number(order.total_value))}</span>
                      </div>
                      <div className="flex items-center gap-2">
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
                <h3 className="text-sm font-semibold text-foreground mb-3">Parcelas</h3>
                <div className="space-y-2">
                  {data.installments?.map((inst: Installment) => (
                    <div key={inst.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{formatBRL(Number(inst.value))}</p>
                        <p className="text-xs text-muted-foreground">
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
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
