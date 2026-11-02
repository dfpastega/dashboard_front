'use client'

/**
 * Navegação entre as telas do Agente Comercial.
 *
 * São sub-rotas em vez de abas porque o repositório não tem o componente de tabs, e
 * porque cada tela carrega dados próprios: rota separada mantém o link compartilhável
 * e o estado de paginação no lugar certo.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PAGINA } from './_lib'

const ABAS = [
  { href: PAGINA, rotulo: 'Achados' },
  { href: `${PAGINA}/estabelecimentos`, rotulo: 'Estabelecimentos' },
  { href: `${PAGINA}/execucoes`, rotulo: 'Execuções' },
  { href: `${PAGINA}/configuracao`, rotulo: 'Configuração' },
]

export function NavAgente() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-px" aria-label="Seções do agente comercial">
      {ABAS.map((aba) => {
        const ativa = pathname === aba.href
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? 'page' : undefined}
            className={cn(
              'rounded-t-md px-3 py-2 text-sm transition-colors',
              ativa
                ? 'border-b-2 border-primary font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {aba.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
