'use client'

/**
 * Mapa dos hotéis inscritos no plano de capacitação de Goiás.
 *
 * Responde a duas perguntas que a tabela não responde: onde eles estão, e qual o
 * porte de cada um em relação aos vizinhos. O tamanho do marcador codifica a
 * quantidade de funcionários por área (ver `_lib/escala.ts`); o clique abre o nome
 * do empreendimento.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, MapPinOff, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { Legenda } from './_components/legenda'
import type { RespostaMapa } from './_lib/tipos'
import 'leaflet/dist/leaflet.css'

// Leaflet toca `window` ao ser importado: nada de renderizar no servidor.
const MapaHoteis = dynamic(() => import('./_components/mapa-hoteis').then((m) => m.MapaHoteis), {
  ssr: false,
  loading: () => <div className="bg-muted h-full w-full animate-pulse rounded-xl" />,
})

export default function MapaPilotoGoiasPage() {
  const [dados, setDados] = useState<RespostaMapa | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [focado, setFocado] = useState<string | null>(null)
  const [escuro, setEscuro] = useState(false)

  // Acompanha o tema do painel para o mapa não destoar.
  useEffect(() => {
    const raiz = document.documentElement
    const ler = () => setEscuro(raiz.classList.contains('dark'))
    ler()
    const obs = new MutationObserver(ler)
    obs.observe(raiz, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    let vivo = true
    api
      .get<RespostaMapa>('/api/piloto-goias/admin/mapa')
      .then(({ data }) => vivo && setDados(data))
      .catch(() => vivo && setErro('Não foi possível carregar o mapa.'))
    return () => {
      vivo = false
    }
  }, [])

  const onFocar = useCallback((id: string | null) => setFocado(id), [])

  const { minimo, maximo, totalFuncionarios } = useMemo(() => {
    const v = dados?.pontos.map((p) => p.employees) ?? []
    return {
      minimo: v.length ? Math.min(...v) : 0,
      maximo: v.length ? Math.max(...v) : 0,
      totalFuncionarios: v.reduce((a, b) => a + b, 0),
    }
  }, [dados])

  const aproximados = dados?.pontos.filter((p) => p.geoPrecision !== 'endereco').length ?? 0

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Capacitação Goiás — mapa dos inscritos</h1>
          <p className="text-muted-foreground text-sm">
            {dados
              ? `${dados.total} hotéis no mapa · ${totalFuncionarios.toLocaleString('pt-BR')} funcionários`
              : 'Carregando…'}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/admin/piloto-goias">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar à lista
          </Link>
        </Button>
      </div>

      {erro && (
        <Card>
          <CardContent className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <TriangleAlert className="h-4 w-4" />
            {erro}
          </CardContent>
        </Card>
      )}

      {dados && dados.semCoordenada > 0 && (
        <Card className="border-amber-500/40">
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>{dados.semCoordenada}</strong>{' '}
              {dados.semCoordenada === 1 ? 'cadastro não aparece' : 'cadastros não aparecem'} no mapa por não ter
              coordenada. O endereço continua na lista.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card className="overflow-hidden p-0">
          <div className="h-[600px] w-full">
            {dados && dados.pontos.length > 0 ? (
              <MapaHoteis pontos={dados.pontos} escuro={escuro} focado={focado} onFocar={onFocar} />
            ) : (
              <div className="bg-muted h-full w-full animate-pulse" />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Como ler o mapa</CardDescription>
            </CardHeader>
            <CardContent>
              {dados ? (
                <Legenda minimo={minimo} maximo={maximo} escuro={escuro} />
              ) : (
                <div className="bg-muted h-32 animate-pulse rounded" />
              )}
            </CardContent>
          </Card>

          {aproximados > 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-4 text-xs leading-relaxed">
                <strong className="text-foreground">{aproximados}</strong>{' '}
                {aproximados === 1 ? 'hotel tem posição aproximada' : 'hotéis têm posição aproximada'}: o
                endereço informado não foi encontrado com precisão, e o ponto marca a rua ou o centro do
                município. O popup avisa em qual dos dois casos está.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Maiores empregadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {(dados?.pontos ?? []).slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFocado(p.id)}
                  className="hover:bg-muted focus-visible:ring-ring flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="truncate">{p.hotelName}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">{p.employees}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
