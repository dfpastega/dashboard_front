'use client'

/**
 * Mapa de símbolos proporcionais dos hotéis inscritos.
 *
 * Leaflet é manipulado direto, sem react-leaflet: são ~40 marcadores estáticos, e a
 * camada de reconciliação do React não traria nada aqui além de uma dependência.
 *
 * O componente só monta no cliente (Leaflet toca `window` na importação), por isso a
 * página o carrega com `dynamic(..., { ssr: false })`.
 */
import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, CircleMarker } from 'leaflet'
import { faixaDe, raioDe } from '../_lib/escala'
import type { PontoMapa } from '../_lib/tipos'

type Props = {
  pontos: PontoMapa[]
  escuro: boolean
  /** Hotel em destaque, quando a lista lateral é usada para navegar. */
  focado: string | null
  onFocar: (id: string | null) => void
}

export function MapaHoteis({ pontos, escuro, focado, onFocar }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<LeafletMap | null>(null)
  const marcadoresRef = useRef<Map<string, CircleMarker>>(new Map())

  useEffect(() => {
    if (!elRef.current || mapaRef.current) return
    let cancelado = false

    // Importação dinâmica: o módulo do Leaflet precisa de `window`.
    void import('leaflet').then((L) => {
      if (cancelado || !elRef.current) return

      const mapa = L.map(elRef.current, { scrollWheelZoom: true, attributionControl: true })
      mapaRef.current = mapa

      // Tiles claros ou escuros conforme o tema do painel. Os dois são gratuitos e
      // sem chave de API; a atribuição é obrigatória pela licença — não remover.
      //
      // Isto não é apenas cosmético: a rampa de cor dos marcadores foi escolhida contra
      // o fundo correspondente. Tile claro com a rampa escura, tile escuro com a clara.
      if (escuro) {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }).addTo(mapa)
      } else {
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa)
      }

      const funcionarios = pontos.map((p) => p.employees)
      const minimo = Math.min(...funcionarios)
      const maximo = Math.max(...funcionarios)

      // Maiores primeiro, para que os menores fiquem por cima e continuem clicáveis.
      const ordenados = [...pontos].sort((a, b) => b.employees - a.employees)

      // Hotéis que caíram na MESMA coordenada ficariam perfeitamente empilhados e só o
      // último seria clicável. Espalha-os num pequeno círculo em torno do ponto, de
      // forma determinística (mesma ordem, mesmo desenho). O deslocamento é de ~150 m
      // e só se aplica a quem colide — quem tem posição única não é movido.
      const grupos = new Map<string, number>()
      const deslocado = (p: PontoMapa, i: number): [number, number] => {
        const chave = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`
        const quantos = ordenados.filter(
          (o) => `${o.latitude.toFixed(5)},${o.longitude.toFixed(5)}` === chave
        ).length
        if (quantos < 2) return [p.latitude, p.longitude]
        const posicao = grupos.get(chave) ?? 0
        grupos.set(chave, posicao + 1)
        const angulo = (2 * Math.PI * posicao) / quantos
        const raioGraus = 0.0014 // ~150 m
        return [p.latitude + raioGraus * Math.sin(angulo), p.longitude + raioGraus * Math.cos(angulo)]
      }

      for (const [indice, p] of ordenados.entries()) {
        const faixa = faixaDe(p.employees)
        const cor = escuro ? faixa.corEscura : faixa.cor
        const [lat, lng] = deslocado(p, indice)
        const marcador = L.circleMarker([lat, lng], {
          radius: raioDe(p.employees, minimo, maximo),
          fillColor: cor,
          fillOpacity: 0.78,
          // Anel na cor da superfície: mantém os círculos legíveis onde se sobrepõem.
          color: escuro ? '#1a1a19' : '#ffffff',
          weight: 2,
        }).addTo(mapa)

        const aviso =
          p.geoPrecision === 'municipio'
            ? 'Localização aproximada: o endereço não foi encontrado, o ponto marca o centro do município.'
            : p.geoPrecision === 'rua'
              ? 'Localização aproximada: o número não foi encontrado, o ponto marca a rua.'
              : null
        marcador.bindPopup(
          `<div style="min-width:180px">
             <strong style="font-size:13px">${escaparHtml(p.hotelName)}</strong><br/>
             <span style="color:#5b6b7b;font-size:12px">${escaparHtml(p.city)}/${escaparHtml(p.state)}</span>
             <div style="margin-top:6px;font-size:13px">
               <strong>${p.employees}</strong> funcionário${p.employees === 1 ? '' : 's'}
             </div>
             ${aviso ? `<div style="margin-top:6px;font-size:11px;color:#b45309">${aviso}</div>` : ''}
           </div>`
        )
        marcador.on('click', () => onFocar(p.id))
        marcadoresRef.current.set(p.id, marcador)
      }

      if (ordenados.length) {
        mapa.fitBounds(
          L.latLngBounds(ordenados.map((p) => [p.latitude, p.longitude] as [number, number])),
          { padding: [48, 48] }
        )
      }
    })

    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
      marcadoresRef.current.clear()
    }
  }, [pontos, escuro, onFocar])

  // Abre o popup de quem foi escolhido na lista lateral.
  useEffect(() => {
    if (!focado) return
    const m = marcadoresRef.current.get(focado)
    const mapa = mapaRef.current
    if (!m || !mapa) return
    mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 12), { animate: true })
    m.openPopup()
  }, [focado])

  return <div ref={elRef} className="h-full w-full rounded-xl" role="application" aria-label="Mapa dos hotéis inscritos" />
}

function escaparHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}
