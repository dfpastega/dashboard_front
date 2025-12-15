'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import Link from 'next/link'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const tokenFromUrl = searchParams?.get('token')
    if (tokenFromUrl) {
      setToken(tokenFromUrl)
    }
  }, [searchParams])

  const validatePassword = (password: string): boolean => {
    const errors: Record<string, string> = {}

    if (password.length < 8) {
      errors.newPassword = 'A senha deve ter no mínimo 8 caracteres'
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.newPassword = 'A senha deve conter pelo menos uma letra minúscula'
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.newPassword = 'A senha deve conter pelo menos uma letra maiúscula'
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.newPassword = 'A senha deve conter pelo menos um número'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    setValidationErrors({})

    if (!validatePassword(newPassword)) {
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setValidationErrors({ confirmPassword: 'As senhas não coincidem' })
      setLoading(false)
      return
    }

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword
      })

      setMessage(response.data.message || 'Senha redefinida com sucesso!')

      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err: any) {
      if (err.response?.data?.details) {
        const errors: Record<string, string> = {}
        err.response.data.details.forEach((detail: any) => {
          errors[detail.field] = detail.message
        })
        setValidationErrors(errors)
      } else {
        setError(err.response?.data?.error || 'Erro ao redefinir senha')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 mt-4">
            <h1 className="text-2xl font-bold">Token inválido</h1>
            <p className="text-sm text-gray-600">
              O link de redefinição de senha é inválido ou expirou.
            </p>
            <Link href="/forgot-password">
              <Button className="w-full">Solicitar novo link</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 mt-4">
          <div>
            <h1 className="text-2xl font-bold">Redefinir senha</h1>
            <p className="text-sm text-gray-600 mt-2">
              Digite sua nova senha abaixo.
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                Nova senha
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite sua nova senha"
                required
                disabled={loading}
              />
              {validationErrors.newPassword && (
                <p className="text-xs text-red-600 mt-1">{validationErrors.newPassword}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Mínimo 8 caracteres, com letras maiúsculas, minúsculas e números
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirmar senha
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme sua nova senha"
                required
                disabled={loading}
              />
              {validationErrors.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">{validationErrors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Redefinindo...' : 'Redefinir senha'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 mt-4">
            <div className="text-center">Carregando...</div>
          </CardContent>
        </Card>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
