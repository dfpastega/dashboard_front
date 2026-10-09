'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { modoSimulacao, type ModoSimulacao } from '../_lib/cadastro-service'

/** Faixa exibida só na pré-visualização (`?simular=` fora de produção). */
export function AvisoSimulacao() {
  const pathname = usePathname()
  const [modo, setModo] = useState<ModoSimulacao>(null)

  // Relê a cada troca de rota: o layout não remonta entre as telas do fluxo.
  useEffect(() => {
    setModo(modoSimulacao())
  }, [pathname])

  if (!modo) return null
  return (
    <div role="note" className="bg-amber-300 px-4 py-2 text-center text-sm font-medium text-amber-950">
      Pré-visualização ({modo === 'sucesso' ? 'fluxo de sucesso' : 'fluxo com erro'}): nenhum dado foi
      enviado e nenhum e-mail foi disparado.
    </div>
  )
}
