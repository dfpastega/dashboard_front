'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus, Loader2, Trash2, ArrowLeft, ArrowLeftRight, Send, Save, GalleryHorizontalEnd,
  Image as ImageIcon, ShieldCheck, AlertTriangle, Film, Phone,
} from 'lucide-react'
import { api } from '@/lib/api'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ButtonType = 'quick_reply' | 'url'
type MediaKind = 'image' | 'video'

interface CarouselCard {
  id: string
  mediaId?: string
  mediaUrl?: string
  mediaKind: MediaKind
  bodyText: string
  buttonText: string
  buttonValue: string
  button2Text?: string
  button2Value?: string
}

interface CarouselDoc {
  bodyText: string
  buttonType: ButtonType
  cards: CarouselCard[]
}

interface CarouselSummary {
  id: string
  name: string
  cardCount: number
  updatedAt: string
  createdByName: string | null
}

interface SendRow {
  id: string
  phoneNumber: string
  cardCount: number
  status: string
  errorMessage: string | null
  createdAt: string
}

interface TestNumber {
  id: string
  phoneNumber: string
  label: string | null
  isActive: boolean
}

const LIMITS = {
  minCards: 2, maxCards: 10, bodyText: 1024, cardBodyText: 160, cardLineBreaks: 2,
}

const newId = () => Math.random().toString(36).slice(2, 10)

const emptyCard = (): CarouselCard => ({
  id: newId(), mediaKind: 'image', bodyText: '', buttonText: '', buttonValue: '',
})

// ─── Página ──────────────────────────────────────────────────────────────────

