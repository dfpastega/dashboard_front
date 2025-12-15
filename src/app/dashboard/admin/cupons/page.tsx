'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Pencil, Trash2, Share2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface Coupon {
  id: string
  code: string
  description?: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  isActive: boolean
  validFrom?: string
  validUntil?: string
  maxUses?: number
  currentUses?: number
  minPurchaseAmount?: number
  ownerId?: string
  createdAt: string
}

interface User {
  id: string
  email: string
  name?: string
}

export default function CuponsAdminPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal de criação
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    validFrom: '',
    validUntil: '',
    maxUses: '',
    minPurchaseAmount: '',
    ownerId: ''
  })

  // Modal de edição
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    isActive: true,
    validFrom: '',
    validUntil: '',
    maxUses: '',
    minPurchaseAmount: ''
  })

  // Modal de compartilhamento
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [sharingCoupon, setSharingCoupon] = useState<Coupon | null>(null)
  const [shareUserId, setShareUserId] = useState('')
  const [canViewStats, setCanViewStats] = useState(false)
  const [canDeactivate, setCanDeactivate] = useState(false)

  useEffect(() => {
    fetchCoupons()
    fetchUsers()
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/admin/coupons')
      setCoupons(data)
    } catch (error) {
      console.error('Erro ao carregar cupons:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users')
      setUsers(data.filter((u: User) => u.id)) // Filtrar apenas usuários válidos
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
    }
  }

  const handleCreateCoupon = async () => {
    try {
      const payload = {
        ...createFormData,
        maxUses: createFormData.maxUses ? parseInt(createFormData.maxUses) : undefined,
        minPurchaseAmount: createFormData.minPurchaseAmount ? parseFloat(createFormData.minPurchaseAmount) : undefined,
        ownerId: createFormData.ownerId || undefined
      }

      await api.post('/admin/coupons', payload)
      setCreateDialogOpen(false)
      setCreateFormData({
        code: '',
        description: '',
        discountType: 'percentage',
        discountValue: 0,
        validFrom: '',
        validUntil: '',
        maxUses: '',
        minPurchaseAmount: '',
        ownerId: ''
      })
      fetchCoupons()
    } catch (error: any) {
      console.error('Erro ao criar cupom:', error)
      alert(error.response?.data?.error || 'Erro ao criar cupom')
    }
  }

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setEditFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      isActive: coupon.isActive,
      validFrom: coupon.validFrom ? coupon.validFrom.split('T')[0] : '',
      validUntil: coupon.validUntil ? coupon.validUntil.split('T')[0] : '',
      maxUses: coupon.maxUses?.toString() || '',
      minPurchaseAmount: coupon.minPurchaseAmount?.toString() || ''
    })
    setEditDialogOpen(true)
  }

  const handleUpdateCoupon = async () => {
    if (!editingCoupon) return

    try {
      const payload = {
        ...editFormData,
        maxUses: editFormData.maxUses ? parseInt(editFormData.maxUses) : undefined,
        minPurchaseAmount: editFormData.minPurchaseAmount ? parseFloat(editFormData.minPurchaseAmount) : undefined
      }

      await api.put(`/admin/coupons/${editingCoupon.id}`, payload)
      setEditDialogOpen(false)
      setEditingCoupon(null)
      fetchCoupons()
    } catch (error: any) {
      console.error('Erro ao atualizar cupom:', error)
      alert(error.response?.data?.error || 'Erro ao atualizar cupom')
    }
  }

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return

    try {
      await api.delete(`/admin/coupons/${couponId}`)
      fetchCoupons()
    } catch (error: any) {
      console.error('Erro ao excluir cupom:', error)
      alert(error.response?.data?.error || 'Erro ao excluir cupom')
    }
  }

  const handleShareCoupon = (coupon: Coupon) => {
    setSharingCoupon(coupon)
    setShareUserId('')
    setCanViewStats(false)
    setCanDeactivate(false)
    setShareDialogOpen(true)
  }

  const handleConfirmShare = async () => {
    if (!sharingCoupon || !shareUserId) {
      alert('Selecione um usuário')
      return
    }

    try {
      await api.post('/admin/coupons/share', {
        couponId: sharingCoupon.id,
        sharedWithUserId: shareUserId,
        canViewStats,
        canDeactivate
      })
      setShareDialogOpen(false)
      alert('Cupom compartilhado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao compartilhar cupom:', error)
      alert(error.response?.data?.error || 'Erro ao compartilhar cupom')
    }
  }

  const filteredCoupons = coupons.filter(coupon =>
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (coupon.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  )

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discountType === 'percentage') {
      return `${coupon.discountValue}%`
    }
    return `R$ ${coupon.discountValue.toFixed(2)}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Cupons</h1>
        <p className="text-muted-foreground">
          Gerencie todos os cupons de desconto
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cupons</CardTitle>
              <CardDescription>
                {filteredCoupons.length} cupom(ns) encontrado(s)
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cupom
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Uso</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhum cupom encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCoupons.map(coupon => (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-mono font-bold">
                          {coupon.code}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {coupon.description || '-'}
                        </TableCell>
                        <TableCell>{formatDiscount(coupon)}</TableCell>
                        <TableCell>
                          {coupon.currentUses || 0}
                          {coupon.maxUses ? ` / ${coupon.maxUses}` : ''}
                        </TableCell>
                        <TableCell className="text-sm">
                          {coupon.validUntil
                            ? new Date(coupon.validUntil).toLocaleDateString('pt-BR')
                            : 'Sem limite'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={coupon.isActive ? 'default' : 'secondary'}>
                            {coupon.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleShareCoupon(coupon)}
                            title="Compartilhar cupom"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditCoupon(coupon)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Criação */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Cupom</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo cupom
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-code">Código *</Label>
                <Input
                  id="create-code"
                  value={createFormData.code}
                  onChange={(e) => setCreateFormData({ ...createFormData, code: e.target.value.toUpperCase() })}
                  placeholder="EX: PROMO2024"
                />
              </div>
              <div>
                <Label htmlFor="create-owner">Proprietário (opcional)</Label>
                <Select
                  value={createFormData.ownerId}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, ownerId: value })}
                >
                  <SelectTrigger id="create-owner">
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="create-description">Descrição</Label>
              <Textarea
                id="create-description"
                value={createFormData.description}
                onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                placeholder="Descrição do cupom"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-type">Tipo de Desconto *</Label>
                <Select
                  value={createFormData.discountType}
                  onValueChange={(value: 'percentage' | 'fixed') =>
                    setCreateFormData({ ...createFormData, discountType: value })
                  }
                >
                  <SelectTrigger id="create-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="create-value">Valor do Desconto *</Label>
                <Input
                  id="create-value"
                  type="number"
                  step="0.01"
                  value={createFormData.discountValue}
                  onChange={(e) => setCreateFormData({ ...createFormData, discountValue: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-validFrom">Válido de</Label>
                <Input
                  id="create-validFrom"
                  type="date"
                  value={createFormData.validFrom}
                  onChange={(e) => setCreateFormData({ ...createFormData, validFrom: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="create-validUntil">Válido até</Label>
                <Input
                  id="create-validUntil"
                  type="date"
                  value={createFormData.validUntil}
                  onChange={(e) => setCreateFormData({ ...createFormData, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-maxUses">Máximo de Usos</Label>
                <Input
                  id="create-maxUses"
                  type="number"
                  value={createFormData.maxUses}
                  onChange={(e) => setCreateFormData({ ...createFormData, maxUses: e.target.value })}
                  placeholder="Ilimitado"
                />
              </div>
              <div>
                <Label htmlFor="create-minPurchase">Valor Mínimo (R$)</Label>
                <Input
                  id="create-minPurchase"
                  type="number"
                  step="0.01"
                  value={createFormData.minPurchaseAmount}
                  onChange={(e) => setCreateFormData({ ...createFormData, minPurchaseAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCoupon}>
              Criar Cupom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cupom</DialogTitle>
            <DialogDescription>
              Atualize as informações do cupom
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-code">Código *</Label>
              <Input
                id="edit-code"
                value={editFormData.code}
                onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-type">Tipo de Desconto *</Label>
                <Select
                  value={editFormData.discountType}
                  onValueChange={(value: 'percentage' | 'fixed') =>
                    setEditFormData({ ...editFormData, discountType: value })
                  }
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-value">Valor do Desconto *</Label>
                <Input
                  id="edit-value"
                  type="number"
                  step="0.01"
                  value={editFormData.discountValue}
                  onChange={(e) => setEditFormData({ ...editFormData, discountValue: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-validFrom">Válido de</Label>
                <Input
                  id="edit-validFrom"
                  type="date"
                  value={editFormData.validFrom}
                  onChange={(e) => setEditFormData({ ...editFormData, validFrom: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-validUntil">Válido até</Label>
                <Input
                  id="edit-validUntil"
                  type="date"
                  value={editFormData.validUntil}
                  onChange={(e) => setEditFormData({ ...editFormData, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-maxUses">Máximo de Usos</Label>
                <Input
                  id="edit-maxUses"
                  type="number"
                  value={editFormData.maxUses}
                  onChange={(e) => setEditFormData({ ...editFormData, maxUses: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-minPurchase">Valor Mínimo (R$)</Label>
                <Input
                  id="edit-minPurchase"
                  type="number"
                  step="0.01"
                  value={editFormData.minPurchaseAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, minPurchaseAmount: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editFormData.isActive}
                onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-active">Cupom ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCoupon}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Compartilhamento */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar Cupom</DialogTitle>
            <DialogDescription>
              Compartilhe o cupom "{sharingCoupon?.code}" com um usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="share-user">Usuário *</Label>
              <Select value={shareUserId} onValueChange={setShareUserId}>
                <SelectTrigger id="share-user">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="share-viewStats"
                  checked={canViewStats}
                  onChange={(e) => setCanViewStats(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="share-viewStats">Pode visualizar estatísticas</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="share-deactivate"
                  checked={canDeactivate}
                  onChange={(e) => setCanDeactivate(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="share-deactivate">Pode desativar o cupom</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmShare}>
              Compartilhar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
