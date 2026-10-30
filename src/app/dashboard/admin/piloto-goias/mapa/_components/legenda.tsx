'use client'

/**
 * Legenda do mapa. Um mapa de símbolos proporcionais é ilegível sem ela: sem
 * referência de tamanho, o leitor vê círculos diferentes e não sabe o que separa um
 * do outro. Mostra as duas codificações — tamanho e faixa de cor — porque ambas
 * carregam a mesma variável.
 */
import { FAIXAS, raiosDaLegenda } from '../_lib/escala'

export function Legenda({ minimo, maximo, escuro }: { minimo: number; maximo: number; escuro: boolean }) {
  const marcos = raiosDaLegenda(minimo, maximo)
  const maiorRaio = marcos.length ? marcos[marcos.length - 1].raio : 26

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          Tamanho = funcionários
        </p>
        <div className="flex items-end gap-4" style={{ height: maiorRaio * 2 + 20 }}>
          {marcos.map(({ valor, raio }) => (
            <div key={valor} className="flex flex-col items-center justify-end gap-1">
              <span
                className="rounded-full border-2 border-background bg-muted-foreground/35"
                style={{ width: raio * 2, height: raio * 2 }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground text-xs tabular-nums">{valor}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">Faixa de porte</p>
        <ul className="space-y-1.5">
          {FAIXAS.map((f) => (
            <li key={f.rotulo} className="flex items-center gap-2 text-sm">
              <span
                className="border-background h-3.5 w-3.5 shrink-0 rounded-full border-2"
                style={{ backgroundColor: escuro ? f.corEscura : f.cor }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{f.rotulo}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
