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
  Plus, Loader2, Trash2, ArrowLeft, ArrowUp, ArrowDown, Eye, Send, Save,
  Layers, Image as ImageIcon, CheckCircle2, XCircle, ShieldCheck, Phone,
  AlertTriangle, History,
} from 'lucide-react'
import { api } from '@/lib/api'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type BlockType = 'cover' | 'card' | 'choice' | 'input' | 'ending'

interface ChoiceOption { text: string; correct?: boolean }

interface Block {
  id: string
  type: BlockType
  image?: string
  title?: string
  body?: string
  prompt?: string
  label?: string
  helper?: string
  buttonLabel?: string
  captionLeft?: string
  captionRight?: string
  options?: ChoiceOption[]
}

interface FlowDoc { name: string; screens: Block[] }

interface FlowSummary {
  id: string
  name: string
  flowKey: string
  smartersFlowId: string | null
  status: string
  latestVersion: number
  compiledBytes: number
  updatedAt: string
  createdByName: string | null
}

interface VersionRow {
  id: string
  version: number
  label: string | null
  compiledBytes: number
  pushedAt: string | null
  createdAt: string
  createdByName: string | null
}

interface TestNumber {
  id: string
  phoneNumber: string
  label: string | null
  isActive: boolean
}

interface SendRow {
  id: string
  phoneNumber: string
  status: string
  errorMessage: string | null
  createdAt: string
  sentByName: string | null
}

const LIMIT_BYTES = 1024 * 1024

const BLOCK_LABELS: Record<BlockType, string> = {
  cover: 'Capa',
  card: 'Card com imagem',
  choice: 'Pergunta de múltipla escolha',
  input: 'Campo de resposta',
  ending: 'Encerramento',
}

const BLOCK_HINTS: Record<BlockType, string> = {
  cover: 'Primeira tela da aula. Costuma ter só a arte de capa e o botão.',
  card: 'Uma carta de conteúdo. A arte da Storm já traz o texto embutido.',
  choice: 'O aluno escolhe uma alternativa. A resposta volta no postback.',
  input: 'O aluno digita uma resposta livre.',
  ending: 'Última tela. Fecha a aula e devolve as respostas.',
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/**
 * Redimensiona e recomprime no navegador antes de virar base64. Sem isso o
 * card de 1200px estoura o teto de 1 MB do Flow JSON com poucas telas.
 */
function fileToBase64(file: File, maxPx = 900, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não consegui ler o arquivo'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida'))
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas indisponível'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        // A Meta quer base64 puro, sem o prefixo data:
        resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** Estimativa local do peso, para o admin não descobrir o estouro só ao salvar. */
function estimateBytes(doc: FlowDoc) {
  return new Blob([JSON.stringify(doc)]).size
}

