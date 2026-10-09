import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { cn } from '@/lib/utils'
import { Cabecalho } from './_components/cabecalho'
import { Rodape } from './_components/rodape'
import { AvisoSimulacao } from './_components/aviso-simulacao'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'Piloto de inglês para o trade de Goiás · Sebrae + ABIH',
  description:
    'Cadastro de hotéis de Goiás interessados em participar do piloto de capacitação em inglês para o trade de turismo e hospitalidade. Sebrae + ABIH, powered by Storm.',
}

export default function PilotoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(montserrat.variable, 'piloto-goias flex min-h-screen flex-col bg-background text-foreground')}>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 font-semibold text-abih-marinho focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-2 focus:outline-abih-azul"
      >
        Pular para o conteúdo
      </a>
      <AvisoSimulacao />
      <Cabecalho />
      <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Rodape />
    </div>
  )
}
