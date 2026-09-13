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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Loader2, FileText, Pencil, AlertTriangle, Handshake } from 'lucide-react'
import { api } from '@/lib/api'

interface Contract {
  id: string
  name: string
  /** `Contracts."contractId"` no StormBot — chave da afinidade e das tabelas replicadas. */
  stormbotContractId: number | null
  /** 'standard' | 'affinity' — decide se a área de beneficiários aparece. */
  modality: string
  createdAt: string
}

const MODALITIES = [
  { value: 'standard', label: 'Padrão (B2B)' },
  { value: 'affinity', label: 'Afinidade' },
]

const emptyForm = { id: '', name: '', stormbotContractId: '', modality: 'standard' }

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState(emptyForm)

  // Edição
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

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
      // stormbotContractId vazio: o backend deriva do próprio Contract ID quando ele é
      // numérico, que é como os contratos existentes já funcionam.
      await api.post('/api/admin/contracts', {
        id: formData.id,
        name: formData.name,
        modality: formData.modality,
        ...(formData.stormbotContractId.trim()
          ? { stormbotContractId: formData.stormbotContractId.trim() }
          : {}),
      })
      setShowCreateDialog(false)
      setFormData(emptyForm)
      await fetchContracts()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar contrato')
    } finally {
      setSaving(false)
    }
  }

  function openEditDialog(contract: Contract) {
    setEditingContract(contract)
    setEditForm({
      id: contract.id,
      name: contract.name,
      stormbotContractId: contract.stormbotContractId?.toString() ?? '',
      modality: contract.modality ?? 'standard',
    })
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
      // String vazia é enviada de propósito: o backend a lê como "desvincular do StormBot".
      await api.put(`/api/admin/contracts/${encodeURIComponent(editingContract.id)}`, {
        id,
        name,
        stormbotContractId: editForm.stormbotContractId.trim(),
        modality: editForm.modality,
      })
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
                  <TableHead>StormBot ID</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono text-sm">{contract.id}</TableCell>
                    <TableCell className="font-medium">{contract.name}</TableCell>
                    <TableCell className="font-mono text-sm tabular-nums">
                      {contract.stormbotContractId ?? (
                        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          não mapeado
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contract.modality === 'affinity' ? (
                        <Badge variant="outline" className="gap-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <Handshake className="h-3 w-3" />
                          Afinidade
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Padrão</span>
                      )}
                    </TableCell>
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
            <div className="space-y-2">
              <Label>StormBot Contract ID</Label>
              <Input
                inputMode="numeric"
                placeholder="Ex: 61"
                value={editForm.stormbotContractId}
                onChange={(e) =>
                  setEditForm({ ...editForm, stormbotContractId: e.target.value.replace(/\D/g, '') })
                }
              />
              <p className="text-xs text-muted-foreground">
                O <code className="rounded bg-muted px-1">contractId</code> deste contrato no StormBot.
                É por ele que a afinidade encontra os elegíveis e os slots. Vazio = não mapeado.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Select
                value={editForm.modality}
                onValueChange={(v) => setEditForm({ ...editForm, modality: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALITIES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {editForm.modality === 'affinity' && !editForm.stormbotContractId.trim() && (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Sem o StormBot Contract ID, a área de beneficiários não tem onde buscar
                    elegíveis nem slots.
                  </span>
                </p>
              )}
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
            <div className="space-y-2">
              <Label>StormBot Contract ID <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                inputMode="numeric"
                placeholder="Deixe vazio para usar o próprio Contract ID"
                value={formData.stormbotContractId}
                onChange={(e) =>
                  setFormData({ ...formData, stormbotContractId: e.target.value.replace(/\D/g, '') })
                }
              />
              <p className="text-xs text-muted-foreground">
                Se o Contract ID acima já for o número do contrato no StormBot, deixe vazio —
                o vínculo é criado sozinho.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Select
                value={formData.modality}
                onValueChange={(v) => setFormData({ ...formData, modality: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALITIES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setFormData(emptyForm) }}>
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