function emptyBlock(type: BlockType): Block {
  const base: Block = { id: newId(), type }
  if (type === 'choice') {
    return { ...base, prompt: '', options: [{ text: '', correct: true }, { text: '' }], buttonLabel: 'Responder' }
  }
  if (type === 'input') return { ...base, label: '', helper: '', buttonLabel: 'Continuar' }
  if (type === 'ending') return { ...base, title: 'Aula concluída', body: '', buttonLabel: 'Concluir' }
  if (type === 'cover') return { ...base, body: '', buttonLabel: 'Começar' }
  return { ...base, body: '', buttonLabel: 'Próximo' }
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function FlowsStudioPage() {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [openFlow, setOpenFlow] = useState<FlowSummary | null>(null)
  const [doc, setDoc] = useState<FlowDoc>({ name: '', screens: [] })
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [sends, setSends] = useState<SendRow[]>([])
  const [selected, setSelected] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  const [showSend, setShowSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendForm, setSendForm] = useState({
    phone: '', headerText: '', bodyText: '', footerText: '', buttonText: 'Começar aula',
  })

  const [showNumbers, setShowNumbers] = useState(false)
  const [testNumbers, setTestNumbers] = useState<TestNumber[]>([])
  const [numberForm, setNumberForm] = useState({ phoneNumber: '', label: '' })

  const [metaErrors, setMetaErrors] = useState<Array<{ message: string; path?: string }>>([])

  // ── carregamento ──────────────────────────────────────────────────────────

  const fetchFlows = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/flows')
      setFlows(data.flows ?? [])
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao carregar as aulas')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTestNumbers = useCallback(async () => {
    try {
      const { data } = await api.get('/api/flows/test-numbers')
      setTestNumbers((data.testNumbers ?? []).filter((n: TestNumber) => n.isActive))
    } catch {
      /* silencioso: a lista aparece vazia e o admin recadastra */
    }
  }, [])

  useEffect(() => { fetchFlows(); fetchTestNumbers() }, [fetchFlows, fetchTestNumbers])

  async function openEditor(flow: FlowSummary) {
    try {
      const { data } = await api.get(`/api/flows/${flow.id}`)
      const loaded: FlowDoc = data.document?.screens?.length
        ? data.document
        : { name: flow.name, screens: [emptyBlock('cover'), emptyBlock('ending')] }
      setOpenFlow(flow)
      setDoc(loaded)
      setVersions(data.versions ?? [])
      setSelected(0)
      setDirty(false)
      setMetaErrors([])
      const s = await api.get(`/api/flows/${flow.id}/sends`)
      setSends(s.data.sends ?? [])
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao abrir a aula')
    }
  }

  function closeEditor() {
    if (dirty && !confirm('Você tem alterações não salvas. Sair mesmo assim?')) return
    setOpenFlow(null)
    setDoc({ name: '', screens: [] })
    fetchFlows()
  }

  // ── ações ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!newName.trim()) return alert('Dê um nome para a aula.')
    try {
      setSaving(true)
      const { data } = await api.post('/api/flows', { name: newName.trim() })
      setShowNew(false)
      setNewName('')
      await fetchFlows()
      await openEditor({ ...data.flow, latestVersion: 0, compiledBytes: 0 })
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar a aula')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveVersion() {
    if (!openFlow) return
    try {
      setSaving(true)
      setMetaErrors([])
      const { data } = await api.post(`/api/flows/${openFlow.id}/versions`, { document: doc })
      setDirty(false)
      alert(`${data.message} — ${fmtBytes(data.version.compiledBytes)} de 1 MB usados.`)
      await openEditor(openFlow)
    } catch (error: any) {
      const res = error.response?.data
      if (error.response?.status === 422 && res?.validationErrors) {
        setMetaErrors(res.validationErrors)
        alert('O WhatsApp recusou o layout. Veja os detalhes no topo da tela.')
      } else {
        alert(res?.error || 'Erro ao salvar a versão')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePreview() {
    if (!openFlow) return
    if (dirty && !confirm('Há alterações não salvas — o preview mostra a última versão salva. Continuar?')) return
    try {
      const { data } = await api.get(`/api/flows/${openFlow.id}/preview?refresh=true`)
      if (data.previewUrl) window.open(data.previewUrl, '_blank')
      else alert('A Meta não devolveu link de preview. Salve uma versão antes.')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao gerar o preview')
    }
  }

  async function handleSend() {
    if (!openFlow) return
    if (!sendForm.phone) return alert('Escolha um número de teste.')
    if (!sendForm.bodyText.trim()) return alert('Escreva a mensagem que abre a aula.')
    try {
      setSending(true)
      const { data } = await api.post(`/api/flows/${openFlow.id}/send`, {
        phone: sendForm.phone,
        bodyText: sendForm.bodyText.trim(),
        buttonText: sendForm.buttonText.trim() || 'Começar',
        headerText: sendForm.headerText.trim() || undefined,
        footerText: sendForm.footerText.trim() || undefined,
      })
      setShowSend(false)
      alert(`${data.message}\n\nVersão ${data.version} · token ${data.flowToken}`)
      const s = await api.get(`/api/flows/${openFlow.id}/sends`)
      setSends(s.data.sends ?? [])
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  async function handleAddNumber() {
    if (!numberForm.phoneNumber.trim()) return alert('Informe o número.')
    try {
      await api.post('/api/flows/test-numbers', {
        phoneNumber: numberForm.phoneNumber.trim(),
        label: numberForm.label.trim() || undefined,
      })
      setNumberForm({ phoneNumber: '', label: '' })
      await fetchTestNumbers()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao cadastrar o número')
    }
  }

  async function handleRemoveNumber(id: string) {
    if (!confirm('Remover este número da lista de teste?')) return
    try {
      await api.delete(`/api/flows/test-numbers/${id}`)
      await fetchTestNumbers()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao remover o número')
    }
  }

  // ── manipulação de blocos ─────────────────────────────────────────────────

  function patchBlock(index: number, patch: Partial<Block>) {
    setDoc(d => ({ ...d, screens: d.screens.map((b, i) => (i === index ? { ...b, ...patch } : b)) }))
    setDirty(true)
  }

  function addBlock(type: BlockType) {
    setDoc(d => {
      const screens = [...d.screens]
      // Encerramento tem que continuar por último — o compilador exige.
      const endIdx = screens.findIndex(b => b.type === 'ending')
      const at = endIdx === -1 ? screens.length : endIdx
      screens.splice(at, 0, emptyBlock(type))
      setSelected(at)
      return { ...d, screens }
    })
    setDirty(true)
  }

  function removeBlock(index: number) {
    if (doc.screens[index].type === 'ending') {
      return alert('A tela de encerramento é obrigatória e não pode ser removida.')
    }
    if (!confirm('Remover esta tela?')) return
    setDoc(d => ({ ...d, screens: d.screens.filter((_, i) => i !== index) }))
    setSelected(s => Math.max(0, s - (index <= s ? 1 : 0)))
    setDirty(true)
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= doc.screens.length) return
    if (doc.screens[index].type === 'ending' || doc.screens[target].type === 'ending') {
      return alert('A tela de encerramento precisa ficar por último.')
    }
    setDoc(d => {
      const screens = [...d.screens]
      ;[screens[index], screens[target]] = [screens[target], screens[index]]
      return { ...d, screens }
    })
    setSelected(target)
    setDirty(true)
  }

  async function handleImage(index: number, file: File) {
    try {
      const base64 = await fileToBase64(file)
      patchBlock(index, { image: base64 })
    } catch (error: any) {
      alert(error.message || 'Não consegui processar a imagem')
    }
  }

  // ── lista de aulas ────────────────────────────────────────────────────────

  if (!openFlow) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Flows Studio</h1>
            <p className="text-muted-foreground text-sm">
              Monte aulas em WhatsApp Flow e teste em números reais
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNumbers(true)}>
              <Phone className="h-4 w-4 mr-2" />
              Números de teste
              <Badge variant="secondary" className="ml-2">{testNumbers.length}</Badge>
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova aula
            </Button>
          </div>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Ambiente de teste isolado</p>
              <p className="text-muted-foreground">
                O Studio usa exclusivamente a conta <strong>demo</strong> do Smarters e só envia
                para números cadastrados na lista de teste. Nenhuma ação aqui alcança o bot de
                produção nem publica a aula.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aulas</CardTitle>
            <CardDescription>Cada save cria uma versão nova e imutável</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : flows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhuma aula ainda. Crie a primeira.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aula</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Criada por</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flows.map(f => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">{f.flowKey}</div>
                      </TableCell>
                      <TableCell>
                        {f.latestVersion > 0
                          ? <Badge variant="secondary">v{f.latestVersion}</Badge>
                          : <span className="text-xs text-muted-foreground">sem versão</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.compiledBytes ? fmtBytes(f.compiledBytes) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.createdByName ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEditor(f)}>
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <NewFlowDialog
          open={showNew} onOpenChange={setShowNew}
          name={newName} setName={setNewName}
          saving={saving} onCreate={handleCreate}
        />
        <TestNumbersDialog
          open={showNumbers} onOpenChange={setShowNumbers}
          numbers={testNumbers} form={numberForm} setForm={setNumberForm}
          onAdd={handleAddNumber} onRemove={handleRemoveNumber}
        />
      </div>
    )
  }

  // ── editor ────────────────────────────────────────────────────────────────

  const block = doc.screens[selected]
  const estimated = estimateBytes(doc)
  const pct = Math.min(100, Math.round((estimated / LIMIT_BYTES) * 100))

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={closeEditor}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{openFlow.name}</h1>
            <p className="text-xs text-muted-foreground">
              {doc.screens.length} telas
              {versions[0] ? ` · última v${versions[0].version}` : ' · nenhuma versão salva'}
              {dirty && ' · alterações não salvas'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={handlePreview} disabled={!versions.length}>
            <Eye className="h-4 w-4 mr-2" /> Pré-visualizar
          </Button>
          <Button variant="outline" onClick={() => setShowSend(true)} disabled={!versions.length}>
            <Send className="h-4 w-4 mr-2" /> Enviar teste
          </Button>
          <Button onClick={handleSaveVersion} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar versão
          </Button>
        </div>
      </div>

      {metaErrors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" /> O WhatsApp recusou este layout
            </div>
            {metaErrors.map((e, i) => (
              <div key={i} className="text-muted-foreground">
                • {e.message} {e.path && <code className="text-xs">({e.path})</code>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="shrink-0">Peso estimado</span>
        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${pct > 85 ? 'bg-destructive' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0">{fmtBytes(estimated)} de 1 MB ({pct}%)</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Lista de telas */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Telas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {doc.screens.map((b, i) => (
              <div
                key={b.id}
                onClick={() => setSelected(i)}
                className={`rounded-md border p-2 cursor-pointer transition-colors ${
                  i === selected ? 'border-primary bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{BLOCK_LABELS[b.type]}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {b.title || b.prompt || b.label || b.body?.slice(0, 32) || '—'}
                    </div>
                  </div>
                  {b.image && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </div>
                {i === selected && (
                  <div className="flex gap-1 mt-2">
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={e => { e.stopPropagation(); moveBlock(i, -1) }}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={e => { e.stopPropagation(); moveBlock(i, 1) }}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                      onClick={e => { e.stopPropagation(); removeBlock(i) }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <Separator className="my-3" />
            <Label className="text-xs text-muted-foreground">Adicionar tela</Label>
            <div className="grid gap-1.5">
              {(['card', 'choice', 'input', 'cover'] as BlockType[]).map(t => (
                <Button key={t} size="sm" variant="outline" className="justify-start"
                  onClick={() => addBlock(t)}>
                  <Plus className="h-3.5 w-3.5 mr-2" /> {BLOCK_LABELS[t]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Editor do bloco */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{BLOCK_LABELS[block.type]}</CardTitle>
            <CardDescription>{BLOCK_HINTS[block.type]}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {block.type !== 'ending' && block.type !== 'choice' && (
              <div className="space-y-2">
                <Label>Imagem do card</Label>
                <div className="flex items-start gap-4">
                  {block.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`data:image/jpeg;base64,${block.image}`} alt=""
                      className="h-28 w-28 rounded-md border object-contain bg-muted" />
                  ) : (
                    <div className="h-28 w-28 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input type="file" accept="image/jpeg,image/png"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(selected, f) }} />
                    <p className="text-xs text-muted-foreground">
                      Reduzida para 900px e comprimida no navegador. Envie o card quadrado —
                      ele aparece inteiro, sem corte.
                    </p>
                    {block.image && (
                      <Button size="sm" variant="ghost" className="text-destructive h-7"
                        onClick={() => patchBlock(selected, { image: undefined })}>
                        <Trash2 className="h-3 w-3 mr-1" /> Remover imagem
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {block.type === 'ending' && (
              <div className="space-y-2">
                <Label>Título <span className="text-muted-foreground text-xs">(até 80)</span></Label>
                <Input value={block.title ?? ''} maxLength={80}
                  onChange={e => patchBlock(selected, { title: e.target.value })} />
              </div>
            )}

            {block.type === 'choice' && (
              <>
                <div className="space-y-2">
                  <Label>Pergunta <span className="text-muted-foreground text-xs">(até 30)</span></Label>
                  <Input value={block.prompt ?? ''} maxLength={30}
                    placeholder="O que significa Hello?"
                    onChange={e => patchBlock(selected, { prompt: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Alternativas <span className="text-muted-foreground text-xs">(até 30 caracteres cada)</span></Label>
                  {(block.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Button size="icon" variant={opt.correct ? 'default' : 'outline'}
                        className="h-8 w-8 shrink-0"
                        title={opt.correct ? 'Resposta correta' : 'Marcar como correta'}
                        onClick={() => patchBlock(selected, {
                          options: (block.options ?? []).map((o, j) => ({ ...o, correct: j === oi })),
                        })}>
                        {opt.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4 opacity-40" />}
                      </Button>
                      <Input value={opt.text} maxLength={30} placeholder={`Alternativa ${oi + 1}`}
                        onChange={e => patchBlock(selected, {
                          options: (block.options ?? []).map((o, j) => (j === oi ? { ...o, text: e.target.value } : o)),
                        })} />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0"
                        disabled={(block.options ?? []).length <= 2}
                        onClick={() => patchBlock(selected, {
                          options: (block.options ?? []).filter((_, j) => j !== oi),
                        })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline"
                    disabled={(block.options ?? []).length >= 20}
                    onClick={() => patchBlock(selected, { options: [...(block.options ?? []), { text: '' }] })}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Alternativa
                  </Button>
                </div>
              </>
            )}

            {block.type === 'input' && (
              <>
                <div className="space-y-2">
                  <Label>Rótulo do campo <span className="text-muted-foreground text-xs">(até 20)</span></Label>
                  <Input value={block.label ?? ''} maxLength={20} placeholder="My name is..."
                    onChange={e => patchBlock(selected, { label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Dica <span className="text-muted-foreground text-xs">(opcional, até 80)</span></Label>
                  <Input value={block.helper ?? ''} maxLength={80} placeholder="Escreva seu nome"
                    onChange={e => patchBlock(selected, { helper: e.target.value })} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>
                Texto da tela
                <span className="text-muted-foreground text-xs ml-1">
                  (opcional · **negrito** e _itálico_ funcionam)
                </span>
              </Label>
              <Textarea rows={4} maxLength={4096} value={block.body ?? ''}
                placeholder="Explicação que aparece abaixo do card"
                onChange={e => patchBlock(selected, { body: e.target.value })} />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Texto do botão <span className="text-muted-foreground text-xs">(até 35)</span></Label>
                <Input value={block.buttonLabel ?? ''} maxLength={35}
                  onChange={e => patchBlock(selected, { buttonLabel: e.target.value })} />
              </div>
              {block.type !== 'ending' && (
                <>
                  <div className="space-y-2">
                    <Label>Legenda esquerda <span className="text-muted-foreground text-xs">(até 15)</span></Label>
                    <Input value={block.captionLeft ?? ''} maxLength={15} placeholder="Lesson 04"
                      onChange={e => patchBlock(selected, { captionLeft: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Legenda direita <span className="text-muted-foreground text-xs">(até 15)</span></Label>
                    <Input value={block.captionRight ?? ''} maxLength={15} placeholder="1 de 3"
                      onChange={e => patchBlock(selected, { captionRight: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            {block.type !== 'ending' && (block.captionLeft ? 1 : 0) + (block.captionRight ? 1 : 0) === 1 && (
              <p className="text-xs text-amber-600">
                O WhatsApp só aceita as duas legendas juntas. Com apenas uma preenchida, nenhuma
                será exibida.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Versões
            </CardTitle>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma versão salva</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-sm">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{v.version}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {new Date(v.createdAt).toLocaleString('pt-BR')} · {v.createdByName ?? '—'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {v.pushedAt ? fmtBytes(v.compiledBytes) : 'com erro'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" /> Últimos envios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sends.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum envio ainda</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-sm">
                {sends.map(s => (
                  <div key={s.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={s.status === 'sent' ? 'secondary' : 'destructive'}>{s.status}</Badge>
                      <span className="font-mono text-xs">{s.phoneNumber}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enviar */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para número de teste</DialogTitle>
            <DialogDescription>
              Envia a última versão salva usando a conta demo. A janela de 24h do número
              precisa estar aberta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número de teste</Label>
              <Select value={sendForm.phone} onValueChange={v => setSendForm(f => ({ ...f, phone: v }))}>
                <SelectTrigger><SelectValue placeholder="Escolha um número cadastrado" /></SelectTrigger>
                <SelectContent>
                  {testNumbers.map(n => (
                    <SelectItem key={n.id} value={n.phoneNumber}>
                      {n.phoneNumber}{n.label ? ` — ${n.label}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {testNumbers.length === 0 && (
                <p className="text-xs text-amber-600">
                  Nenhum número cadastrado. Volte e use “Números de teste”.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Título da mensagem <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input value={sendForm.headerText} maxLength={60} placeholder="Preview ⚡ Lesson 04"
                onChange={e => setSendForm(f => ({ ...f, headerText: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem que abre a aula</Label>
              <Textarea rows={3} value={sendForm.bodyText} maxLength={1024}
                placeholder="Sua aula de hoje chegou! Leva uns 4 minutos."
                onChange={e => setSendForm(f => ({ ...f, bodyText: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Rodapé <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input value={sendForm.footerText} maxLength={60}
                  onChange={e => setSendForm(f => ({ ...f, footerText: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Texto do botão <span className="text-muted-foreground text-xs">(até 20)</span></Label>
                <Input value={sendForm.buttonText} maxLength={20}
                  onChange={e => setSendForm(f => ({ ...f, buttonText: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSend(false)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={sending || !sendForm.phone}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TestNumbersDialog
        open={showNumbers} onOpenChange={setShowNumbers}
        numbers={testNumbers} form={numberForm} setForm={setNumberForm}
        onAdd={handleAddNumber} onRemove={handleRemoveNumber}
      />
    </div>
  )
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

function NewFlowDialog({
  open, onOpenChange, name, setName, saving, onCreate,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  name: string; setName: (v: string) => void
  saving: boolean; onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova aula</DialogTitle>
          <DialogDescription>
            Começa com uma capa e um encerramento. Você adiciona as telas depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Nome da aula</Label>
          <Input value={name} maxLength={255} placeholder="Preview ⚡ Lesson 04"
            onChange={e => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onCreate} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TestNumbersDialog({
  open, onOpenChange, numbers, form, setForm, onAdd, onRemove,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  numbers: TestNumber[]
  form: { phoneNumber: string; label: string }
  setForm: (v: { phoneNumber: string; label: string }) => void
  onAdd: () => void; onRemove: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Números de teste</DialogTitle>
          <DialogDescription>
            O Studio só envia para números desta lista. É a trava que evita disparo
            acidental para um aluno real.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input placeholder="5541999999999" value={form.phoneNumber}
            onChange={e => setForm({ ...form, phoneNumber: e.target.value })} />
          <Input placeholder="Quem é (opcional)" value={form.label}
            onChange={e => setForm({ ...form, label: e.target.value })} />
          <Button onClick={onAdd} className="shrink-0"><Plus className="h-4 w-4" /></Button>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {numbers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum número cadastrado
            </p>
          ) : numbers.map(n => (
            <div key={n.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <div className="font-mono text-sm">{n.phoneNumber}</div>
                {n.label && <div className="text-xs text-muted-foreground">{n.label}</div>}
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                onClick={() => onRemove(n.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
