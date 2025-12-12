'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  Menu,
  X
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

function SidebarContent({ userRole }: { userRole: string }) {
  const pathname = usePathname()

  const filteredNav = navigation.filter(item =>
    item.roles.includes(userRole)
  )

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <h2 className="text-lg font-semibold">Menu</h2>
      </div>

      <Separator />

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
                    'w-full justify-start gap-3',
                    isActive && 'bg-secondary'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
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
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-40">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent userRole={userRole} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col w-64 border-r bg-background',
          className
        )}
      >
        <SidebarContent userRole={userRole} />
      </aside>
    </>
  )
}
