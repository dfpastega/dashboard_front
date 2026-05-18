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

  useEffect(() => {
    if (needsSelection) {
      setLoading(false)
      return
    }
    if (!resolvedContractId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    setIframeUrl(null)

    api.post('/api/metabase/iframe', { contractId: resolvedContractId })
      .then(({ data }) => { if (!cancelled) setIframeUrl(data.iframeUrl) })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || 'Dashboard temporariamente indisponível.') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [resolvedContractId, needsSelection])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
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
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
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
    <div className="h-full w-full -m-6">
      {contracts.length > 1 && contractIdParam && (
        <div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-muted-foreground bg-background">
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
          className="w-full border-0"
          style={{ height: contracts.length > 1 ? 'calc(100vh - 7rem)' : 'calc(100vh - 4rem)', minHeight: '600px' }}
          title="Metabase Dashboard"
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
