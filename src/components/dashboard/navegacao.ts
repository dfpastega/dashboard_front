/**
 * Mapa de navegação do dashboard.
 *
 * Está num módulo separado do componente porque é a fonte da verdade sobre
 * "quem vê o quê" no menu — e porque a próxima mudança prevista é de dados,
 * não de layout: criar o perfil `comercial`.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * COMO LIBERAR UM GRUPO PARA UM NOVO PERFIL
 *
 * 1. Aqui: acrescente o role em `roles` do grupo E em `roles` de cada item
 *    que ele pode abrir. Os dois eixos são checados de forma independente,
 *    então dá para abrir o grupo Comercial inteiro menos um item.
 * 2. No backend (`../dashboard`): libere as rotas correspondentes. Este
 *    arquivo só decide o que aparece no menu — não é controle de acesso.
 *    Esconder o item sem mexer no backend deixa a rota acessível por URL.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { ComponentType } from 'react'
import {
  Shield,
  Bot,
  Briefcase,
  Gauge,
  Users,
  FileText,
  MessageCircle,
  MessagesSquare,
  Layers,
  GalleryHorizontalEnd,
  Mail,
  Handshake,
  Hotel,
  TicketPercent,
} from 'lucide-react'

type Icone = ComponentType<{ className?: string }>

export interface ItemNav {
  title: string
  href: string
  icon: Icone
  roles: string[]
}

export interface GrupoNav {
  /** Usado como chave do estado de aberto/fechado. Não aparece na tela. */
  id: string
  title: string
  icon: Icone
  /** Quem enxerga o grupo. Um grupo sem itens visíveis não é renderizado. */
  roles: string[]
  items: ItemNav[]
}

const SUPER = ['super_admin']

export const GRUPOS_ADMIN: GrupoNav[] = [
  {
    id: 'admin',
    title: 'Administração',
    icon: Shield,
    roles: SUPER,
    items: [
      { title: 'Dashboards', href: '/dashboard/admin/dashboards', icon: Gauge,    roles: SUPER },
      { title: 'Usuários',   href: '/dashboard/admin/usuarios',   icon: Users,    roles: SUPER },
      { title: 'Contratos',  href: '/dashboard/admin/contratos',  icon: FileText, roles: SUPER },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Studio',
    icon: Bot,
    roles: SUPER,
    items: [
      { title: 'WhatsApp',     href: '/dashboard/admin/whatsapp-templates', icon: MessageCircle,        roles: SUPER },
      { title: 'Conversas',    href: '/dashboard/admin/conversas',          icon: MessagesSquare,       roles: SUPER },
      { title: 'Flows Studio', href: '/dashboard/admin/flows',              icon: Layers,               roles: SUPER },
      { title: 'Carrossel',    href: '/dashboard/admin/carrossel',          icon: GalleryHorizontalEnd, roles: SUPER },
    ],
  },
  {
    id: 'comercial',
    title: 'Comercial',
    icon: Briefcase,
    roles: SUPER,
    items: [
      { title: 'Email Tracking',    href: '/dashboard/admin/email-tracking', icon: Mail,          roles: SUPER },
      { title: 'Afinidade',         href: '/dashboard/admin/afinidade',      icon: Handshake,     roles: SUPER },
      // Cadastros da landing /piloto-ingles-goias.
      { title: 'Capacitação Goiás', href: '/dashboard/admin/piloto-goias',   icon: Hotel,         roles: SUPER },
      { title: 'Cupons',            href: '/dashboard/admin/cupons',         icon: TicketPercent, roles: SUPER },
    ],
  },
]

/** Grupos com ao menos um item visível para o role, já com os itens filtrados. */
export function gruposVisiveis(role: string): GrupoNav[] {
  return GRUPOS_ADMIN
    .filter(g => g.roles.includes(role))
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(role)) }))
    .filter(g => g.items.length > 0)
}

/**
 * Grupo que contém a rota atual, para abrir sozinho ao entrar na página.
 *
 * Compara por prefixo porque as páginas têm sub-rotas (`/piloto-goias/mapa`),
 * e pega o `href` mais longo que casa para não deixar um prefixo curto
 * sequestrar a rota de outro item.
 */
export function grupoDaRota(pathname: string): string | null {
  let achado: { id: string; tamanho: number } | null = null

  for (const grupo of GRUPOS_ADMIN) {
    for (const item of grupo.items) {
      const casa = pathname === item.href || pathname.startsWith(`${item.href}/`)
      if (casa && (!achado || item.href.length > achado.tamanho)) {
        achado = { id: grupo.id, tamanho: item.href.length }
      }
    }
  }

  return achado?.id ?? null
}
