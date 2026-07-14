'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Building2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useUserContext } from '@/contexts/user-context'

interface Dashboard {
  id: string
  name: string
  description?: string
  slug: string
  filterType?: string
}

export default function DynamicDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = params?.slug as string
  const contractId = searchParams?.get('contractId') ?? null

  const { contracts } = useUserContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [needsContractSelection, setNeedsContractSelection] = useState(false)

  useEffect(() => {
    if (!slug) return
    loadDashboard()
  }, [slug, contractId])

  async function loadDashboard() {
    setLoading(true)
    setError(null)
    setNeedsContractSelection(false)

    try {
      // Descobre o filterType do dashboard — só dashboards filtrados por
      // contrato exigem a seleção de contrato.
      let filterType = 'none'
      try {
        const { data: list } = await api.get('/api/dashboards')
        const dash = (list ?? []).find((d: Dashboard) => d.slug === slug)
        if (dash?.filterType) filterType = dash.filterType
      } catch {
        /* na dúvida, segue sem exigir contrato */
      }

      const needsContract = filterType === 'contract_id'

      // Pede seleção só quando o dashboard filtra por contrato e há mais de um.
      if (needsContract && contracts.length > 1 && !contractId) {
        setNeedsContractSelection(true)
        setLoading(false)
        return
      }

      const effectiveContractId = needsContract
        ? (contractId ?? (contracts.length === 1 ? contracts[0].id : null))
        : null

      const url = effectiveContractId
        ? `/api/dashboards/${slug}/iframe?contractId=${encodeURIComponent(effectiveContractId)}`
        : `/api/dashboards/${slug}/iframe`

      const { data } = await api.get(url)
      setIframeUrl(data.iframeUrl)
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Você não tem permissão para acessar este dashboard.')
      } else if (err.response?.status === 404) {
        setError('Dashboard não encontrado.')
      } else {
        setError(err.response?.data?.error || 'Erro ao carregar dashboard. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  function selectContract(id: string) {
    router.push(`/dashboard/${slug}?contractId=${id}`)
  }

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

  if (needsContractSelection) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Selecione um contrato
            </CardTitle>
            <CardDescription>
              Escolha qual contrato deseja visualizar neste dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {contracts.map((contract) => (
              <Button
                key={contract.id}
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => selectContract(contract.id)}
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left">{contract.name}</span>
                {contract.isPrimary && (
                  <span className="text-xs text-muted-foreground">principal</span>
                )}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!iframeUrl) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dashboard Indisponível</AlertTitle>
          <AlertDescription>
            Não foi possível carregar o dashboard. Entre em contato com o suporte.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      {contracts.length > 1 && contractId && (
        <div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <span>
            Exibindo: <strong className="text-foreground">
              {contracts.find(c => c.id === contractId)?.name ?? contractId}
            </strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => router.push(`/dashboard/${slug}`)}
          >
            Trocar contrato
          </Button>
        </div>
      )}
      <iframe
        src={iframeUrl}
        frameBorder="0"
        width="100%"
        height="100%"
        allowTransparency
        className="min-h-[calc(100vh-4rem)]"
      />
    </div>
  )
}
