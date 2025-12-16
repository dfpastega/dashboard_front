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
import { Search, UserPlus, Pencil, Trash2 } from 'lucide-react'

interface User {
  id: string
  email: string
  name?: string
  roleId: string
  contractId?: string
  isActive: boolean
  needsPasswordChange: boolean
  createdAt: string
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
  { value: 'user', label: 'Usuário' }
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
    contractId: '',
    isActive: true
  })

  // Modal de criação
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    roleId: 'user',
    contractId: 'none'
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
    // Validação
    if (!createFormData.email || !createFormData.roleId) {
      alert('Email e Role são obrigatórios')
      return
    }

    try {
      const payload = {
        name: createFormData.name || undefined,
        email: createFormData.email,
        roleId: createFormData.roleId,
        contractId: createFormData.contractId && createFormData.contractId !== 'none' ? createFormData.contractId : undefined
      }

      console.log('Sending payload:', payload) // Debug
      const { data } = await api.post('/api/admin/users', payload)

      setCreateDialogOpen(false)
      setCreateFormData({
        name: '',
        email: '',
        roleId: 'user',
        contractId: 'none'
      })

      // Mostrar senha temporária
      setCreatedUserInfo({
        email: data.user.email,
        password: data.tempPassword,
        name: data.user.name
      })
      setPasswordDialogOpen(true)

      fetchUsers()
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error)
      console.error('Response data:', error.response?.data) // Debug detalhado
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
        tempPassword: createdUserInfo.password
      })

      alert('Email de boas-vindas enviado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao enviar email:', error)
      alert(error.response?.data?.error || 'Erro ao enviar email de boas-vindas')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditFormData({
      name: user.name || '',
      email: user.email,
      roleId: user.roleId,
      contractId: user.contractId || 'none',
      isActive: user.isActive
    })
    setEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    try {
      const payload = {
        ...editFormData,
        contractId: editFormData.contractId && editFormData.contractId !== 'none' ? editFormData.contractId : undefined
      }
      await api.put(`/api/admin/users/${editingUser.id}`, payload)
      setEditDialogOpen(false)
      setEditingUser(null)
      fetchUsers()
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error)
      alert(error.response?.data?.error || 'Erro ao atualizar usuário')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return

    try {
      await api.delete(`/api/admin/users/${userId}`)
      fetchUsers()
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error)
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
      user: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
    return colors[roleId] || colors.user
  }

  const getRoleLabel = (roleId: string) => {
    return ROLES.find(r => r.value === roleId)?.label || roleId
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
        <p className="text-muted-foreground">
          Gerencie todos os usuários do sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>
                {filteredUsers.length} usuário(s) encontrado(s)
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
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
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
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
                    <TableHead>Contrato</TableHead>
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
                        <TableCell className="font-medium">
                          {user.name || '-'}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.roleId)}>
                            {getRoleLabel(user.roleId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {contracts.find(c => c.id === user.contractId)?.name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'secondary'}>
                            {user.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditUser(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">Nome</Label>
              <Input
                id="create-name"
                value={createFormData.name}
                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="create-role">Role</Label>
              <Select
                value={createFormData.roleId}
                onValueChange={(value) => setCreateFormData({ ...createFormData, roleId: value })}
              >
                <SelectTrigger id="create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-contract">Contrato</Label>
              <Select
                value={createFormData.contractId || 'none'}
                onValueChange={(value) => setCreateFormData({ ...createFormData, contractId: value })}
              >
                <SelectTrigger id="create-contract">
                  <SelectValue placeholder="Selecione um contrato (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contracts.map(contract => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p>ℹ️ Uma senha temporária será gerada automaticamente e exibida após a criação do usuário.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser}>
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editFormData.roleId}
                onValueChange={(value) => setEditFormData({ ...editFormData, roleId: value })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-contract">Contrato</Label>
              <Select
                value={editFormData.contractId || 'none'}
                onValueChange={(value) => setEditFormData({ ...editFormData, contractId: value })}
              >
                <SelectTrigger id="edit-contract">
                  <SelectValue placeholder="Selecione um contrato (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contracts.map(contract => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editFormData.isActive}
                onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-active">Usuário ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Senha Temporária */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário Criado com Sucesso!</DialogTitle>
            <DialogDescription>
              Anote a senha temporária abaixo e envie ao usuário
            </DialogDescription>
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
            <div className="text-sm text-muted-foreground">
              <p>⚠️ Esta senha só será exibida uma vez. Certifique-se de copiá-la antes de fechar.</p>
              <p className="mt-2">O usuário deverá alterar esta senha no primeiro acesso.</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(createdUserInfo?.password || '')
                alert('Senha copiada para a área de transferência!')
              }}
            >
              Copiar Senha
            </Button>
            <Button
              variant="default"
              onClick={handleSendWelcomeEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? 'Enviando...' : 'Enviar Email ao Usuário'}
            </Button>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
