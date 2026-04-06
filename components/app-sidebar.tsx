'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  CreditCard,
  FileText,
  BarChart2,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard',  href: '/',           icon: LayoutDashboard },
  { label: 'Clientes',   href: '/clientes',   icon: Users },
  { label: 'Pedidos',    href: '/pedidos',     icon: ShoppingBag },
  { label: 'Financeiro', href: '/financeiro',  icon: BarChart2 },
  { label: 'Parcelas',   href: '/parcelas',    icon: CreditCard },
  { label: 'PDF Fornecedor', href: '/relatorios',  icon: FileText },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <span className="font-semibold text-foreground tracking-tight">Gestao de Pedidos</span>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-60 bg-card border-r border-border z-50 flex flex-col transition-transform duration-200',
          'md:static md:translate-x-0 md:z-auto md:flex',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-sm tracking-tight">Gestao de Pedidos</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1 rounded hover:bg-accent transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Navegacao principal">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground">Sistema Interno &copy; {new Date().getFullYear()}</p>
        </div>
      </aside>
    </>
  )
}
