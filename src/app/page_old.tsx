'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FcGoogle } from 'react-icons/fc'
import { FaEye, FaEyeSlash, FaInfoCircle } from 'react-icons/fa'
import { toast } from 'sonner'
import axios from 'axios'

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
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
        { email, password },
        { withCredentials: true }
      )
      if (response.status === 200) {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setError('Usuário ou senha inválidos.')
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
                  Usuário
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
                  Senha
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
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    title={permanentShow ? "Clique duplo para ocultar" : "Clique duplo para manter visível"}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Entrando...' : 'Continuar'}
              </Button>

              {/* Esqueci minha senha + Tooltip */}
              <div className="flex items-center justify-end mt-2 text-sm text-muted-foreground">
                <span>Esqueci minha senha</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-1 cursor-pointer text-primary">
                        <FaInfoCircle />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-sm">
                      Se você esqueceu sua senha e precisa de uma senha nova, favor entrar em contato em: <strong>hello@stormeducation.com.br</strong>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </form>

            {/* Botão do Google oculto */}
            <div className="text-center text-sm text-muted-foreground">ou</div>
            <Button
              variant="outline"
              className="hidden w-full flex items-center gap-2 justify-center"
              type="button"
              onClick={() => toast('Login com Google ainda não implementado.')}
            >
              <FcGoogle size={20} />
              Entrar com Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
