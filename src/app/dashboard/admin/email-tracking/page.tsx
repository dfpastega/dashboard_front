'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Plus, Copy, MousePointerClick, Loader2, ExternalLink, Check,
  Pencil, Trash2, AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api'

interface TrackedLink {
  id: string
  slug: string
  label: string
  destination: string
  isActive: boolean
  createdAt: string
  clickCount: number
}

interface LinkClick {
  id: string
  clickedAt: string
  ipAddress?: string
  userAgent?: string
  referer?: string
}

const BASE_URL = 'https://dashboard.stormeducation.com.br/r'

// ─── URL validation ──────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function validateUrl(raw: string): string | null {
  if (!raw.trim()) return 'URL de destino é obrigatória.'
  const normalized = normalizeUrl(raw)
  try {
    const url = new URL(normalized)
    if (!['http:', 'https:'].includes(url.protocol)) return 'Use http:// ou https://'
    if (!url.hostname.includes('.')) return 'Domínio inválido.'
    return null
  } catch {
    return 'URL inválida. Verifique o endereço.'
  }
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function EmailTrackingPage() {
  const [links, setLinks] = useState<TrackedLink[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog]   = useState(false)
  const [showClicksDialog, setShowClicksDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [selectedLink, setSelectedLink] = useState<TrackedLink | null>(null)
  const [clicks, setClicks] = useState<LinkClick[]>([])
  const [loadingClicks, setLoadingClicks] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Create form
  const [createForm, setCreateForm] = useState({ slug: '', label: '', destination: '' })
  const [createUrlError, setCreateUrlError] = useState<string | null>(null)

  // Edit form
  const [editForm, setEditForm] = useState({ label: '', destination: '', isActive: true })
  const [editUrlError, setEditUrlError] = useState<string | null>(null)

  async function fetchLinks() {
    try {
      setLoading(true)
      const { data } = await api.get('/api/tracking/links')
      setLinks(data)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao carregar links')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLinks() }, [])

  // ── Create ────────────────────────────────────────────────────────────────

  function handleDestinationChangeCreate(val: string) {
    setCreateForm(f => ({ ...f, destination: val }))
    setCreateUrlError(val ? validateUrl(val) : null)
  }

  async function handleCreate() {
    if (!createForm.slug || !createForm.label || !createForm.destination) {
      alert('Preencha todos os campos.')
      return
    }
    const urlErr = validateUrl(createForm.destination)
    if (urlErr) { setCreateUrlError(urlErr); return }

    try {
      setSaving(true)
      await api.post('/api/tracking/links', {
        ...createForm,
        destination: normalizeUrl(createForm.destination),
      })
      setShowCreateDialog(false)
      setCreateForm({ slug: '', label: '', destination: '' })
      setCreateUrlError(null)
      await fetchLinks()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao criar link')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function openEdit(link: TrackedLink) {
    setSelectedLink(link)
    setEditForm({ label: link.label, destination: link.destination, isActive: link.isActive })
    setEditUrlError(null)
    setShowEditDialog(true)
  }

  function handleDestinationChangeEdit(val: string) {
    setEditForm(f => ({ ...f, destination: val }))
    setEditUrlError(val ? validateUrl(val) : null)
  }

  async function handleUpdate() {
    if (!selectedLink) return
    if (!editForm.label.trim()) { alert('Label é obrigatório.'); return }
    const urlErr = validateUrl(editForm.destination)
    if (urlErr) { setEditUrlError(urlErr); return }

    try {
      setSaving(true)
      await api.put(`/api/tracking/links/${selectedLink.id}`, {
        label: editForm.label.trim(),
        destination: normalizeUrl(editForm.destination),
        isActive: editForm.isActive,
      })
      setShowEditDialog(false)
      await fetchLinks()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao atualizar link')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function openDelete(link: TrackedLink) {
    setSelectedLink(link)
    setShowDeleteDialog(true)
  }

  async function handleDelete() {
    if (!selectedLink) return
    try {
      setDeleting(true)
      await api.delete(`/api/tracking/links/${selectedLink.id}`)
      setShowDeleteDialog(false)
      setSelectedLink(null)
      await fetchLinks()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir link')
    } finally {
      setDeleting(false)
    }
  }

  // ── Clicks ────────────────────────────────────────────────────────────────

  async function handleViewClicks(link: TrackedLink) {
    setSelectedLink(link)
    setShowClicksDialog(true)
    setLoadingClicks(true)
    try {
      const { data } = await api.get(`/api/tracking/links/${link.id}/clicks`)
      setClicks(data.clicks)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao carregar cliques')
    } finally {
      setLoadingClicks(false)
    }
  }

  function handleCopy(link: TrackedLink) {
    navigator.clipboard.writeText(`${BASE_URL}/${link.slug}`)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso))
  }

  function parseUserAgent(ua?: string) {
    if (!ua) return '—'
    if (ua.includes('iPhone') || ua.includes('iPad')) return `iOS · ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ''}`
    if (ua.includes('Android')) return `Android · ${ua.match(/Android ([\d.]+)/)?.[1] ?? ''}`
    if (ua.includes('Chrome'))  return `Chrome · ${ua.match(/Chrome\/([\d.]+)/)?.[1]?.split('.')[0] ?? ''}`
    if (ua.includes('Firefox')) return `Firefox · ${ua.match(/Firefox\/([\d.]+)/)?.[1]?.split('.')[0] ?? ''}`
    if (ua.includes('Safari'))  return 'Safari'
    return ua.slice(0, 40)
  }

  // ── URL input helper ──────────────────────────────────────────────────────

  function UrlInput({ value, onChange, error, placeholder }: {
    value: string
    onChange: (v: string) => void
    error: string | null
    placeholder?: string
  }) {
    return (
      <div className="space-y-1">
        <Input
          placeholder={placeholder ?? 'https://wa.me/55...'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={error ? 'border-red-400 focus-visible:ring-red-400' : ''}
        />
        {error ? (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />{error}
          </p>
        ) : value && !validateUrl(value) ? (
          <p className="text-xs text-muted-foreground">
            Será salvo como: <span className="font-mono">{normalizeUrl(value)}</span>
          </p>
        ) : null}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Tracking</h1>
          <p className="text-muted-foreground text-sm">Rastreamento de cliques em links de campanhas de email</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />Novo Link
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Links rastreados</CardTitle>
          <CardDescription>Gerencie os links de rastreamento e veja os cliques de cada campanha</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : links.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum link cadastrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-center">Cliques</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map(link => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.label}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{link.slug}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={link.destination}>
                      {link.destination}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1">
                        <MousePointerClick className="h-3 w-3" />{link.clickCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(link.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={link.isActive ? 'default' : 'outline'}>
                        {link.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(link)} title="Copiar URL rastreável">
                          {copiedId === link.id
                            ? <Check className="h-4 w-4 text-green-500" />
                            : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(link)} title="Editar link">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleViewClicks(link)} title="Ver cliques">
                          <MousePointerClick className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDelete(link)} title="Excluir link">
                          <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* ── Dialog: Criar link ─────────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo link rastreável</DialogTitle>
            <DialogDescription>
              O link gerado terá o formato: <span className="font-mono text-xs">{BASE_URL}/[slug]</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="Ex: Email boas-vindas março 2026"
                value={createForm.label}
                onChange={e => setCreateForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">{BASE_URL}/</span>
                <Input
                  placeholder="ex: campanha-marco"
                  value={createForm.slug}
                  onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL de destino</Label>
              <UrlInput
                value={createForm.destination}
                onChange={handleDestinationChangeCreate}
                error={createUrlError}
                placeholder="wa.me/55... ou https://meusite.com/pagina"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setCreateUrlError(null) }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar link ────────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar link</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {BASE_URL}/{selectedLink?.slug}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={editForm.label}
                onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>URL de destino</Label>
              <UrlInput
                value={editForm.destination}
                onChange={handleDestinationChangeEdit}
                error={editUrlError}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Link ativo</p>
                <p className="text-xs text-muted-foreground">Links inativos não redirecionam</p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={v => setEditForm(f => ({ ...f, isActive: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar exclusão ─────────────────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir link</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o link <strong>{selectedLink?.label}</strong>?
              Todos os {selectedLink?.clickCount ?? 0} cliques registrados também serão removidos.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Ver cliques ────────────────────────────────────────────── */}
      <Dialog open={showClicksDialog} onOpenChange={setShowClicksDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MousePointerClick className="h-5 w-5" />
              Cliques — {selectedLink?.label}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span className="font-mono text-xs">{BASE_URL}/{selectedLink?.slug}</span>
              <a href={selectedLink?.destination} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </a>
            </DialogDescription>
          </DialogHeader>
          {loadingClicks ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clicks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum clique registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dispositivo / Navegador</TableHead>
                  <TableHead>Referência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clicks.map(click => (
                  <TableRow key={click.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(click.clickedAt)}</TableCell>
                    <TableCell className="font-mono text-sm">{click.ipAddress ?? '—'}</TableCell>
                    <TableCell className="text-sm">{parseUserAgent(click.userAgent)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate" title={click.referer ?? ''}>
                      {click.referer ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">{clicks.length} clique{clicks.length !== 1 ? 's' : ''} no total</span>
              <Button variant="outline" onClick={() => setShowClicksDialog(false)}>Fechar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
