'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, Phone, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Textarea } from '@/components/ui/textarea'
import type { Client } from '@/lib/types'
import ClientDetailSheet from '@/components/client-detail-sheet'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const emptyForm = { name: '', phone: '', notes: '' }

export default function ClientesPage() {
  const { data: clients, isLoading, mutate } = useSWR<Client[]>('/api/clients', fetcher)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = clients?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search),
  )

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone ?? '', notes: c.notes ?? '' })
    setFormOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = editing
        ? await fetch(`/api/clients/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
        : await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
      if (!res.ok) { toast.error('Erro ao salvar cliente'); return }
      await mutate()
      setFormOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Erro ao excluir cliente'); return }
    await mutate()
    setDeleteId(null)
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {clients ? `${clients.length} cliente${clients.length !== 1 ? 's' : ''} cadastrado${clients.length !== 1 ? 's' : ''}` : 'Gerencie seus clientes'}
          </p>
        </div>
        <Button onClick={openCreate} size="lg" className="gap-2 font-semibold px-5 shadow-sm">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      <div className="mb-5">
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
              </p>
              {search ? (
                <p className="text-xs text-muted-foreground mt-1">Tente buscar por outro nome ou telefone</p>
              ) : (
                <Button onClick={openCreate} size="sm" className="mt-4 gap-2">
                  <Plus className="w-3.5 h-3.5" /> Cadastrar primeiro cliente
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered?.map(client => {
                const debt = Number(client.total_debt ?? 0)
                const hasDebt = debt > 0

                return (
                  <div key={client.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors group">
                    <button
                      className="flex items-center gap-4 flex-1 text-left min-w-0"
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-accent-foreground">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {client.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {client.phone}
                            </span>
                          )}
                          {hasDebt ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                              {formatBRL(debt)} em aberto
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Sem pendencias
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <div className="flex items-center gap-0.5 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(client)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(client.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observacoes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Anotacoes sobre o cliente..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Todos os pedidos e parcelas relacionados serao removidos.
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

      {/* Client Detail Sheet */}
      <ClientDetailSheet
        clientId={selectedClientId}
        onClose={() => setSelectedClientId(null)}
      />
    </div>
  )
}
