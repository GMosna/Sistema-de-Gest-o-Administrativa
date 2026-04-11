'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { FileDown, X, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { format, parseISO, getMonth, getYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Client, Installment } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const MONTHS = [
  { value: '0', label: 'Janeiro' },
  { value: '1', label: 'Fevereiro' },
  { value: '2', label: 'Março' },
  { value: '3', label: 'Abril' },
  { value: '4', label: 'Maio' },
  { value: '5', label: 'Junho' },
  { value: '6', label: 'Julho' },
  { value: '7', label: 'Agosto' },
  { value: '8', label: 'Setembro' },
  { value: '9', label: 'Outubro' },
  { value: '10', label: 'Novembro' },
  { value: '11', label: 'Dezembro' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => ({
  value: String(y),
  label: String(y),
}))

type GroupedInstallment = {
  supplier_name: string
  order_id: number
  order_date: string
  installments: Installment[]
  subtotal: number
}

interface ResumoMesProps {
  open: boolean
  onClose: () => void
}

export function ResumoMes({ open, onClose }: ResumoMesProps) {
  const now = new Date()
  const [clientId, setClientId] = useState<string>('')
  const [month, setMonth] = useState<string>(String(now.getMonth()))
  const [year, setYear] = useState<string>(String(now.getFullYear()))

  const { data: clients } = useSWR<Client[]>('/api/clients', fetcher)
  const { data: installments, isLoading } = useSWR<Installment[]>(
    clientId ? `/api/installments?client_id=${clientId}` : null,
    fetcher,
  )

  const selectedClient = clients?.find(c => String(c.id) === clientId)
  const selectedMonthLabel = MONTHS.find(m => m.value === month)?.label ?? ''

  const filtered = useMemo(() => {
    if (!installments) return []
    const m = parseInt(month)
    const y = parseInt(year)
    return installments.filter(inst => {
      const date = parseISO(inst.due_date)
      return getMonth(date) === m && getYear(date) === y
    })
  }, [installments, month, year])

  // Agrupa por supplier_name + order_id
  const grouped = useMemo((): GroupedInstallment[] => {
    const map = new Map<string, GroupedInstallment>()
    for (const inst of filtered) {
      const key = `${inst.order_id}`
      if (!map.has(key)) {
        map.set(key, {
          supplier_name: inst.supplier_name || 'Fornecedor não informado',
          order_id: inst.order_id,
          order_date: inst.order_created_at ?? '',
          installments: [],
          subtotal: 0,
        })
      }
      const group = map.get(key)!
      group.installments.push(inst)
      group.subtotal += Number(inst.value)
    }
    // Ordena por supplier_name, depois por order_id
    return Array.from(map.values()).sort((a, b) =>
      a.supplier_name.localeCompare(b.supplier_name) || a.order_id - b.order_id,
    )
  }, [filtered])

  const totalValue = filtered.reduce((s, i) => s + Number(i.value), 0)
  const totalCount = filtered.length

  async function handleExportPDF() {
    if (!selectedClient || grouped.length === 0) return

    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Cabeçalho
    doc.setFillColor(52, 120, 68)
    doc.rect(0, 0, pageWidth, 34, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumo do Mes', 14, 14)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Cliente: ${selectedClient.name}`, 14, 22)
    doc.text(`Periodo: ${selectedMonthLabel} ${year}`, 14, 29)

    doc.setTextColor(180, 220, 180)
    doc.setFontSize(8)
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}`,
      pageWidth - 14,
      29,
      { align: 'right' },
    )

    let currentY = 44

    doc.setTextColor(0)

    for (const group of grouped) {
      // Verifica se precisa de nova página
      if (currentY > 240) {
        doc.addPage()
        currentY = 20
      }

      // Cabeçalho do grupo (loja)
      doc.setFillColor(240, 248, 242)
      doc.rect(14, currentY - 5, pageWidth - 28, 10, 'F')
      doc.setDrawColor(52, 120, 68)
      doc.rect(14, currentY - 5, pageWidth - 28, 10, 'S')

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(52, 120, 68)
      doc.text(`Loja: ${group.supplier_name}`, 17, currentY + 1)
      currentY += 10

      // Info do pedido
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80)
      const orderDateStr = group.order_date
        ? format(new Date(group.order_date), "dd/MM/yyyy", { locale: ptBR })
        : '-'
      doc.text(`Pedido #${group.order_id}  —  ${orderDateStr}`, 17, currentY + 4)
      currentY += 9

      // Tabela de parcelas do grupo
      const tableRows = group.installments.map(inst => [
        inst.installment_number && inst.total_installments
          ? `Parcela ${inst.installment_number}/${inst.total_installments}`
          : `Parcela`,
        format(parseISO(inst.due_date), 'dd/MM/yyyy', { locale: ptBR }),
        formatBRL(Number(inst.value)),
        inst.status === 'paid' ? 'Pago' : 'Pendente',
      ])

      autoTable(doc, {
        startY: currentY,
        head: [['Parcela', 'Vencimento', 'Valor', 'Status']],
        body: tableRows,
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: [52, 120, 68], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [250, 254, 250] },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
        },
      })

      const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

      // Subtotal do grupo
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0)
      doc.text(`Subtotal: ${formatBRL(group.subtotal)}`, pageWidth - 14, afterTable + 6, { align: 'right' })

      currentY = afterTable + 14
    }

    // Verifica se cabe o rodapé na página atual
    if (currentY > 250) {
      doc.addPage()
      currentY = 20
    }

    // Linha separadora
    doc.setDrawColor(52, 120, 68)
    doc.setLineWidth(0.5)
    doc.line(14, currentY, pageWidth - 14, currentY)
    currentY += 8

    // Rodapé — Total
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(`Total de parcelas em ${selectedMonthLabel} ${year}: ${totalCount} ${totalCount === 1 ? 'parcela' : 'parcelas'}`, 14, currentY)
    currentY += 8

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(52, 120, 68)
    doc.text(`Valor total a pagar em ${selectedMonthLabel}: ${formatBRL(totalValue)}`, 14, currentY)

    const fileName = `resumo-${selectedClient.name.replace(/\s+/g, '-').toLowerCase()}-${selectedMonthLabel.toLowerCase()}-${year}.pdf`
    doc.save(fileName)
  }

  const canExport = !!clientId && grouped.length > 0

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            Resumo do Mes
          </DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {clients?.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mes</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ano</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(y => (
                  <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botão exportar topo */}
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            className={`gap-2 ${canExport ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
            onClick={handleExportPDF}
            disabled={!canExport}
          >
            <FileDown className="w-3.5 h-3.5" />
            Exportar PDF
          </Button>
        </div>

        <Separator />

        {/* Conteúdo */}
        {!clientId ? (
          <div className="py-10 text-center">
            <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Selecione um cliente para ver o resumo</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-10 text-center">
            <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma parcela em {selectedMonthLabel} {year}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              para {selectedClient?.name}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cabeçalho do resumo */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">
                {selectedClient?.name} — {selectedMonthLabel} {year}
              </p>
            </div>

            {/* Grupos por loja */}
            {grouped.map((group, gIdx) => (
              <div key={gIdx} className="border border-border rounded-lg overflow-hidden">
                {/* Header da loja */}
                <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">{group.supplier_name}</span>
                </div>

                {/* Info do pedido */}
                <div className="px-4 py-2 bg-muted/20 border-b border-border">
                  <p className="text-xs text-muted-foreground">
                    Pedido <span className="font-semibold text-foreground">#{group.order_id}</span>
                    {group.order_date && (
                      <> — {format(new Date(group.order_date), "dd/MM/yyyy", { locale: ptBR })}</>
                    )}
                  </p>
                </div>

                {/* Parcelas */}
                <div className="divide-y divide-border">
                  {group.installments.map(inst => (
                    <div key={inst.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">
                          {inst.installment_number && inst.total_installments
                            ? `Parcela ${inst.installment_number}/${inst.total_installments}`
                            : 'Parcela'}
                          {' — '}
                          Vence {format(parseISO(inst.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          inst.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {inst.status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatBRL(Number(inst.value))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal do grupo */}
                <div className="px-4 py-2.5 bg-muted/30 border-t border-border flex justify-end">
                  <p className="text-xs text-muted-foreground">
                    Subtotal: <span className="font-semibold text-foreground">{formatBRL(group.subtotal)}</span>
                  </p>
                </div>
              </div>
            ))}

            <Separator />

            {/* Total */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 space-y-1">
              <p className="text-xs text-emerald-700">
                Total de parcelas em {selectedMonthLabel}: <span className="font-semibold">{totalCount} {totalCount === 1 ? 'parcela' : 'parcelas'}</span>
              </p>
              <p className="text-base font-bold text-emerald-800">
                Valor total a pagar em {selectedMonthLabel}: {formatBRL(totalValue)}
              </p>
            </div>

            {/* Botão exportar rodapé */}
            <div className="flex justify-end pb-2">
              <Button
                size="sm"
                className={`gap-2 ${canExport ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                onClick={handleExportPDF}
                disabled={!canExport}
              >
                <FileDown className="w-3.5 h-3.5" />
                Exportar PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
