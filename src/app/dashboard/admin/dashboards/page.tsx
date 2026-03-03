'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Checkbox } from '@/components/ui/checkbox'

interface Dashboard {
  id: string
  name: string
  description?: string
  metabaseDashboardId: number
  slug: string
  filterType: string
  icon?: string
  orderIndex: number
  isActive: boolean
  permissions?: DashboardPermission[]
}

interface DashboardPermission {
  id: string
  roleId: string
  canView: boolean
  canExport: boolean
}

const ROLES = [
  { id: 'user', label: 'Usuário', color: 'bg-gray-500' },
  { id: 'partner', label: 'Parceiro', color: 'bg-green-500' },
  { id: 'contract_manager', label: 'Gestor de Contrato', color: 'bg-blue-500' },
  { id: 'admin', label: 'Admin', color: 'bg-red-500' },
  { id: 'super_admin', label: 'Super Admin', color: 'bg-purple-500' },
]

const FILTER_TYPES = [
  { value: 'contract_id', label: 'Filtrar por Contrato (contractId)' },
  { value: 'user_id', label: 'Filtrar por Usuário (userId)' },
  { value: 'partner_id', label: 'Filtrar por Parceiro (partnerId)' },
  { value: 'none', label: 'Sem Filtro (ver tudo)' },
]

