'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  Menu,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Shield,
  TicketPercent,
  Gauge,
  Mail,
  FileText,
  MessageCircle,
  MessagesSquare,
  Building2,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { api } from '@/lib/api'
import type { UserContract } from '@/contexts/user-context'

interface SidebarProps {
  userRole: string
  userContracts: UserContract[]
  className?: string
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
}

interface DashboardItem {
  id: string
  name: string
  slug: string
  filterType?: string
}

const adminGroup = {
  title: 'Admin',
  icon: Shield,
  roles: ['super_admin'],
  items: [
    { title: 'Dashboards',     href: '/dashboard/admin/dashboards',         icon: Gauge,         roles: ['super_admin'] },
    { title: 'Usuários',       href: '/dashboard/admin/usuarios',           icon: Users,         roles: ['super_admin'] },
    { title: 'Cupons',         href: '/dashboard/admin/cupons',             icon: TicketPercent, roles: ['super_admin'] },
    { title: 'Email Tracking', href: '/dashboard/admin/email-tracking',     icon: Mail,          roles: ['super_admin'] },
    { title: 'Contratos',      href: '/dashboard/admin/contratos',          icon: FileText,      roles: ['super_admin'] },
    { title: 'WhatsApp',       href: '/dashboard/admin/whatsapp-templates', icon: MessageCircle, roles: ['super_admin'] },
    { title: 'Conversas',      href: '/dashboard/admin/conversas',          icon: MessagesSquare, roles: ['super_admin'] },
  ],
}

const staticNavigation: NavItem[] = [
  { title: 'Meus Cupons',   href: '/dashboard/cupons',         icon: Ticket,   roles: ['partner', 'admin', 'super_admin'] },
  { title: 'Usuários',      href: '/dashboard/usuarios',       icon: Users,    roles: ['admin', 'super_admin'] },
  { title: 'Configurações', href: '/dashboard/configuracoes',  icon: Settings, roles: ['user', 'partner', 'contract_manager', 'admin', 'super_admin'] },
]

