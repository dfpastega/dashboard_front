import Link from 'next/link'
import { INSCRICOES, ROTAS } from '../_lib/config'
import { FaixaMarcas } from './marcas'

export function Cabecalho() {
  return (
    <header className="bg-abih-marinho text-white">
      <div className="border-b border-white/10">
        <FaixaMarcas className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6" />
      </div>
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"
      >
        <Link
          href={ROTAS.landing}
          className="rounded-md font-display leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="block text-base font-bold sm:text-lg">Plano de Capacitação em Inglês</span>
          <span className="block text-xs font-medium text-white/75">
            Trade de turismo e hospitalidade · Goiás
          </span>
        </Link>
        <ul className="flex items-center gap-2 sm:gap-4">
          <li className={INSCRICOES.encerradas ? undefined : "hidden md:block"}>
            <Link
              href={ROTAS.sobre}
              className="rounded-md px-2 py-1 text-sm font-medium text-white/90 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Sobre o plano de capacitação
            </Link>
          </li>
          {/* Com as inscrições encerradas o convite sai do cabeçalho: levaria ao aviso
              de encerramento, não a um formulário. */}
          {!INSCRICOES.encerradas && (
            <li>
              <Link
                href={ROTAS.formulario}
                className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-abih-azul px-4 text-sm font-semibold text-white transition-colors hover:bg-abih-azul-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5"
              >
                <span className="sm:hidden">Cadastrar hotel</span>
                <span className="hidden sm:inline">Cadastrar meu hotel</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  )
}
