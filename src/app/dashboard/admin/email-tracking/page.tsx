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
import { Badge } from '@/components/ui/badge'
import { Plus, Copy, MousePointerClick, Loader2, ExternalLink, Check } from 'lucide-react'
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

export default function EmailTrackingPage() {
  const [links, setLinks] = useState<TrackedLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showClicksDialog, setShowClicksDialog] = useState(false)
  const [selectedLink, setSelectedLink] = useState<TrackedLink | null>(null)
  const [clicks, setClicks] = useState<LinkClick[]>([])
  const [loadingClicks, setLoadingClicks] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    slug: '',
    label: '',
    destination: '',
  })

  async function fetchLinks() {
    try {
      setLoading(true)
      const { data } = await api.get('/api/tracking/links')
      setLinks(data)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao carregar links')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLinks()
  }, [])

  async function handleCreate() {
    if (!formData.slug || !formData.label || !formData.destination) {
      alert('Preencha todos os campos.')
      return
    }
    try {
      setSaving(true)
      await api.post('/api/tracking/links', formData)
      setShowCreateDialog(false)
      setFormData({ slug: '', label: '', destination: '' })
      await fetchLinks()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar link')
    } finally {
      setSaving(false)
    }
  }

  async function handleViewClicks(link: TrackedLink) {
    setSelectedLink(link)
    setShowClicksDialog(true)
    setLoadingClicks(true)
    try {
      const { data } = await api.get(`/api/tracking/links/${link.id}/clicks`)
      setClicks(data.clicks)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao carregar cliques')
    } finally {
      setLoadingClicks(false)
    }
  }

  function handleCopy(link: TrackedLink) {
    navigator.clipboard.writeText(`${BASE_URL}/${link.slug}`)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
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

  function parseUserAgent(ua?: string) {
    if (!ua) return '—'
    if (ua.includes('iPhone') || ua.includes('iPad')) return `iOS · ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ''}`
    if (ua.includes('Android')) return `Android · ${ua.match(/Android ([\d.]+)/)?.[1] ?? ''}`
    if (ua.includes('Chrome')) return `Chrome · ${ua.match(/Chrome\/([\d.]+)/)?.[1]?.split('.')[0] ?? ''}`
    if (ua.includes('Firefox')) return `Firefox · ${ua.match(/Firefox\/([\d.]+)/)?.[1]?.split('.')[0] ?? ''}`
    if (ua.includes('Safari')) return `Safari`
    return ua.slice(0, 40)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Tracking</h1>
          <p className="text-muted-foreground text-sm">Rastreamento de cliques em links de campanhas de email</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Link
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Links rastreados</CardTitle>
          <CardDescription>Clique em "Ver cliques" para ver os detalhes de cada acesso</CardDescription>
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
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.label}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{link.slug}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={link.destination}>
                      {link.destination}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        {link.clickCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(link.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={link.isActive ? 'default' : 'outline'}>
                        {link.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(link)}
                          title="Copiar URL rastreável"
                        >
                          {copiedId === link.id
                            ? <Check className="h-4 w-4 text-green-500" />
                            : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewClicks(link)}
                        >
                          <MousePointerClick className="h-4 w-4 mr-1" />
                          Ver cliques
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

      {/* Dialog: Criar novo link */}
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
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">{BASE_URL}/</span>
                <Input
                  placeholder="ex: campanha-marco"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL de destino</Label>
              <Input
                placeholder="https://wa.me/55..."
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver cliques */}
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
                {clicks.map((click) => (
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
