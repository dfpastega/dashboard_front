'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [devToken, setDevToken] = useState('')
  const [devLink, setDevLink] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    setDevToken('')
    setDevLink('')

    try {
      const response = await api.post('/auth/forgot-password', { email })
      setMessage(response.data.message || 'Se o email existir, você receberá instruções para redefinir sua senha.')

      // Em desenvolvimento, o backend retorna o token e link
      if (response.data.devToken) {
        setDevToken(response.data.devToken)
      }
      if (response.data.devLink) {
        setDevLink(response.data.devLink)
      }

      setEmail('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao solicitar redefinição de senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 mt-4">
          <div>
            <h1 className="text-2xl font-bold">Esqueci minha senha</h1>
            <p className="text-sm text-gray-600 mt-2">
              Digite seu email e enviaremos instruções para redefinir sua senha.
            </p>
          </div>

          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Modo desenvolvimento - mostrar token */}
          {devToken && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded space-y-2">
              <p className="text-sm font-semibold text-yellow-900">🔧 Modo Desenvolvimento</p>
              <div className="space-y-1">
                <p className="text-xs text-yellow-800">Token de reset:</p>
                <code className="block p-2 bg-yellow-100 rounded text-xs break-all">
                  {devToken}
                </code>
              </div>
              {devLink && (
                <Link
                  href={devLink.replace(process.env.NEXT_PUBLIC_API_URL || '', '')}
                  className="block mt-2 text-sm text-blue-600 hover:underline"
                >
                  → Ir para página de reset
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar instruções'}
            </Button>
          </form>

          <div className="text-center">
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              Voltar para o login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
