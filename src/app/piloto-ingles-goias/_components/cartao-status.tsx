import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Cartão central usado nas telas do fluxo (aviso de e-mail, confirmação, agradecimento). */
export function CartaoStatus({
  icone,
  tom = 'neutro',
  titulo,
  children,
  acoes,
}: {
  icone: ReactNode
  tom?: 'neutro' | 'sucesso' | 'erro'
  titulo: string
  children: ReactNode
  acoes?: ReactNode
}) {
  return (
    <section className="px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-10">
        <div
          aria-hidden
          className={cn(
            'mx-auto mb-5 flex size-14 items-center justify-center rounded-full [&_svg]:size-7',
            tom === 'sucesso' && 'bg-emerald-100 text-emerald-700',
            tom === 'erro' && 'bg-red-100 text-destructive',
            tom === 'neutro' && 'bg-accent text-abih-azul',
          )}
        >
          {icone}
        </div>
        <h1 className="font-display text-2xl font-bold text-abih-marinho text-balance sm:text-3xl">
          {titulo}
        </h1>
        <div className="mt-4 space-y-3 text-base text-muted-foreground [&_strong]:text-foreground">
          {children}
        </div>
        {acoes && <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{acoes}</div>}
      </div>
    </section>
  )
}

/** Classes de link com cara de botão, nas cores do piloto. */
export const linkBotao = {
  primario:
    'inline-flex h-11 items-center justify-center rounded-full bg-abih-azul px-6 text-sm font-semibold text-white transition-colors hover:bg-abih-azul-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-abih-azul',
  secundario:
    'inline-flex h-11 items-center justify-center rounded-full border border-abih-marinho/30 px-6 text-sm font-semibold text-abih-marinho transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-abih-azul',
}
