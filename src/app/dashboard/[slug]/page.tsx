'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface Dashboard {
  id: string
  name: string
  description?: string
  slug: string
}

export default function DynamicDashboardPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      if (!slug) return

      try {
        setLoading(true)
        setError(null)

        // Buscar URL do iframe do dashboard
        const { data } = await api.get(`/dashboards/${slug}/iframe`)
        setIframeUrl(data.iframeUrl)

        // Buscar informações do dashboard (opcional - para exibir título/descrição)
        // Podemos guardar isso em cache ou buscar da lista de dashboards
      } catch (err: any) {
        console.error('Erro ao carregar dashboard:', err)

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

    loadDashboard()
  }, [slug])

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
      {/* Iframe do Metabase */}
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