export default function DashboardsAdminPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    metabaseDashboardId: '',
    slug: '',
    filterType: 'contract_id',
    icon: '',
    orderIndex: '0',
    isActive: true,
  })
  const [selectedRoles, setSelectedRoles] = useState<{ [key: string]: { canView: boolean; canExport: boolean } }>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchDashboards()
  }, [])

  const fetchDashboards = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/dashboards/admin/all')
      setDashboards(data)
    } catch (error: any) {
      console.error('Erro ao carregar dashboards:', error)
      alert(error.response?.data?.error || 'Erro ao carregar dashboards')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (dashboard?: Dashboard) => {
    if (dashboard) {
      // Edição
      setEditingDashboard(dashboard)
      setFormData({
        name: dashboard.name,
        description: dashboard.description || '',
        metabaseDashboardId: dashboard.metabaseDashboardId.toString(),
        slug: dashboard.slug,
        filterType: dashboard.filterType,
        icon: dashboard.icon || '',
        orderIndex: dashboard.orderIndex.toString(),
        isActive: dashboard.isActive,
      })

      // Carregar permissões existentes
      const rolesMap: { [key: string]: { canView: boolean; canExport: boolean } } = {}
      dashboard.permissions?.forEach(p => {
        rolesMap[p.roleId] = {
          canView: p.canView,
          canExport: p.canExport,
        }
      })
      setSelectedRoles(rolesMap)
    } else {
      // Novo dashboard
      setEditingDashboard(null)
      setFormData({
        name: '',
        description: '',
        metabaseDashboardId: '',
        slug: '',
        filterType: 'contract_id',
        icon: '',
        orderIndex: '0',
        isActive: true,
      })
      setSelectedRoles({})
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingDashboard(null)
    setFormData({
      name: '',
      description: '',
      metabaseDashboardId: '',
      slug: '',
      filterType: 'contract_id',
      icon: '',
      orderIndex: '0',
      isActive: true,
    })
    setSelectedRoles({})
  }

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev => {
      const newRoles = { ...prev }
      if (newRoles[roleId]) {
        delete newRoles[roleId]
      } else {
        newRoles[roleId] = { canView: true, canExport: false }
      }
      return newRoles
    })
  }

  const toggleRoleExport = (roleId: string) => {
    setSelectedRoles(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        canExport: !prev[roleId]?.canExport,
      },
    }))
  }

  const handleSubmit = async () => {
    try {
      // Validações
      if (!formData.name.trim()) {
        alert('Nome é obrigatório')
        return
      }
      if (!formData.metabaseDashboardId.trim()) {
        alert('ID do Dashboard no Metabase é obrigatório')
        return
      }
      if (!formData.slug.trim()) {
        alert('Slug é obrigatório')
        return
      }

      setSubmitting(true)

      const rolePermissions = Object.entries(selectedRoles).map(([roleId, perms]) => ({
        roleId,
        canView: perms.canView,
        canExport: perms.canExport,
      }))

      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        metabaseDashboardId: parseInt(formData.metabaseDashboardId),
        slug: formData.slug,
        filterType: formData.filterType,
        icon: formData.icon || undefined,
        orderIndex: parseInt(formData.orderIndex),
        isActive: formData.isActive,
        rolePermissions,
      }

      if (editingDashboard) {
        // Atualizar
        await api.put(`/api/dashboards/admin/${editingDashboard.id}`, payload)
        alert('Dashboard atualizado com sucesso!')
      } else {
        // Criar
        await api.post('/api/dashboards/admin', payload)
        alert('Dashboard criado com sucesso!')
      }

      handleCloseDialog()
      fetchDashboards()
    } catch (error: any) {
      console.error('Erro ao salvar dashboard:', error)
      alert(error.response?.data?.error || 'Erro ao salvar dashboard')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (dashboard: Dashboard) => {
    if (!confirm(`Tem certeza que deseja deletar o dashboard "${dashboard.name}"?`)) {
      return
    }

    try {
      await api.delete(`/api/dashboards/admin/${dashboard.id}`)
      alert('Dashboard deletado com sucesso!')
      fetchDashboards()
    } catch (error: any) {
      console.error('Erro ao deletar dashboard:', error)
      alert(error.response?.data?.error || 'Erro ao deletar dashboard')
    }
  }

  const toggleActive = async (dashboard: Dashboard) => {
    try {
      await api.put(`/api/dashboards/admin/${dashboard.id}`, {
        isActive: !dashboard.isActive,
      })
      fetchDashboards()
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error)
      alert(error.response?.data?.error || 'Erro ao atualizar status')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Dashboards</h1>
          <p className="text-muted-foreground">
            Configure dashboards e permissões de acesso por role
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dashboards Cadastrados</CardTitle>
          <CardDescription>
            Lista de todos os dashboards do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dashboards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dashboard cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Metabase ID</TableHead>
                  <TableHead>Filtro</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboards.map((dashboard) => (
                  <TableRow key={dashboard.id}>
                    <TableCell className="font-medium">{dashboard.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {dashboard.slug}
                      </code>
                    </TableCell>
                    <TableCell>{dashboard.metabaseDashboardId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{dashboard.filterType}</Badge>
                    </TableCell>
                    <TableCell>{dashboard.orderIndex}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {dashboard.permissions?.map((perm) => {
                          const role = ROLES.find((r) => r.id === perm.roleId)
                          return (
                            <Badge
                              key={perm.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {role?.label}
                              {perm.canExport && ' 📤'}
                            </Badge>
                          )
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={dashboard.isActive}
                          onCheckedChange={() => toggleActive(dashboard)}
                        />
                        {dashboard.isActive ? (
                          <Eye className="h-4 w-4 text-green-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(dashboard)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(dashboard)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Criar/Editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDashboard ? 'Editar Dashboard' : 'Novo Dashboard'}
            </DialogTitle>
            <DialogDescription>
              Configure as informações do dashboard e as permissões de acesso
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Dashboard de Vendas"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descrição opcional do dashboard"
                rows={2}
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL) *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, '-'),
                  })
                }
                placeholder="dashboard-vendas"
              />
              <p className="text-xs text-muted-foreground">
                Será usado na URL: /dashboard/{formData.slug || 'slug'}
              </p>
            </div>

            {/* Metabase Dashboard ID */}
            <div className="space-y-2">
              <Label htmlFor="metabaseId">ID do Dashboard no Metabase *</Label>
              <Input
                id="metabaseId"
                type="number"
                value={formData.metabaseDashboardId}
                onChange={(e) =>
                  setFormData({ ...formData, metabaseDashboardId: e.target.value })
                }
                placeholder="9"
              />
            </div>

            {/* Tipo de Filtro */}
            <div className="space-y-2">
              <Label htmlFor="filterType">Tipo de Filtro</Label>
              <Select
                value={formData.filterType}
                onValueChange={(value) =>
                  setFormData({ ...formData, filterType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ícone e Ordem */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icon">Ícone (opcional)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="LayoutDashboard"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderIndex">Ordem de Exibição</Label>
                <Input
                  id="orderIndex"
                  type="number"
                  value={formData.orderIndex}
                  onChange={(e) =>
                    setFormData({ ...formData, orderIndex: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            {/* Permissões por Role */}
            <div className="space-y-2">
              <Label>Permissões por Role</Label>
              <div className="border rounded-lg p-4 space-y-3">
                {ROLES.map((role) => {
                  const isSelected = !!selectedRoles[role.id]
                  return (
                    <div
                      key={role.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRole(role.id)}
                        />
                        <Badge className={role.color}>{role.label}</Badge>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Permitir Exportar:</Label>
                          <Switch
                            checked={selectedRoles[role.id]?.canExport}
                            onCheckedChange={() => toggleRoleExport(role.id)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Status Ativo */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Dashboard Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Dashboards inativos não aparecem para os usuários
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : editingDashboard ? (
                'Atualizar Dashboard'
              ) : (
                'Criar Dashboard'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
