'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { LayoutDashboard } from 'lucide-react'

interface User {
  id: string
  email: string
  name?: string
  roleId: string
  contractId?: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchData = async () => {
      try {
        // Buscar dados do usuário
        const { data: userData } = await api.get('/auth/me')
        if (!mounted) return
        setUser(userData)

        // Buscar URL do Metabase
        if (userData.contractId) {
          const { data: iframeData } = await api.post('/metabase/iframe', {
            contractId: userData.contractId
          })
          if (!mounted) return
          setIframeUrl(iframeData.iframeUrl)
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user?.contractId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </CardTitle>
          <CardDescription>
            Seu painel de controle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Você não possui um contrato associado. Entre em contato com o administrador.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visualize suas métricas e informações
        </p>
      </div>

      {iframeUrl ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <iframe
              src={iframeUrl}
              className="w-full border-0"
              style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}
              title="Metabase Dashboard"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Carregando visualizações...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
