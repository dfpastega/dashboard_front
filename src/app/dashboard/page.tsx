'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import axios from 'axios'
import {api} from '@/lib/api'

interface User {
  email: string
  contractId: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    const fetchUserAndIframe = async () => {
      try {
        const { data: userData } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          withCredentials: true,
        })
        if (!mounted) return
        setUser(userData)
  
        const { data: iframeData } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/metabase/iframe`,
          { contractId: userData.contractId },
          { withCredentials: true }
        )
        if (!mounted) return
        setIframeUrl(iframeData.iframeUrl)
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        router.push('/')
      }finally {
        if (mounted) setLoading(false)
      }
    }
  
    fetchUserAndIframe()
    return () => { mounted = false }
  }, [router])
  

  const handleLogout = async () => {
    setLoading(true)
    await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`)
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Topbar */}
      <div className="w-full flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Image src="/logo-storm.svg" alt="Storm Logo" width={120} height={40} />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button onClick={handleLogout} size="sm" variant="secondary" disabled={loading}>
            {loading ? 'Saindo...' : 'Sair'}
          </Button>
        </div>
      </div>

      {/* Metabase iframe */}
      <div className="w-full h-[calc(100vh-80px)]">
        {iframeUrl ? (
          <iframe src={iframeUrl} className="w-full h-full border-0" />
        ) : (
          <div className="flex items-center justify-center h-full">Carregando dashboard...</div>
        )}
      </div>
    </main>
  )
}
