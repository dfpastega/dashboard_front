'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import confetti from 'canvas-confetti'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [permanentShow, setPermanentShow] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { email, password })

      if (response.status === 200) {
        // 🎉 Confete antes de redirecionar
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        })

        // Aguardar um momento para a animação aparecer
        setTimeout(() => {
          router.push('/dashboard')
        }, 1000)
      }
    } catch (err: any) {
      const errorData = err.response?.data

      if (errorData?.isFirstAccess) {
        router.push(`/first-access?email=${encodeURIComponent(email)}`)
      } else {
        setError('🫠 Usuário ou senha inválidos.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClickEye = () => {
    if (permanentShow) return
    setShowPassword(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setShowPassword(false)
    }, 3000)
  }

  const handleDoubleClickEye = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setPermanentShow((prev) => {
      const newValue = !prev
      setShowPassword(newValue)
      return newValue
    })
  }

  return (
    <main className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top bar com logo */}
      <div className="w-full flex justify-start px-6 py-4">
        <Image src="/logo-storm.svg" alt="Storm Logo" width={120} height={40} priority />
      </div>

      {/* Formulário centralizado */}
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-6 py-6">
            <h1 className="text-2xl font-bold">Entrar</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium">
                👤 Usuário
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium">
                🔒 Senha
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={handleClickEye}
                    onDoubleClick={handleDoubleClickEye}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-xl"
                    tabIndex={-1}
                    title={permanentShow ? "Clique duplo para ocultar" : "Clique duplo para manter visível"}
                  >
                    {showPassword ? '👀' : '🫣'}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={loading}
              >
                {loading ? 'Entrando...' : "Let's go, ⚡ Storm!"}
              </Button>

              {/* Esqueci minha senha */}
              <div className="text-center mt-2">
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline cursor-pointer">
                  Esqueci minha senha
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
