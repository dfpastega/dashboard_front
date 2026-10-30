'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  Menu,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Building2,
  UserPlus,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { api } from '@/lib/api'
import type { UserContract } from '@/contexts/user-context'
import { gruposVisiveis, grupoDaRota } from './navegacao'

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
  /**
   * Além do role, exige ao menos um contrato desta modalidade.
   *
   * Role e modalidade são eixos independentes: o role diz o que a pessoa pode FAZER,
   * a modalidade do contrato diz o que existe para ela ver. Filtrar a afinidade só por
   * role deixaria a escolha entre mostrar "Beneficiários" para todo `user` do sistema
   * (inclusive contratos que não são afinidade) ou para nenhum.
   */
  requiresModality?: string
}

interface DashboardItem {
  id: string
  name: string
  slug: string
  filterType?: string
}

const staticNavigation: NavItem[] = [
  { title: 'Beneficiários', href: '/dashboard/beneficiarios',  icon: UserPlus, roles: ['user', 'contract_manager', 'admin', 'super_admin'], requiresModality: 'affinity' },
  { title: 'Meus Cupons',   href: '/dashboard/cupons',         icon: Ticket,   roles: ['partner', 'admin', 'super_admin'] },
  { title: 'Usuários',      href: '/dashboard/usuarios',       icon: Users,    roles: ['admin', 'super_admin'] },
  { title: 'Configurações', href: '/dashboard/configuracoes',  icon: Settings, roles: ['user', 'partner', 'contract_manager', 'admin', 'super_admin'] },
]

const CHAVE_RECOLHIDO = 'storm.sidebar.recolhido'