export default function CarrosselStudioPage() {
  const [list, setList] = useState<CarouselSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState<CarouselSummary | null>(null)
  const [doc, setDoc] = useState<CarouselDoc>({ bodyText: '', buttonType: 'quick_reply', cards: [] })
  const [mediaBase, setMediaBase] = useState('')
  const [sends, setSends] = useState<SendRow[]>([])
  const [selected, setSelected] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  const [showSend, setShowSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [phone, setPhone] = useState('')
  const [testNumbers, setTestNumbers] = useState<TestNumber[]>([])

  // ── carregamento ──────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/carousels')
      setList(data.carousels ?? [])
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao carregar os carrosséis')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchNumbers = useCallback(async () => {
    try {
      // Allowlist compartilhada com o Flows Studio.
      const { data } = await api.get('/api/flows/test-numbers')
      setTestNumbers((data.testNumbers ?? []).filter((n: TestNumber) => n.isActive))
    } catch { /* lista vazia é tratada na UI */ }
  }, [])

  useEffect(() => { fetchList(); fetchNumbers() }, [fetchList, fetchNumbers])

  async function openEditor(c: CarouselSummary) {
    try {
      const { data } = await api.get(`/api/carousels/${c.id}`)
      const loaded: CarouselDoc = data.document?.cards?.length
        ? data.document
        : { bodyText: '', buttonType: 'quick_reply', cards: [emptyCard(), emptyCard()] }
      setOpen(c)
      setDoc(loaded)
      setMediaBase(data.mediaBaseUrl ?? '')
      setSends(data.sends ?? [])
      setSelected(0)
      setDirty(false)
      setWarning(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao abrir')
    }
  }

  function closeEditor() {
    if (dirty && !confirm('Há alterações não salvas. Sair mesmo assim?')) return
    setOpen(null)
    fetchList()
  }

  // ── ações ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!newName.trim()) return alert('Dê um nome ao carrossel.')
    try {
      setSaving(true)
      const { data } = await api.post('/api/carousels', { name: newName.trim() })
      setShowNew(false)
      setNewName('')
      await fetchList()
      await openEditor({ ...data.carousel, cardCount: 0 })
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!open) return
    try {
      setSaving(true)
      const { data } = await api.put(`/api/carousels/${open.id}`, { document: doc })
      // O backend normaliza a estrutura pelo card 1 — adotamos o resultado para
      // a tela mostrar exatamente o que foi gravado.
      if (data.document) setDoc(data.document)
      setDirty(false)
      setWarning(data.ready ? null : data.warning)
      if (data.ready) alert('Carrossel salvo e pronto para enviar.')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleSend() {
    if (!open || !phone) return alert('Escolha um número de teste.')
    if (dirty && !confirm('Há alterações não salvas — envio a última versão salva. Continuar?')) return
    try {
      setSending(true)
      const { data } = await api.post(`/api/carousels/${open.id}/send`, { phone })
      setShowSend(false)
      alert(`${data.message}\n\n${data.cardCount} cards`)
      const r = await api.get(`/api/carousels/${open.id}`)
      setSends(r.data.sends ?? [])
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  async function handleUpload(cardId: string, file: File) {
    const form = new FormData()
    form.append('file', file)
    try {
      setUploading(cardId)
      const { data } = await api.post('/api/carousels/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      patchCard(cardId, { mediaId: data.media.id, mediaKind: data.media.kind, mediaUrl: undefined })
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao subir o arquivo')
    } finally {
      setUploading(null)
    }
  }

  // ── manipulação ───────────────────────────────────────────────────────────

  function patchCard(cardId: string, patch: Partial<CarouselCard>) {
    setDoc(d => ({ ...d, cards: d.cards.map(c => (c.id === cardId ? { ...c, ...patch } : c)) }))
    setDirty(true)
  }

  function addCard() {
    if (doc.cards.length >= LIMITS.maxCards) {
      return alert(`O WhatsApp aceita no máximo ${LIMITS.maxCards} cards.`)
    }
    setDoc(d => {
      const first = d.cards[0]
      const card = emptyCard()
      // O card 1 define a estrutura. Sem isto, um card novo entra com um botão
      // num carrossel de dois e a Meta recusa a mensagem inteira.
      if (first?.button2Text?.trim() && d.buttonType === 'quick_reply') {
        card.button2Text = first.button2Text
        card.button2Value = `${first.button2Value || 'botao2'}_${d.cards.length + 1}`
      }
      if (first) card.mediaKind = first.mediaKind
      return { ...d, cards: [...d.cards, card] }
    })
    setSelected(doc.cards.length)
    setDirty(true)
  }

  function removeCard(i: number) {
    if (doc.cards.length <= LIMITS.minCards) {
      return alert(`O carrossel precisa de pelo menos ${LIMITS.minCards} cards.`)
    }
    if (!confirm('Remover este card?')) return
    setDoc(d => ({ ...d, cards: d.cards.filter((_, j) => j !== i) }))
    setSelected(s => Math.max(0, s - (i <= s ? 1 : 0)))
    setDirty(true)
  }

  function moveCard(i: number, dir: -1 | 1) {
    const t = i + dir
    if (t < 0 || t >= doc.cards.length) return
    setDoc(d => {
      const cards = [...d.cards]
      ;[cards[i], cards[t]] = [cards[t], cards[i]]
      return { ...d, cards }
    })
    setSelected(t)
    setDirty(true)
  }

  /** Segundo botão é tudo-ou-nada: a Meta exige a mesma quantidade em todos. */
  function toggleSecondButton(on: boolean) {
    setDoc(d => ({
      ...d,
      cards: d.cards.map((c, i) => on
        ? {
            ...c,
            button2Text: c.button2Text?.trim() || 'Repetir',
            button2Value: c.button2Value?.trim() || `repetir_${i + 1}`,
          }
        : { ...c, button2Text: undefined, button2Value: undefined }),
    }))
    setDirty(true)
  }

  const mediaSrc = (c: CarouselCard) =>
    c.mediaId ? `${mediaBase}/${c.mediaId}` : c.mediaUrl

  // ── lista ─────────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Carrossel Studio</h1>
            <p className="text-muted-foreground text-sm">
              Monte carrosséis interativos e teste em números reais
            </p>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo carrossel
          </Button>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Mesmas travas do Flows Studio</p>
              <p className="text-muted-foreground">
                Conta <strong>demo</strong> do Smarters e envio só para números da lista de
                teste — que é a mesma do Flows Studio. Cadastre os números por lá.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carrosséis</CardTitle>
            <CardDescription>
              De {LIMITS.minCards} a {LIMITS.maxCards} cards, cada um com imagem ou vídeo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : list.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <GalleryHorizontalEnd className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum carrossel ainda.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cards</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="secondary">{c.cardCount}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.createdByName ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEditor(c)}>Abrir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo carrossel</DialogTitle>
              <DialogDescription>Começa com dois cards em branco.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newName} maxLength={255} placeholder="Lesson 04 — carrossel"
                onChange={e => setNewName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── editor ────────────────────────────────────────────────────────────────

  const card = doc.cards[selected]
  const hasSecond = Boolean(doc.cards[0]?.button2Text?.trim())

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={closeEditor}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{open.name}</h1>
            <p className="text-xs text-muted-foreground">
              {doc.cards.length} cards{dirty && ' · alterações não salvas'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setShowSend(true)}>
            <Send className="h-4 w-4 mr-2" /> Enviar teste
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {warning && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Salvo, mas ainda não dá para enviar</p>
              <p className="text-muted-foreground">{warning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem e botões — valem para todos os cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">A mensagem</CardTitle>
          <CardDescription>
            O texto aparece acima do carrossel. O tipo de botão vale para todos os cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Texto de abertura <span className="text-muted-foreground text-xs">(até {LIMITS.bodyText})</span></Label>
            <Textarea rows={2} maxLength={LIMITS.bodyText} value={doc.bodyText}
              placeholder="Sua aula de hoje chegou! Deslize para ver as expressões."
              onChange={e => { setDoc(d => ({ ...d, bodyText: e.target.value })); setDirty(true) }} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de botão</Label>
              <Select value={doc.buttonType}
                onValueChange={(v: ButtonType) => {
                  setDoc(d => ({ ...d, buttonType: v }))
                  if (v === 'url') toggleSecondButton(false)
                  setDirty(true)
                }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick_reply">Resposta rápida (volta no webhook)</SelectItem>
                  <SelectItem value="url">Abrir link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {doc.buttonType === 'quick_reply' && (
              <div className="space-y-2">
                <Label>Segundo botão em todos os cards</Label>
                <Button variant={hasSecond ? 'default' : 'outline'} className="w-full justify-start"
                  onClick={() => toggleSecondButton(!hasSecond)}>
                  {hasSecond ? 'Dois botões por card' : 'Um botão por card'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  O WhatsApp exige o mesmo número de botões em todos os cards. O
                  <strong> card 1 define a estrutura</strong> e os demais são ajustados
                  sozinhos ao salvar — inclusive os que você adicionar depois.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Cards */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cards</CardTitle>
            <CardDescription className="text-xs">
              {doc.cards.length} de {LIMITS.maxCards}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {doc.cards.map((c, i) => (
              <div key={c.id} onClick={() => setSelected(i)}
                className={`rounded-md border p-2 cursor-pointer transition-colors ${
                  i === selected ? 'border-primary bg-accent' : 'hover:bg-accent/50'}`}>
                <div className="flex items-center gap-2">
                  {mediaSrc(c) ? (
                    c.mediaKind === 'video'
                      ? <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                          <Film className="h-4 w-4 text-muted-foreground" />
                        </div>
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={mediaSrc(c)} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded border border-dashed flex items-center justify-center shrink-0">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-muted-foreground">card {i + 1}</div>
                    <div className="text-sm truncate">{c.bodyText || '—'}</div>
                  </div>
                </div>
                {i === selected && (
                  <div className="flex gap-1 mt-2">
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={e => { e.stopPropagation(); moveCard(i, -1) }}>
                      <ArrowLeftRight className="h-3 w-3 rotate-180" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={e => { e.stopPropagation(); moveCard(i, 1) }}>
                      <ArrowLeftRight className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                      onClick={e => { e.stopPropagation(); removeCard(i) }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={addCard}
              disabled={doc.cards.length >= LIMITS.maxCards}>
              <Plus className="h-3.5 w-3.5 mr-2" /> Card
            </Button>
          </CardContent>
        </Card>

        {/* Editor do card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Card {selected + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Imagem ou vídeo</Label>
              <div className="flex items-start gap-4">
                {mediaSrc(card) ? (
                  card.mediaKind === 'video' ? (
                    <video src={mediaSrc(card)} controls
                      className="h-28 w-28 rounded-md border object-cover bg-muted" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaSrc(card)} alt=""
                      className="h-28 w-28 rounded-md border object-contain bg-muted" />
                  )
                ) : (
                  <div className="h-28 w-28 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="space-y-2 flex-1">
                  <Input type="file" accept="image/jpeg,image/png,video/mp4"
                    disabled={uploading === card.id}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(card.id, f) }} />
                  {uploading === card.id && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> subindo…
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG ou MP4 (até 16 MB). O arquivo passa a ser servido por uma URL
                    pública — é assim que o WhatsApp busca a mídia do card.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dica: para ter áudio no card, exporte um MP4 com a arte parada e a
                    narração. Áudio puro não é aceito como mídia de card.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Texto do card
                <span className="text-muted-foreground text-xs ml-1">
                  ({(card.bodyText ?? '').length}/{LIMITS.cardBodyText}, até {LIMITS.cardLineBreaks} quebras de linha)
                </span>
              </Label>
              <Textarea rows={3} maxLength={LIMITS.cardBodyText} value={card.bodyText}
                placeholder="What's your name? (uóts ior neim?)"
                onChange={e => patchCard(card.id, { bodyText: e.target.value })} />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Texto do botão</Label>
                <Input value={card.buttonText} maxLength={25}
                  placeholder={doc.buttonType === 'url' ? 'Abrir' : 'Ouvir de novo'}
                  onChange={e => patchCard(card.id, { buttonText: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{doc.buttonType === 'url' ? 'URL de destino' : 'Payload devolvido'}</Label>
                <Input value={card.buttonValue}
                  placeholder={doc.buttonType === 'url' ? 'https://…' : 'card_1_ouvir'}
                  onChange={e => patchCard(card.id, { buttonValue: e.target.value })} />
              </div>
            </div>

            {doc.buttonType === 'quick_reply' && hasSecond && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Segundo botão</Label>
                  <Input value={card.button2Text ?? ''} maxLength={25}
                    onChange={e => patchCard(card.id, { button2Text: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Payload do segundo</Label>
                  <Input value={card.button2Value ?? ''}
                    onChange={e => patchCard(card.id, { button2Value: e.target.value })} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {sends.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimos envios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-40 overflow-y-auto text-sm">
              {sends.map(s => (
                <div key={s.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === 'sent' ? 'secondary' : 'destructive'}>{s.status}</Badge>
                    <span className="font-mono text-xs">{s.phoneNumber}</span>
                    <span className="text-xs text-muted-foreground">{s.cardCount} cards</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar carrossel de teste</DialogTitle>
            <DialogDescription>
              Conta demo, e só para números da allowlist. A janela de 24h do número
              precisa estar aberta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Número de teste</Label>
            <Select value={phone} onValueChange={setPhone}>
              <SelectTrigger><SelectValue placeholder="Escolha um número" /></SelectTrigger>
              <SelectContent>
                {testNumbers.map(n => (
                  <SelectItem key={n.id} value={n.phoneNumber}>
                    {n.phoneNumber}{n.label ? ` — ${n.label}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {testNumbers.length === 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Nenhum número cadastrado — use “Números de teste” no Flows Studio.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSend(false)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={sending || !phone}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
