import Link from 'next/link'
import { ROTAS } from '../_lib/config'
import { FaixaMarcas } from './marcas'

export function Rodape() {
  return (
    <footer className="bg-abih-marinho-escuro text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <FaixaMarcas />
        <div className="flex flex-col gap-2 text-sm text-white/75 sm:flex-row sm:items-center sm:justify-between">
          <p>Piloto de capacitação em inglês para o trade de turismo e hospitalidade de Goiás.</p>
          <Link
            href={ROTAS.politicaPrivacidade}
            className="font-medium text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Política de Privacidade
          </Link>
        </div>
      </div>
    </footer>
  )
}