function SidebarContent({ userRole, userContracts, isCollapsed, onToggle }: {
  userRole: string
  userContracts: UserContract[]
  isCollapsed?: boolean
  onToggle?: () => void
}) {
  const pathname = usePathname() ?? ''
  const [dashboards, setDashboards] = useState<DashboardItem[]>([])
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set(['__home__']))

  const grupos = gruposVisiveis(userRole)

  /**
   * Abre só o grupo da rota atual.
   *
   * Com três grupos, abrir todos devolveria a lista longa que esta mudança veio
   * resolver: em 768px de altura ela não cabe. O grupo da página em que a pessoa
   * está é o único que ela precisa ver aberto ao chegar.
   */
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(() => {
    const atual = grupoDaRota(pathname)
    return new Set(atual ? [atual] : [])
  })

  // Navegar para outro grupo (pelo menu mobile, por um link, pelo histórico)
  // abre o grupo de destino sem fechar o que a pessoa tinha aberto à mão.
  useEffect(() => {
    const atual = grupoDaRota(pathname)
    if (!atual) return
    setGruposAbertos(prev => (prev.has(atual) ? prev : new Set(prev).add(atual)))
  }, [pathname])

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

  function toggleGrupo(id: string) {
    setGruposAbertos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const multiContract = userContracts.length > 1
  const isHomePath = pathname === '/dashboard' || pathname.startsWith('/dashboard?')

  /**
   * O gestor de contrato não vê o item "Dashboard" genérico.
   *
   * Ele existe para quem não tem dashboard próprio: monta o iframe padrão do Metabase
   * filtrado pelo contrato. O gestor recebe dashboards nomeados (o "Ativos", por exemplo),
   * e a home viraria uma segunda porta para a mesma coisa — com um nome pior.
   *
   * O acesso a /dashboard continua existindo; só sai do menu. Quem cair lá por URL é
   * redirecionado para Beneficiários quando o contrato é de afinidade.
   */
  const showHome = userRole !== 'contract_manager'
  const staticItems = staticNavigation.filter(item =>
    item.roles.includes(userRole) &&
    (!item.requiresModality || userContracts.some(c => c.modality === item.requiresModality))
  )

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
            aria-expanded={isOpen}
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
                    {c.isPrimary && <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">principal</span>}
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
          {!isCollapsed && <span className="truncate">{name}</span>}
        </Button>
      </Link>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center justify-between border-b px-4">
        {!isCollapsed ? (
          <>
            <h2 className="text-lg font-semibold">Menu</h2>
            {onToggle && (
              <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8" title="Recolher menu">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Recolher menu</span>
              </Button>
            )}
          </>
        ) : (
          onToggle && (
            <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 mx-auto" title="Expandir menu">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Expandir menu</span>
            </Button>
          )
        )}
      </div>

      {/*
        `min-h-0` é o que faz a barra rolar.

        Sem ele o item flex usa `min-height: auto` — ou seja, não encolhe abaixo da
        altura do próprio conteúdo — e o menu simplesmente transborda a tela em vez
        de rolar. Aparecia em qualquer monitor de 768px de altura com o Admin aberto.

        A rolagem é nativa, não o ScrollArea do Radix: ali a barra só é montada
        quando um ResizeObserver percebe o transbordo, e o menu é a última tela
        onde se quer depender disso. `rolagem-fina` (globals.css) dá a barra
        permanente que o padrão do macOS esconderia.
      */}
      <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <nav className="space-y-1">
          {/* ── Dashboard home ── */}
          {!showHome ? null : multiContract && !isCollapsed ? (
            <div>
              <Button
                variant={isHomePath ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start gap-3', isHomePath && 'bg-secondary')}
                onClick={() => toggle('__home__')}
                aria-expanded={openSlugs.has('__home__')}
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
                        {c.isPrimary && <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">principal</span>}
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
                  {!isCollapsed && <span className="truncate">{item.title}</span>}
                </Button>
              </Link>
            )
          })}

          {/* ── Grupos administrativos ── */}
          {grupos.length > 0 && !isCollapsed && (
            <p className="px-3 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Gestão
            </p>
          )}

          {grupos.map(grupo => {
            const GrupoIcon = grupo.icon
            const aberto = gruposAbertos.has(grupo.id)
            const temRotaAtiva = grupo.items.some(i => pathname === i.href || pathname.startsWith(`${i.href}/`))

            return (
              <div key={grupo.id} className={cn(isCollapsed && 'pt-1')}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full gap-3',
                    isCollapsed ? 'justify-center px-2' : 'justify-start',
                    // Grupo fechado com a página atual dentro: sem essa marca a
                    // pessoa perde de vista onde está assim que fecha o grupo.
                    temRotaAtiva && !aberto && 'bg-secondary/50',
                    aberto && !isCollapsed && 'font-medium',
                  )}
                  title={isCollapsed ? grupo.title : undefined}
                  aria-expanded={isCollapsed ? undefined : aberto}
                  onClick={() => {
                    // Recolhido não há onde desenhar os filhos: expande a barra
                    // e já deixa o grupo aberto, em vez de não fazer nada visível.
                    if (isCollapsed) {
                      setGruposAbertos(prev => new Set(prev).add(grupo.id))
                      onToggle?.()
                    } else {
                      toggleGrupo(grupo.id)
                    }
                  }}
                >
                  <GrupoIcon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 truncate text-left">{grupo.title}</span>
                      {aberto
                        ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
                    </>
                  )}
                </Button>

                {aberto && !isCollapsed && (
                  <div className="mt-1 ml-3 space-y-1 border-l pl-3">
                    {grupo.items.map(item => {
                      const Icon = item.icon
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive ? 'secondary' : 'ghost'}
                            size="sm"
                            className={cn('h-8 w-full justify-start gap-2.5', isActive && 'bg-secondary')}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate text-sm">{item.title}</span>
                          </Button>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export function Sidebar({ userRole, userContracts, className }: SidebarProps) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)

  // Lido depois da hidratação de propósito: ler localStorage no estado inicial
  // faz o HTML do servidor divergir do primeiro render do cliente.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CHAVE_RECOLHIDO) === '1') setDesktopCollapsed(true)
    } catch {
      // Modo privado / storage bloqueado: segue com o padrão expandido.
    }
  }, [])

  function alternar() {
    setDesktopCollapsed(atual => {
      const proximo = !atual
      try {
        window.localStorage.setItem(CHAVE_RECOLHIDO, proximo ? '1' : '0')
      } catch {
        // Preferência não persiste; a barra continua funcionando nesta sessão.
      }
      return proximo
    })
  }

  return (
    <aside className={cn('hidden lg:flex flex-col border-r bg-background transition-all duration-300', desktopCollapsed ? 'w-16' : 'w-64', className)}>
      <SidebarContent userRole={userRole} userContracts={userContracts} isCollapsed={desktopCollapsed} onToggle={alternar} />
    </aside>
  )
}

export function MobileSidebar({ userRole, userContracts }: { userRole: string; userContracts: UserContract[] }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Sem isso o menu continua aberto por cima da página recém-aberta.
  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[17rem] max-w-[85vw] p-0">
        {/* O Radix exige um título acessível no conteúdo do Sheet; aqui ele é
            só para leitor de tela, porque a barra já tem o seu próprio cabeçalho. */}
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SidebarContent userRole={userRole} userContracts={userContracts} />
      </SheetContent>
    </Sheet>
  )
}
