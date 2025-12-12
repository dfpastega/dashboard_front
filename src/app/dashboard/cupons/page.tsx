'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { Ticket, Calendar, TrendingUp, Users } from 'lucide-react'

interface Coupon {
  id: string
  code: string
  description?: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  isActive: boolean
  validFrom?: string
  validUntil?: string
  share: {
    id: string
    canViewStats: boolean
    canDeactivate: boolean
    sharedAt: string
    sharedByUser: {
      id: string
      name: string
      email: string
    }
  }
  statistics?: {
    totalUses: number
    currentUses: number
    remainingUses?: number
  }
}

export default function CuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const { data } = await api.get('/partner/coupons')
        setCoupons(data.coupons || [])
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar cupons')
        console.error('Erro ao carregar cupons:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCoupons()
  }, [])

  const formatDiscount = (type: string, value: number) => {
    return type === 'percentage' ? `${value}%` : `R$ ${value.toFixed(2)}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Carregando cupons...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meus Cupons</h1>
        <p className="text-muted-foreground">
          Cupons compartilhados com você
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="p-6">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {coupons.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum cupom encontrado</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Você ainda não possui cupons compartilhados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    <CardTitle className="text-lg">{coupon.code}</CardTitle>
                  </div>
                  <Badge variant={coupon.isActive ? 'default' : 'secondary'}>
                    {coupon.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                {coupon.description && (
                  <CardDescription className="mt-2">
                    {coupon.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-2xl font-bold">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  {formatDiscount(coupon.discountType, coupon.discountValue)}
                </div>

                {coupon.share.canViewStats && coupon.statistics && (
                  <div className="rounded-lg bg-muted p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">
                        Usos: {coupon.statistics.currentUses}
                        {coupon.statistics.totalUses && ` / ${coupon.statistics.totalUses}`}
                      </span>
                    </div>
                  </div>
                )}

                {(coupon.validFrom || coupon.validUntil) && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {coupon.validFrom && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>Válido desde: {formatDate(coupon.validFrom)}</span>
                      </div>
                    )}
                    {coupon.validUntil && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>Válido até: {formatDate(coupon.validUntil)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Compartilhado por {coupon.share.sharedByUser.name || coupon.share.sharedByUser.email}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
