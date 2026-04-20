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
import { Plus, Loader2, FileText } from 'lucide-react'
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono text-sm">{contract.id}</TableCell>
                    <TableCell className="font-medium">{contract.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(contract.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
            <DialogDescription>
              O Contract ID é um identificador único e não pode ser alterado após a criação.
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
