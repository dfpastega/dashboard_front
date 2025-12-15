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
  Shield,
  TicketPercent
} from 'lucide-react'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

interface SidebarProps {
  userRole: string
  className?: string
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
}

const navigation: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['user', 'partner', 'contract_manager', 'admin', 'super_admin']
  },
  {
    title: 'Meus Cupons',
    href: '/dashboard/cupons',
    icon: Ticket,
    roles: ['partner', 'admin', 'super_admin']
  },
  {
    title: 'Admin - Usuários',
    href: '/dashboard/admin/usuarios',
    icon: Shield,
    roles: ['super_admin']
  },
  {
    title: 'Admin - Cupons',
    href: '/dashboard/admin/cupons',
    icon: TicketPercent,
    roles: ['super_admin']
  },
  {
    title: 'Usuários',
    href: '/dashboard/usuarios',
    icon: Users,
    roles: ['admin', 'super_admin']
  },
  {
    title: 'Configurações',
    href: '/dashboard/configuracoes',
    icon: Settings,
    roles: ['user', 'partner', 'contract_manager', 'admin', 'super_admin']
  }
]

function SidebarContent({ userRole, isCollapsed, onToggle }: {
  userRole: string
  isCollapsed?: boolean
  onToggle?: () => void
}) {
  const pathname = usePathname()

  const filteredNav = navigation.filter(item =>
    item.roles.includes(userRole)
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header com mesma altura do header principal (h-16) */}
      <div className="flex items-center justify-between h-16 px-4 border-b">
        {!isCollapsed ? (
          <>
            <h2 className="text-lg font-semibold">Menu</h2>
            {onToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          onToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 mx-auto"
              title="Expandir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )
        )}
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full gap-3',
                    isCollapsed ? 'justify-center px-2' : 'justify-start',
                    isActive && 'bg-secondary'
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span>{item.title}</span>}
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )
}

export function Sidebar({ userRole, className }: SidebarProps) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r bg-background transition-all duration-300',
        desktopCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <SidebarContent
        userRole={userRole}
        isCollapsed={desktopCollapsed}
        onToggle={() => setDesktopCollapsed(!desktopCollapsed)}
      />
    </aside>
  )
}

// Componente separado para o menu mobile
export function MobileSidebar({ userRole }: { userRole: string }) {
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
        <SidebarContent userRole={userRole} />
      </SheetContent>
    </Sheet>
  )
}
