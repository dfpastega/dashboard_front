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
import { Checkbox } from '@/components/ui/checkbox'
import { Search, UserPlus, Pencil, Trash2, Star, StarOff, X, Plus } from 'lucide-react'

interface UserContractInfo {
  contractId: string
  name: string
  isPrimary: boolean
}

interface User {
  id: string
  email: string
  name?: string
  roleId: string
  contractId?: string
  isActive: boolean
  needsPasswordChange: boolean
  createdAt: string
  contracts: UserContractInfo[]
}

interface Contract {
  id: string
  name: string
}

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'contract_manager', label: 'Gerente de Contrato' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'user', label: 'Usuário' },
]

export default function UsuariosAdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Modal de edição
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    roleId: '',
    isActive: true,
  })
  const [editContracts, setEditContracts] = useState<UserContractInfo[]>([])
  const [savingContracts, setSavingContracts] = useState(false)

  // Modal de criação
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    roleId: 'user',
    contractId: 'none',
  })

  // Modal de senha temporária
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [createdUserInfo, setCreatedUserInfo] = useState<{ email: string; password: string; name?: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchContracts()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/admin/users')
      setUsers(data)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchContracts = async () => {
    try {
      const { data } = await api.get('/api/admin/contracts')
      setContracts(data)
    } catch (error) {
      console.error('Erro ao carregar contratos:', error)
    }
  }

  const handleCreateUser = async () => {
    if (!createFormData.email || !createFormData.roleId) {
      alert('Email e Role são obrigatórios')
      return
    }
    try {
      const payload = {
        name: createFormData.name || undefined,
        email: createFormData.email,
        roleId: createFormData.roleId,
        contractId: createFormData.contractId !== 'none' ? createFormData.contractId : undefined,
      }
      const { data } = await api.post('/api/admin/users', payload)

      // Se selecionou contrato, vincula via junction table também
      if (payload.contractId) {
        await api.post(`/api/admin/users/${data.user.id}/contracts`, {
          contractId: payload.contractId,
          isPrimary: true,
        }).catch(() => {}) // Ignora se já existir
      }

      setCreateDialogOpen(false)
      setCreateFormData({ name: '', email: '', roleId: 'user', contractId: 'none' })
      setCreatedUserInfo({ email: data.user.email, password: data.tempPassword, name: data.user.name })
      setPasswordDialogOpen(true)
      fetchUsers()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar usuário')
    }
  }

  const handleSendWelcomeEmail = async () => {
    if (!createdUserInfo) return
    try {
      setSendingEmail(true)
      await api.post('/api/admin/users/send-welcome-email', {
        email: createdUserInfo.email,
        name: createdUserInfo.name,
        tempPassword: createdUserInfo.password,
      })
      alert('Email de boas-vindas enviado com sucesso!')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao enviar email de boas-vindas')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditFormData({ name: user.name || '', email: user.email, roleId: user.roleId, isActive: user.isActive })
    setEditContracts(user.contracts ? [...user.contracts] : [])
    setEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return
    try {
      await api.put(`/api/admin/users/${editingUser.id}`, editFormData)
      setEditDialogOpen(false)
      setEditingUser(null)
      fetchUsers()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar usuário')
    }
  }

  const handleAddContract = async (contractId: string) => {
    if (!editingUser) return
    setSavingContracts(true)
    try {
      await api.post(`/api/admin/users/${editingUser.id}/contracts`, { contractId })
      const contract = contracts.find(c => c.id === contractId)
      const isFirst = editContracts.length === 0
      setEditContracts(prev => [...prev, { contractId, name: contract?.name ?? contractId, isPrimary: isFirst }])
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao adicionar contrato')
    } finally {
      setSavingContracts(false)
    }
  }

  const handleRemoveContract = async (contractId: string) => {
    if (!editingUser) return
    setSavingContracts(true)
    try {
      await api.delete(`/api/admin/users/${editingUser.id}/contracts/${contractId}`)
      setEditContracts(prev => {
        const remaining = prev.filter(c => c.contractId !== contractId)
        // Se removeu o primário, o próximo vira primário
        if (prev.find(c => c.contractId === contractId)?.isPrimary && remaining.length > 0) {
          remaining[0].isPrimary = true
        }
        return remaining
      })
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao remover contrato')
    } finally {
      setSavingContracts(false)
    }
  }

  const handleSetPrimary = async (contractId: string) => {
    if (!editingUser) return
    setSavingContracts(true)
    try {
      await api.put(`/api/admin/users/${editingUser.id}/contracts/${contractId}/primary`)
      setEditContracts(prev => prev.map(c => ({ ...c, isPrimary: c.contractId === contractId })))
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao definir contrato primário')
    } finally {
      setSavingContracts(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return
    try {
      await api.delete(`/api/admin/users/${userId}`)
      fetchUsers()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao excluir usuário')
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesRole = roleFilter === 'all' || user.roleId === roleFilter
    return matchesSearch && matchesRole
  })

  const getRoleBadgeColor = (roleId: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      contract_manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      partner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      user: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    }
    return colors[roleId] || colors.user
  }

  const getRoleLabel = (roleId: string) => ROLES.find(r => r.value === roleId)?.label || roleId

  const assignedIds = new Set(editContracts.map(c => c.contractId))
  const availableContracts = contracts.filter(c => !assignedIds.has(c.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
        <p className="text-muted-foreground">Gerencie todos os usuários do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>{filteredUsers.length} usuário(s) encontrado(s)</CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os roles</SelectItem>
                {ROLES.map(role => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Contratos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || '-'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.roleId)}>
                            {getRoleLabel(user.roleId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.contracts && user.contracts.length > 0 ? (
                              user.contracts.map(c => (
                                <Badge key={c.contractId} variant={c.isPrimary ? 'default' : 'outline'} className="text-xs">
                                  {c.isPrimary && <Star className="h-2.5 w-2.5 mr-1" />}
                                  {c.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'secondary'}>
                            {user.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>Preencha os dados do novo usuário</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={createFormData.name} onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={createFormData.email} onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={createFormData.roleId} onValueChange={(v) => setCreateFormData({ ...createFormData, roleId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contrato inicial (opcional)</Label>
              <Select value={createFormData.contractId} onValueChange={(v) => setCreateFormData({ ...createFormData, contractId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Mais contratos podem ser adicionados após a criação.</p>
            </div>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              ℹ️ Uma senha temporária será gerada automaticamente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser}>Criar Usuário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editFormData.roleId} onValueChange={(v) => setEditFormData({ ...editFormData, roleId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-active"
                checked={editFormData.isActive}
                onCheckedChange={(checked) => setEditFormData({ ...editFormData, isActive: !!checked })}
              />
              <Label htmlFor="edit-active">Usuário ativo</Label>
            </div>

            {/* Seção de contratos */}
            <div className="space-y-2">
              <Label>Contratos vinculados</Label>
              {editContracts.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum contrato vinculado.</p>
              )}
              <div className="space-y-1.5">
                {editContracts.map(c => (
                  <div key={c.contractId} className="flex items-center gap-2 p-2 rounded-md border bg-muted/40">
                    <span className="flex-1 text-sm font-medium">{c.name}</span>
                    {c.isPrimary && (
                      <Badge variant="default" className="text-xs gap-1">
                        <Star className="h-2.5 w-2.5" />principal
                      </Badge>
                    )}
                    {!c.isPrimary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Definir como principal"
                        disabled={savingContracts}
                        onClick={() => handleSetPrimary(c.contractId)}
                      >
                        <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={savingContracts}
                      onClick={() => handleRemoveContract(c.contractId)}
                    >
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              {availableContracts.length > 0 && (
                <div className="flex gap-2 pt-1">
                  <Select
                    onValueChange={(id) => handleAddContract(id)}
                    value=""
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Adicionar contrato..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContracts.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <Plus className="h-3.5 w-3.5 inline mr-1" />
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateUser}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Senha Temporária */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário Criado com Sucesso!</DialogTitle>
            <DialogDescription>Anote a senha temporária abaixo e envie ao usuário</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="font-medium">{createdUserInfo?.email}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Senha Temporária</Label>
                <p className="font-mono font-bold text-lg">{createdUserInfo?.password}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              ⚠️ Esta senha só será exibida uma vez. Certifique-se de copiá-la antes de fechar.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(createdUserInfo?.password || ''); alert('Senha copiada!') }}>
              Copiar Senha
            </Button>
            <Button onClick={handleSendWelcomeEmail} disabled={sendingEmail}>
              {sendingEmail ? 'Enviando...' : 'Enviar Email ao Usuário'}
            </Button>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
