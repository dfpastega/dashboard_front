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
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let mounted = true

    const fetchData = async () => {
      try {
        // Buscar dados do usuário
        const { data: userData } = await api.get('/auth/me')
        console.log('✅ Dados do usuário:', userData)
        if (!mounted) return
        setUser(userData)

        // Buscar URL do Metabase
        if (userData.contractId) {
          try {
            console.log('📊 Solicitando iframe do Metabase para contractId:', userData.contractId)
            const { data: iframeData } = await api.post('/api/metabase/iframe', {
              contractId: userData.contractId
            })
            console.log('✅ URL do iframe recebida:', iframeData.iframeUrl)
            console.log('🔍 Testando URL diretamente...')

            // Testar se a URL funciona antes de setar no iframe
            fetch(iframeData.iframeUrl, { mode: 'no-cors' })
              .then(() => console.log('✅ URL acessível'))
              .catch(err => console.error('❌ URL inacessível:', err))

            if (!mounted) return
            setIframeUrl(iframeData.iframeUrl)
          } catch (metabaseError: any) {
            console.error('❌ Erro ao carregar Metabase:', {
              status: metabaseError.response?.status,
              data: metabaseError.response?.data,
              message: metabaseError.message
            })
            if (!mounted) return
            const errorMsg = metabaseError.response?.data?.error || 'Dashboard temporariamente indisponível. Verifique as configurações de embedding no Metabase.'
            setError(errorMsg)
          }
        } else {
          console.log('⚠️ Usuário não possui contractId')
        }
      } catch (error: any) {
        console.error('❌ Erro ao carregar dados do usuário:', error)
        if (!mounted) return
        setError('Erro ao carregar dados do usuário')
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

      {error ? (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="p-6">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      ) : iframeUrl ? (
        <iframe
          src={iframeUrl}
          className="w-full border-0"
          style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}
          title="Metabase Dashboard"
        />
      ) : (
        <div className="text-sm text-muted-foreground">
          Carregando visualizações...
        </div>
      )}
    </div>
  )
}
