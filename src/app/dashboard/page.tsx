'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { Building2, LayoutDashboard, Loader2 } from 'lucide-react'
import { useUserContext } from '@/contexts/user-context'

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { contracts } = useUserContext()

  const contractIdParam = searchParams?.get('contractId') ?? null

  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Determine which contractId to use
  const resolvedContractId = contractIdParam
    || (contracts.length === 1 ? contracts[0].id : null)
    || contracts.find(c => c.isPrimary)?.id
    || null

  const needsSelection = contracts.length > 1 && !contractIdParam

  // Contrato de afinidade não tem dashboard de desempenho para exibir: o que interessa
  // ao gestor é o consumo de vagas. Sem este desvio ele cairia num iframe do Metabase
  // filtrado por um contrato que ainda não tem alunos.
  const resolvedContract = contracts.find(c => c.id === resolvedContractId)
  const isAffinity = resolvedContract?.modality === 'affinity'

  useEffect(() => {
    if (!isAffinity || !resolvedContractId) return
    router.replace(`/dashboard/beneficiarios?contractId=${encodeURIComponent(resolvedContractId)}`)
  }, [isAffinity, resolvedContractId, router])

  useEffect(() => {
    if (needsSelection) {
      setLoading(false)
      return
    }
    if (!resolvedContractId) {
      setLoading(false)
      return
    }
    // O redirect acima já está a caminho; não gastar um token de embed à toa.
    if (isAffinity) return
    let cancelled = false
    setLoading(true)
    setError('')
    setIframeUrl(null)

    api.post('/api/metabase/iframe', { contractId: resolvedContractId })
      .then(({ data }) => { if (!cancelled) setIframeUrl(data.iframeUrl) })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || 'Dashboard temporariamente indisponível.') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [resolvedContractId, needsSelection, isAffinity])

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  // Seletor de contrato
  if (needsSelection) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Selecione um contrato
            </CardTitle>
            <CardDescription>
              Escolha qual contrato deseja visualizar no dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {contracts.map(contract => (
              <Button
                key={contract.id}
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => router.push(`/dashboard?contractId=${contract.id}`)}
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left">{contract.name}</span>
                {contract.isPrimary && <span className="text-xs text-muted-foreground">principal</span>}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Sem contrato associado
  if (!resolvedContractId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </CardTitle>
          <CardDescription>Seu painel de controle</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Você não possui um contrato associado. Entre em contato com o administrador.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <CardContent className="p-6">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const activeContract = contracts.find(c => c.id === contractIdParam)

  return (
    /*
      O iframe do Metabase ocupa a tela toda abaixo do cabeçalho.

      A altura vem de `100dvh - 4rem` (a faixa do cabeçalho) e o iframe pega o
      que sobra com `flex-1` — antes a conta era feita à mão e tinha dois
      problemas: subtraía 7rem quando havia a barra de contrato, o que errava
      por alguns pixels, e um `minHeight: 600px` que estourava a tela em
      qualquer celular deitado.

      As margens negativas anulam o padding do <main>; sem `w-full` para o box
      poder crescer até as duas bordas, em vez de parar antes da direita.
    */
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col sm:-m-6">
      {contracts.length > 1 && contractIdParam && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b bg-background px-4 py-2 text-sm text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <span>
            Exibindo: <strong className="text-foreground">{activeContract?.name ?? contractIdParam}</strong>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => router.push('/dashboard')}>
            Trocar contrato
          </Button>
        </div>
      )}
      {iframeUrl && (
        <iframe
          src={iframeUrl}
          className="min-h-0 w-full flex-1 border-0"
          title="Metabase Dashboard"
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