function SidebarContent({ userRole, userContracts, isCollapsed, onToggle }: {
  userRole: string
  userContracts: UserContract[]
  isCollapsed?: boolean
  onToggle?: () => void
}) {
  const pathname = usePathname() ?? ''
  const [dashboards, setDashboards] = useState<DashboardItem[]>([])
  const [adminOpen, setAdminOpen] = useState(() => pathname.startsWith('/dashboard/admin'))
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set(['__home__']))

  useEffect(() => {
    api.get('/api/dashboards')
      .then(({ data }) => setDashboards(data ?? []))
      .catch(() => setDashboards([]))
  }, [])

  function toggle(slug: string) {
    setOpenSlugs(prev => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }

  const multiContract = userContracts.length > 1
  const isHomePath = pathname === '/dashboard' || pathname.startsWith('/dashboard?')
  const showAdmin = adminGroup.roles.includes(userRole)
  const staticItems = staticNavigation.filter(item => item.roles.includes(userRole))

  // Render a nav item with optional contract submenu
  function renderDashboardItem(slug: string, name: string, baseHref: string, needsContract: boolean) {
    const isActive = pathname.startsWith(`/dashboard/${slug}`)

    if (needsContract && multiContract && !isCollapsed) {
      const isOpen = openSlugs.has(slug)
      return (
        <div key={slug}>
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            className={cn('w-full justify-start gap-3', isActive && 'bg-secondary')}
            onClick={() => toggle(slug)}
          >
            <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left truncate">{name}</span>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          </Button>
          {isOpen && (
            <div className="mt-1 ml-3 pl-3 border-l space-y-1">
              {userContracts.map(c => (
                <Link key={c.id} href={`${baseHref}?contractId=${c.id}`}>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 h-8">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-sm truncate">{c.name}</span>
                    {c.isPrimary && <span className="text-[10px] text-muted-foreground ml-auto">principal</span>}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      )
    }

    const href = needsContract && userContracts.length === 1
      ? `${baseHref}?contractId=${userContracts[0].id}`
      : baseHref

    return (
      <Link key={slug} href={href}>
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          className={cn('w-full gap-3', isCollapsed ? 'justify-center px-2' : 'justify-start', isActive && 'bg-secondary')}
          title={isCollapsed ? name : undefined}
        >
          <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && <span>{name}</span>}
        </Button>
      </Link>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b">
        {!isCollapsed ? (
          <>
            <h2 className="text-lg font-semibold">Menu</h2>
            {onToggle && (
              <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          onToggle && (
            <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 mx-auto" title="Expandir menu">
              <Menu className="h-5 w-5" />
            </Button>
          )
        )}
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {/* ── Dashboard home ── */}
          {multiContract && !isCollapsed ? (
            <div>
              <Button
                variant={isHomePath ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start gap-3', isHomePath && 'bg-secondary')}
                onClick={() => toggle('__home__')}
              >
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">Dashboard</span>
                {openSlugs.has('__home__')
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
              </Button>
              {openSlugs.has('__home__') && (
                <div className="mt-1 ml-3 pl-3 border-l space-y-1">
                  {userContracts.map(c => (
                    <Link key={c.id} href={`/dashboard?contractId=${c.id}`}>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 h-8">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-sm truncate">{c.name}</span>
                        {c.isPrimary && <span className="text-[10px] text-muted-foreground ml-auto">principal</span>}
                      </Button>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link href={userContracts.length === 1 ? `/dashboard?contractId=${userContracts[0]?.id ?? ''}` : '/dashboard'}>
              <Button
                variant={isHomePath ? 'secondary' : 'ghost'}
                className={cn('w-full gap-3', isCollapsed ? 'justify-center px-2' : 'justify-start', isHomePath && 'bg-secondary')}
                title={isCollapsed ? 'Dashboard' : undefined}
              >
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span>Dashboard</span>}
              </Button>
            </Link>
          )}

          {/* ── Dashboards dinâmicos (dash_dashboards) ── */}
          {dashboards.map(d =>
            renderDashboardItem(d.slug, d.name, `/dashboard/${d.slug}`, d.filterType === 'contract_id')
          )}

          {/* ── Itens estáticos ── */}
          {staticItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn('w-full gap-3', isCollapsed ? 'justify-center px-2' : 'justify-start', isActive && 'bg-secondary')}
                  title={isCollapsed ? item.title : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span>{item.title}</span>}
                </Button>
              </Link>
            )
          })}

          {/* ── Grupo Admin ── */}
          {showAdmin && (
            <div className="pt-1">
              <Button
                variant="ghost"
                className={cn('w-full gap-3', isCollapsed ? 'justify-center px-2' : 'justify-start', adminOpen && !isCollapsed && 'font-medium')}
                title={isCollapsed ? 'Admin' : undefined}
                onClick={() => { if (isCollapsed && onToggle) onToggle(); else setAdminOpen(o => !o) }}
              >
                <Shield className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">Admin</span>
                    {adminOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </>
                )}
              </Button>
              {adminOpen && !isCollapsed && (
                <div className="mt-1 ml-3 pl-3 border-l space-y-1">
                  {adminGroup.items.map(item => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button variant={isActive ? 'secondary' : 'ghost'} size="sm" className={cn('w-full justify-start gap-2.5 h-8', isActive && 'bg-secondary')}>
                          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="text-sm">{item.title}</span>
                        </Button>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </ScrollArea>
    </div>
  )
}

export function Sidebar({ userRole, userContracts, className }: SidebarProps) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  return (
    <aside className={cn('hidden lg:flex flex-col border-r bg-background transition-all duration-300', desktopCollapsed ? 'w-16' : 'w-64', className)}>
      <SidebarContent userRole={userRole} userContracts={userContracts} isCollapsed={desktopCollapsed} onToggle={() => setDesktopCollapsed(!desktopCollapsed)} />
    </aside>
  )
}

export function MobileSidebar({ userRole, userContracts }: { userRole: string; userContracts: UserContract[] }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <SidebarContent userRole={userRole} userContracts={userContracts} />
      </SheetContent>
    </Sheet>
  )
}
