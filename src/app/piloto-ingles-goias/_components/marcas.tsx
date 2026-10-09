import Image from 'next/image'
import { cn } from '@/lib/utils'
import { MARCAS, type Marca } from '../_lib/config'

function Logo({ marca }: { marca: Marca }) {
  const imagem = (
    <Image
      src={marca.src}
      alt={marca.nome}
      width={marca.width}
      height={marca.height}
      className="h-6 w-auto sm:h-7"
    />
  )
  if (!marca.selo) return imagem
  return <span className="inline-flex items-center rounded-md bg-white px-2 py-1">{imagem}</span>
}

/** Faixa "Realização Sebrae · ABIH | powered by Storm". */
export function FaixaMarcas({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-white/80', className)}>
      <p className="flex items-center gap-2.5">
        <span>Realização</span>
        <Logo marca={MARCAS.sebrae} />
        <Logo marca={MARCAS.abih} />
      </p>
      <span aria-hidden className="hidden h-5 w-px bg-white/25 sm:block" />
      <p className="flex items-center gap-3">
        <span>powered by</span>
        <Logo marca={MARCAS.storm} />
      </p>
    </div>
  )
}
