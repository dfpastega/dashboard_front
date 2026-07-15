'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Loader2, FileText, Pencil, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'

interface Contract {
  id: string
  name: string
  createdAt: string
}

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({ id: '', name: '' })

  // Edição
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [editForm, setEditForm] = useState({ id: '', name: '' })

  async function fetchContracts() {
    try {
      setLoading(true)
      const { data } = await api.get('/api/admin/contracts')
      setContracts(data)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao carregar contratos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContracts()
  }, [])

  async function handleCreate() {
    if (!formData.id.trim() || !formData.name.trim()) {
      alert('Preencha todos os campos.')
      return
    }
    try {
      setSaving(true)
      await api.post('/api/admin/contracts', formData)
      setShowCreateDialog(false)
      setFormData({ id: '', name: '' })
      await fetchContracts()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar contrato')
    } finally {
      setSaving(false)
    }
  }

  function openEditDialog(contract: Contract) {
    setEditingContract(contract)
    setEditForm({ id: contract.id, name: contract.name })
  }

  async function handleUpdate() {
    if (!editingContract) return
    const id = editForm.id.trim()
    const name = editForm.name.trim()
    if (!id || !name) {
      alert('Preencha todos os campos.')
      return
    }
    if (id !== editingContract.id) {
      const ok = confirm(
        `Alterar o Contract ID de "${editingContract.id}" para "${id}"?\n\n` +
          'Os vínculos dos usuários com este contrato serão atualizados automaticamente. ' +
          'Atenção: se o dashboard do Metabase filtra por este ID, os dados precisam usar o novo valor.'
      )
      if (!ok) return
    }
    try {
      setSaving(true)
      await api.put(`/api/admin/contracts/${encodeURIComponent(editingContract.id)}`, { id, name })
      setEditingContract(null)
      await fetchContracts()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar contrato')
    } finally {
      setSaving(false)
    }
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso))
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground text-sm">Gerencie os contratos cadastrados na plataforma</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Contrato
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contratos cadastrados</CardTitle>
          <CardDescription>Lista de todos os contratos disponíveis para associar a usuários</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <FileText className="h-10 w-10 opacity-30" />
              <p>Nenhum contrato cadastrado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono text-sm">{contract.id}</TableCell>
                    <TableCell className="font-medium">{contract.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(contract.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(contract)} title="Editar contrato">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={!!editingContract} onOpenChange={(o) => { if (!o) setEditingContract(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar contrato</DialogTitle>
            <DialogDescription>
              Você pode alterar o Contract ID e o nome. Os vínculos com usuários são atualizados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contract ID</Label>
              <Input
                value={editForm.id}
                onChange={(e) => setEditForm({ ...editForm, id: e.target.value.trim() })}
              />
              {editingContract && editForm.id.trim() !== editingContract.id && (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Alterando o ID de <strong>{editingContract.id}</strong> para <strong>{editForm.id.trim() || '—'}</strong>.
                    Se algum dashboard do Metabase filtra por este ID, os dados precisam usar o novo valor.
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContract(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
            <DialogDescription>
              O Contract ID é um identificador único (pode ser editado depois, se necessário).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contract ID</Label>
              <Input
                placeholder="Ex: contrato-xpto-2026"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.trim() })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Empresa XPTO Ltda"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setFormData({ id: '', name: '' }) }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
