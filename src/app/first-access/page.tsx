'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

export default function FirstAccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const emailFromUrl = searchParams?.get('email')
    if (emailFromUrl) {
      setEmail(emailFromUrl)
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
      const response = await api.post('/auth/first-access/change-password', {
        email,
        currentPassword,
        newPassword,
        confirmPassword
      })

      setMessage(response.data.message || 'Senha alterada com sucesso!')

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
        setError(err.response?.data?.error || 'Erro ao alterar senha')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 mt-4">
          <div>
            <h1 className="text-2xl font-bold">Primeiro acesso</h1>
            <p className="text-sm text-gray-600 mt-2">
              Por segurança, você precisa alterar sua senha no primeiro acesso.
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

            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
                Senha atual (temporária)
              </label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha temporária"
                required
                disabled={loading}
              />
              {validationErrors.currentPassword && (
                <p className="text-xs text-red-600 mt-1">{validationErrors.currentPassword}</p>
              )}
            </div>

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
                Confirmar nova senha
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
              {loading ? 'Alterando senha...' : 'Alterar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
