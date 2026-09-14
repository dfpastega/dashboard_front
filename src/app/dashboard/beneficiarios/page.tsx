'use client'

/**
 * Painel de beneficiários — o autoatendimento do contratante de afinidade.
 *
 * Tudo aqui sai de /api/affinity/my/*, que deriva o contrato da sessão. A tela nunca
 * calcula permissão: `canWrite` vem do backend, e esconder o formulário é só cortesia —
 * quem burlar recebe 403.
 *
 * A lista de elegíveis existe apenas como HMAC: depois de enviada, ninguém consegue
 * relê-la, nem a Storm. Por isso a tela mostra CONTAGENS, não nomes, e diz isso em voz
 * alta — o gestor precisa saber disso antes de enviar, não depois de procurar a lista.
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  UserPlus, Loader2, Upload, RefreshCw, Building2, AlertCircle, Info, Eye, EyeOff,
  ShieldOff, Search, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, handleUnauthorized } from '@/lib/api'
import { maskCpf, maskDate } from '@/lib/masks'
import { cn } from '@/lib/utils'

// ─── Tipos (respostas de /api/affinity/my) ───────────────────────────────────

interface Slots {
  contractId: number
  customerName: string
  contractedSlots: number
  usedSlots: number
  pending: number
  activated: number
  revoked: number
  available: number
  expired: boolean
  notStarted: boolean
  startDate: string
  endDate: string
}

interface MyContract {
  id: string
  name: string
  stormbotContractId: number | null
  isPrimary: boolean
  canWrite: boolean
  slots: Slots | null
}

interface Batch {
  batchId: number
  externalId: string
  totalRows: number
  receivedRows: number
  status: string
  createdAt: string
  eligibles: string
  createdByEmail: string | null
  source: string | null
}

interface InvalidRow { line: number; reason: string }

interface UploadResult {
  queuedRows: number
  chunks: number
  invalidRows: InvalidRow[]
}

type UploadMode = 'append' | 'replace'

/** Diagnóstico devolvido em `needs_confirmation`. */
interface UploadPreview {
  mode: UploadMode
  validRows: number
  invalidRows: InvalidRow[]
  totalRows: number
  /** Cabeçalhos que o servidor reconheceu; null quando o arquivo é posicional. */
  detected: { cpf: string | null; birthDate: string | null }
  /** Só no modo substituir: o que muda na lista do contrato. */
  diff?: {
    manter: number
    incluir: number
    remover: {
      total: number
      pendentes: number
      /** Ativados que perdem o acesso — os únicos que este modelo consegue nomear. */
      ativados: Array<{ studentId: number; name: string }>
    }
  }
  /** Remoção grande demais para passar sem um segundo olhar. */
  alertaRemocaoAlta?: boolean
}

interface Activated {
  studentId: number
  name: string
  email: string
  whatsappId: string
  statusId: number
  registrationDate: string | null
  lastAccessDate: string | null
  activatedAt: string
  hash: string
}

interface LookupResult {
  status: 'pending' | 'activated' | 'revoked' | 'not_found'
  activatedAt?: string | null
  revokedAt?: string | null
  canRevoke?: boolean
}

/** Alvo de uma revogação — por linha do roster ou por CPF consultado. */
interface RevokeTarget {
  label: string
  payload: { studentId: number } | { cpf: string; birthDate: string }
}

/**
 * Mensagem para o gestor.
 *
 * Em 4xx o backend está explicando algo que ele pode resolver — sem vagas, fora da
 * vigência, CPF inválido, acesso somente leitura — e nenhuma mensagem genérica daqui é
 * melhor que aquela. Em 5xx a falha é nossa, e repassar "Erro interno." não diz o que
 * fazer; o fallback da ação ("Não foi possível revogar") ao menos diz o que não aconteceu.
 */
const apiError = (err: unknown, fallback: string) => {
  const res = (err as { response?: { status?: number; data?: { error?: string } } })?.response
  const status = res?.status ?? 0
  return status >= 400 && status < 500 ? res?.data?.error ?? fallback : fallback
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ingesting: 'bg-amber-500/15 text-amber-600',
    complete: 'bg-emerald-500/15 text-emerald-600',
    failed: 'bg-red-500/15 text-red-600',
  }
  return <Badge className={map[status] ?? ''} variant="outline">{status}</Badge>
}

// ─── Barra de consumo de slots ───────────────────────────────────────────────

function SlotsCard({ slots }: { slots: Slots }) {
  const total = Math.max(slots.contractedSlots, 1)
  const pct = (n: number) => `${Math.min(100, (n / total) * 100)}%`

  const tiles = [
    { label: 'em uso',      value: slots.usedSlots, className: 'text-foreground' },
    { label: 'aguardando',  value: slots.pending,   className: 'text-amber-600 dark:text-amber-400' },
    { label: 'ativados',    value: slots.activated, className: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'disponíveis', value: slots.available, className: 'text-primary' },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{slots.customerName}</CardTitle>
        <CardDescription>
          Vigência {new Date(slots.startDate).toLocaleDateString('pt-BR')} — {new Date(slots.endDate).toLocaleDateString('pt-BR')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-2xl font-semibold tabular-nums">
              {slots.usedSlots + slots.pending}
              <span className="text-base font-normal text-muted-foreground">/{slots.contractedSlots}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              {slots.available} {slots.available === 1 ? 'vaga livre' : 'vagas livres'}
            </span>
          </div>
          {/* Duas faixas: o que já consome slot e o que vai consumir ao ativar. */}
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img"
               aria-label={`${slots.usedSlots} em uso, ${slots.pending} aguardando, de ${slots.contractedSlots} contratados`}>
            <div className="bg-primary" style={{ width: pct(slots.usedSlots) }} />
            <div className="bg-amber-400 dark:bg-amber-500" style={{ width: pct(slots.pending) }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-md border p-2 text-center">
              <p className={`text-lg font-semibold tabular-nums ${t.className}`}>{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>

        {slots.revoked > 0 && (
          <p className="text-xs text-muted-foreground">
            {slots.revoked} revogado(s) — as vagas voltaram para o contrato.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Revogação ───────────────────────────────────────────────────────────────

/**
 * Confirmação com motivo obrigatório.
 *
 * Revogar corta o acesso de uma pessoa real ao curso e devolve a vaga ao contrato. Não é
 * desfazível de dentro da tela: para voltar atrás é preciso incluir de novo, e quem já
 * tinha ativado perde o histórico do vínculo. Daí o motivo obrigatório — ele vai para a
 * auditoria e é o que responde "por que este acesso foi tirado" seis meses depois.
 */
function RevokeDialog({ target, onClose, onConfirm }: {
  target: RevokeTarget | null
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (target) setReason('') }, [target])

  async function confirm() {
    if (!reason.trim()) { toast.error('Informe o motivo da revogação.'); return }
    setSaving(true)
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch {
      // O erro já virou toast em quem chamou. O diálogo fica aberto de propósito: o
      // motivo digitado não se perde e o gestor pode tentar de novo.
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4" />
            Revogar benefício
          </DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{target?.label}</strong> perde o acesso ao
            curso e a vaga volta para o contrato. Para reverter é preciso incluir a pessoa
            de novo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="revoke-reason">Motivo</Label>
          <Textarea
            id="revoke-reason"
            rows={3}
            placeholder="Ex.: desligamento da empresa"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 400))}
          />
          <p className="text-xs text-muted-foreground">
            Fica registrado junto de quem pediu e quando.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="destructive" onClick={confirm} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Revogar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Consulta de um beneficiário ─────────────────────────────────────────────

const LOOKUP_LABEL: Record<LookupResult['status'], { text: string; className: string }> = {
  pending:   { text: 'Convidado, ainda não ativou', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  activated: { text: 'Ativou o benefício',          className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  revoked:   { text: 'Benefício revogado',          className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  not_found: { text: 'Não está na lista',           className: 'bg-muted text-muted-foreground' },
}

function LookupCard({ canWrite, onLookup, onRevoke }: {
  canWrite: boolean
  onLookup: (cpf: string, birthDate: string) => Promise<LookupResult | null>
  onRevoke: (t: RevokeTarget) => void
}) {
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)

  async function search() {
    if (!cpf.trim() || !birthDate.trim()) {
      toast.error('Preencha o CPF e a data de nascimento.')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      setResult(await onLookup(cpf, birthDate))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consultar um beneficiário</CardTitle>
        <CardDescription>
          Como a lista enviada não pode ser lida de volta, é assim que se descobre a
          situação de quem ainda não ativou.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="lk-cpf">CPF</Label>
            <Input id="lk-cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                   value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lk-nasc">Data de nascimento</Label>
            <Input id="lk-nasc" inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA"
                   value={birthDate} onChange={(e) => setBirthDate(maskDate(e.target.value))} />
          </div>
        </div>
        <Button variant="outline" onClick={search} disabled={loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Consultar
        </Button>

        {result && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <Badge variant="outline" className={LOOKUP_LABEL[result.status].className}>
              {LOOKUP_LABEL[result.status].text}
            </Badge>
            {result.activatedAt && (
              <span className="text-xs text-muted-foreground">
                em {new Date(result.activatedAt).toLocaleDateString('pt-BR')}
              </span>
            )}
            {/* Revogar daqui só faz sentido para quem NÃO aparece no roster: os ativados
                têm o botão na própria linha, com nome à vista. */}
            {canWrite && result.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 text-destructive hover:text-destructive"
                onClick={() => onRevoke({ label: `CPF ${cpf}`, payload: { cpf, birthDate } })}
              >
                <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                Revogar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Confirmação de envio parcial ────────────────────────────────────────────

/**
 * Mostra o que entra e o que fica de fora, e deixa o gestor decidir.
 *
 * O alternativo seria recusar o arquivo inteiro, obrigando a corrigir a planilha antes de
 * qualquer envio. Numa lista de 100 com 20 problemas, isso trava 80 pessoas por causa de
 * 20 — e o gestor frequentemente não tem como corrigir (o dado não existe no RH dele).
 *
 * As linhas recusadas vêm numeradas como no arquivo original, então dá para conferir.
 */
function ConfirmUploadDialog({ preview, fileName, sending, onCancel, onConfirm }: {
  preview: UploadPreview | null
  fileName: string | null
  sending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [cienteRemocao, setCienteRemocao] = useState(false)

  useEffect(() => { setCienteRemocao(false) }, [preview])

  if (!preview) return null

  const diff = preview.diff
  const ehSubstituicao = preview.mode === 'replace'

  // Agrupa por motivo: "10× CPF inválido" diz mais que 10 linhas soltas.
  const porMotivo = preview.invalidRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.reason] = (acc[r.reason] ?? 0) + 1
    return acc
  }, {})

  const precisaCiencia = !!preview.alertaRemocaoAlta
  const podeConfirmar = !precisaCiencia || cienteRemocao

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !sending) onCancel() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ehSubstituicao ? 'Confirmar a nova lista do contrato' : 'Algumas linhas não podem ser enviadas'}
          </DialogTitle>
          <DialogDescription>
            Li <strong className="text-foreground">{preview.totalRows}</strong> linha(s) em{' '}
            <span className="font-medium">{fileName}</span>.
            {preview.detected.cpf && (
              <> Usei as colunas <code className="rounded bg-muted px-1">{preview.detected.cpf}</code> e{' '}
              <code className="rounded bg-muted px-1">{preview.detected.birthDate}</code>.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ── modo substituir: o que muda na lista ── */}
        {ehSubstituicao && diff && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold tabular-nums">{diff.manter}</p>
                <p className="text-xs text-muted-foreground">permanecem</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {diff.incluir}
                </p>
                <p className="text-xs text-muted-foreground">entram</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {diff.remover.total}
                </p>
                <p className="text-xs text-muted-foreground">saem</p>
              </div>
            </div>

            {diff.remover.total > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Quem sai do contrato</p>

                {diff.remover.ativados.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      {diff.remover.ativados.length} já {diff.remover.ativados.length === 1 ? 'estuda' : 'estudam'} e {diff.remover.ativados.length === 1 ? 'perde' : 'perdem'} o acesso
                    </p>
                    <ul className="mt-1.5 max-h-36 overflow-y-auto text-sm text-red-700 dark:text-red-300">
                      {diff.remover.ativados.map((a) => <li key={a.studentId}>{a.name}</li>)}
                    </ul>
                  </div>
                )}

                {diff.remover.pendentes > 0 && (
                  <p className="text-sm text-muted-foreground">
                    + {diff.remover.pendentes} convidado(s) que ainda não {diff.remover.pendentes === 1 ? 'ativou' : 'ativaram'}.
                    Não é possível listar os nomes: quem não ativou existe só como marca embaralhada.
                  </p>
                )}
              </div>
            )}

            {precisaCiencia && (
              <label className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={cienteRemocao}
                  onChange={(e) => setCienteRemocao(e.target.checked)}
                />
                <span className="text-amber-800 dark:text-amber-200">
                  Esta lista remove boa parte do contrato. Se a planilha veio filtrada ou
                  incompleta, o resultado é desligamento em massa. Confirmo que a lista está
                  completa.
                </span>
              </label>
            )}
          </>
        )}

        {/* ── linhas recusadas, nos dois modos ── */}
        {preview.invalidRows.length > 0 && (
          <div className="space-y-2">
            {!ehSubstituicao && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {preview.validRows}
                  </p>
                  <p className="text-xs text-muted-foreground">serão enviados</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {preview.invalidRows.length}
                  </p>
                  <p className="text-xs text-muted-foreground">ficam de fora</p>
                </div>
              </div>
            )}
            <p className="text-sm font-medium">
              {preview.invalidRows.length} linha(s) do arquivo ficaram de fora
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {Object.entries(porMotivo).map(([motivo, n]) => (
                <li key={motivo} className="flex gap-2">
                  <span className="tabular-nums font-medium text-foreground">{n}×</span>
                  {motivo}
                </li>
              ))}
            </ul>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Ver as linhas</summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-muted-foreground">
                {preview.invalidRows.map((r) => (
                  <li key={r.line}>linha {r.line}: {r.reason}</li>
                ))}
              </ul>
            </details>
            {ehSubstituicao && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Atenção: linhas recusadas não entram na lista nova. Se alguma delas é de quem
                deveria permanecer, essa pessoa sai do contrato.
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Quem ficar de fora pode entrar depois: corrija a planilha e envie de novo.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={sending}>Cancelar</Button>
          <Button
            onClick={onConfirm}
            disabled={sending || !podeConfirmar}
            variant={ehSubstituicao && (diff?.remover.total ?? 0) > 0 ? 'destructive' : 'default'}
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ehSubstituicao
              ? `Aplicar${diff ? ` (${diff.remover.total} saem)` : ''}`
              : `Enviar ${preview.validRows}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


// ─── Página ──────────────────────────────────────────────────────────────────

function BeneficiariosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const contractIdParam = searchParams?.get('contractId') ?? null

  const [contracts, setContracts] = useState<MyContract[] | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  // upload
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const [mode, setMode] = useState<UploadMode>('append')
  /** Resposta `needs_confirmation`: o arquivo tem linhas recusadas e o gestor decide. */
  const [pendingConfirm, setPendingConfirm] = useState<UploadPreview | null>(null)

  // roster de ativados
  const [activated, setActivated] = useState<Activated[]>([])
  const [loadingActivated, setLoadingActivated] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null)

  const loadContracts = useCallback(async () => {
    try {
      const { data } = await api.get<MyContract[]>('/api/affinity/my/contracts')
      setContracts(data)
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível carregar seus contratos.'))
      setContracts([])
    }
  }, [])

  useEffect(() => { loadContracts() }, [loadContracts])

  // Com um contrato só, não faz sentido pedir escolha.
  const selected = contracts?.length === 1
    ? contracts[0]
    : contracts?.find((c) => c.id === contractIdParam) ?? null

  const needsSelection = !!contracts && contracts.length > 1 && !selected

  const loadBatches = useCallback(async (contractId: string) => {
    setLoadingBatches(true)
    try {
      const { data } = await api.get<Batch[]>(`/api/affinity/my/batches?contractId=${encodeURIComponent(contractId)}`)
      setBatches(data)
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível carregar os envios.'))
    } finally {
      setLoadingBatches(false)
    }
  }, [])

  const loadActivated = useCallback(async (contractId: string, reveal = false) => {
    setLoadingActivated(true)
    try {
      const { data } = await api.get<Activated[]>(
        `/api/affinity/my/activated?contractId=${encodeURIComponent(contractId)}${reveal ? '&reveal=1' : ''}`
      )
      setActivated(data)
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível carregar os beneficiários ativos.'))
    } finally {
      setLoadingActivated(false)
    }
  }, [])

  useEffect(() => {
    // Sem `slots` o contrato não está mapeado no StormBot, e as demais rotas responderiam
    // 409 pelo mesmo motivo — a tela já explica isso num alerta. Buscar assim mesmo só
    // produziria toasts de erro por cima da explicação.
    if (!selected?.slots) return
    loadBatches(selected.id)
    // Troca de contrato volta ao estado mascarado: revelar é uma decisão por contrato.
    setRevealed(false)
    loadActivated(selected.id)
  }, [selected, loadBatches, loadActivated])

  /** Recarrega contratos (slots), lotes e roster após uma ação. */
  async function refresh(contractId: string) {
    await Promise.all([
      loadContracts(),
      loadBatches(contractId),
      loadActivated(contractId, revealed),
    ])
  }

  async function toggleReveal() {
    if (!selected) return
    const next = !revealed
    setRevealed(next)
    await loadActivated(selected.id, next)
  }

  async function lookup(cpf: string, birthDate: string): Promise<LookupResult | null> {
    if (!selected) return null
    try {
      const { data } = await api.post<LookupResult>('/api/affinity/my/beneficiaries/lookup', {
        contractId: selected.id, cpf, birthDate,
      })
      return data
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível consultar.'))
      return null
    }
  }

  async function revoke(reason: string) {
    if (!selected || !revokeTarget) return
    try {
      await api.post('/api/affinity/my/beneficiaries/revoke', {
        contractId: selected.id, reason, ...revokeTarget.payload,
      })
      toast.success('Revogação enviada. A vaga volta para o contrato em alguns instantes.')
      setTimeout(() => refresh(selected.id), 4000)
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível revogar.'))
      throw err // mantém o diálogo aberto para o gestor ver o erro
    }
  }

  async function uploadCsv(confirm = false) {
    if (!selected || !file) {
      toast.error('Escolha a planilha.')
      return
    }
    setUploading(true)
    if (!confirm) setUploadResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('contractId', selected.id)
      // O arquivo sobe de novo na confirmação. São poucos KB, e guardar o parse numa
      // sessão intermediária custaria mais do que reprocessar.
      form.append('confirm', confirm ? 'true' : 'false')
      form.append('mode', mode)
      // fetch puro: o browser define o Content-Type multipart COM boundary
      // (o axios da instância forçaria application/json e quebraria o multer).
      const res = await fetch(`${api.defaults.baseURL}/api/affinity/my/batches`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      // fetch puro não passa pelo interceptor da api: tratar sessão expirada aqui.
      if (res.status === 401) { handleUnauthorized(); return }
      const data = await res.json()
      if (!res.ok) throw { response: { status: res.status, data } }

      // O servidor achou linhas com problema e devolveu o diagnóstico sem enfileirar.
      if (data.status === 'needs_confirmation') {
        setPendingConfirm(data)
        return
      }

      setPendingConfirm(null)
      setUploadResult(data)
      toast.success(
        data.mode === 'replace'
          ? `Lista sincronizada: ${data.keptRows} mantido(s), ${data.queuedRows} novo(s), ${data.removedRows} removido(s).`
          : `${data.queuedRows} beneficiário(s) enviado(s).`
      )
      setFile(null)
      setTimeout(() => refresh(selected.id), 4000)
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível enviar o arquivo.'))
    } finally {
      setUploading(false)
    }
  }

  // ── Estados de carregamento / vazio ────────────────────────────────────────

  if (!contracts) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (contracts.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Nenhum contrato de afinidade</AlertTitle>
        <AlertDescription>
          Sua conta não está vinculada a um contrato com benefício de afinidade.
          Fale com o administrador da Storm.
        </AlertDescription>
      </Alert>
    )
  }

  if (needsSelection) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Selecione um contrato
            </CardTitle>
            <CardDescription>Escolha de qual contrato quer gerenciar os beneficiários</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {contracts.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => router.push(`/dashboard/beneficiarios?contractId=${encodeURIComponent(c.id)}`)}
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left truncate">{c.name}</span>
                {c.slots && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.slots.available} livres
                  </span>
                )}
                {c.isPrimary && <span className="text-xs text-muted-foreground">principal</span>}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!selected) return null

  // Contrato existe no dashboard mas não tem vínculo com o StormBot: sem isso não há
  // onde buscar slots nem elegíveis. É ação da Storm, não do cliente.
  if (!selected.slots) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Contrato ainda não liberado</AlertTitle>
        <AlertDescription>
          O contrato <strong>{selected.name}</strong> ainda não está vinculado à base do
          StormBot, então não é possível consultar vagas nem incluir beneficiários.
          Fale com o suporte da Storm.
        </AlertDescription>
      </Alert>
    )
  }

  const slots = selected.slots
  const outOfTerm = slots.expired || slots.notStarted
  const canAdd = selected.canWrite && !outOfTerm && slots.available > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserPlus className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Beneficiários</h1>
            <p className="text-sm text-muted-foreground">
              Quem da sua base pode ativar o curso pelo WhatsApp.
            </p>
          </div>
        </div>
        {contracts.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/beneficiarios')}>
            <Building2 className="mr-2 h-3.5 w-3.5" />
            Trocar contrato
          </Button>
        )}
      </div>

      {outOfTerm && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{slots.expired ? 'Vigência encerrada' : 'Vigência ainda não começou'}</AlertTitle>
          <AlertDescription>
            {slots.expired
              ? 'Este contrato terminou e não aceita novos beneficiários.'
              : `A vigência começa em ${new Date(slots.startDate).toLocaleDateString('pt-BR')}.`}
          </AlertDescription>
        </Alert>
      )}

      {!selected.canWrite && (
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertTitle>Acesso somente leitura</AlertTitle>
          <AlertDescription>
            Você acompanha o consumo deste contrato, mas não pode incluir beneficiários.
            Peça a um gestor do contrato.
          </AlertDescription>
        </Alert>
      )}

      <SlotsCard slots={slots} />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>A lista enviada não pode ser consultada depois</AlertTitle>
        <AlertDescription>
          Por proteção dos dados, guardamos apenas uma marca embaralhada de cada CPF —
          nem a Storm consegue reconstruir a lista. Você acompanha pelos números acima, e
          quem ativar o benefício aparece na sua base de alunos. Guarde o arquivo enviado
          se precisar conferir depois.
        </AlertDescription>
      </Alert>

      {selected.canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enviar a lista de beneficiários</CardTitle>
            <CardDescription>
              Planilha Excel ou CSV. Basta ter uma coluna de <strong>CPF</strong> e outra de{' '}
              <strong>data de nascimento</strong> — as demais colunas são ignoradas, então
              dá para enviar o arquivo do RH como ele é.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* O significado do envio não dá para inferir do arquivo: uma planilha de 10
                linhas tanto pode ser "10 contratados novos" quanto "sobraram 10 pessoas".
                Por isso a escolha é explícita, e cada opção diz o que faz. */}
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { v: 'append'  as UploadMode, t: 'Acrescentar à lista',
                  d: 'Adiciona quem está na planilha. Ninguém perde o acesso.' },
                { v: 'replace' as UploadMode, t: 'Substituir a lista',
                  d: 'A planilha passa a ser a lista vigente. Quem não estiver nela sai do contrato.' },
              ]).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => { setMode(o.v); setUploadResult(null) }}
                  disabled={!canAdd}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    mode === o.v
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50',
                    !canAdd && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span className="flex items-center gap-2 font-medium text-sm">
                    <span className={cn(
                      'inline-block h-3 w-3 rounded-full border-2',
                      mode === o.v ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    )} />
                    {o.t}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{o.d}</span>
                </button>
              ))}
            </div>

            {/* Área de arrastar-e-soltar. O input fica escondido atrás do label: clicar em
                qualquer ponto da área abre o seletor, e o teclado alcança o input. */}
            <label
              htmlFor="ben-file"
              onDragOver={(e) => { e.preventDefault(); if (canAdd) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                if (!canAdd) return
                const f = e.dataTransfer.files?.[0]
                if (f) { setFile(f); setUploadResult(null) }
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
                canAdd ? 'cursor-pointer hover:border-primary/60 hover:bg-muted/40' : 'cursor-not-allowed opacity-60',
                dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
              )}
            >
              <Upload className={cn('h-7 w-7', dragging ? 'text-primary' : 'text-muted-foreground')} />
              {file ? (
                <>
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB · clique para trocar
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium">
                    Arraste a planilha aqui ou <span className="text-primary underline">clique para escolher</span>
                  </span>
                  <span className="text-xs text-muted-foreground">.xlsx, .xls ou .csv — até 5 MB</span>
                </>
              )}
              <input
                id="ben-file"
                type="file"
                className="sr-only"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                disabled={!canAdd}
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUploadResult(null) }}
              />
            </label>

            <Button onClick={() => uploadCsv()} disabled={uploading || !canAdd || !file} className="w-full">
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Enviar lista
            </Button>

            <p className="text-xs text-muted-foreground">
              Linhas sem CPF ou data válidos são apontadas antes do envio, para você decidir
              se segue sem elas. O arquivo é recusado por inteiro se tiver mais pessoas do
              que vagas — assim ninguém fica de fora sem você saber.
            </p>

            {slots.available === 0 && !outOfTerm && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Sem vagas livres. Fale com a Storm para ampliar o contrato.
              </p>
            )}

            {uploadResult && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p><span className="font-medium">{uploadResult.queuedRows}</span> enviado(s), aguardando processamento.</p>
                {uploadResult.invalidRows.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-amber-600 dark:text-amber-400">
                      {uploadResult.invalidRows.length} linha(s) ficaram de fora
                    </summary>
                    <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-muted-foreground">
                      {uploadResult.invalidRows.map((r) => (
                        <li key={r.line}>linha {r.line}: {r.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Beneficiários que ativaram — a única lista de pessoas que este modelo produz */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Beneficiários ativos
            </CardTitle>
            <CardDescription>
              Quem já ativou e está usando o curso. Quem ainda não ativou aparece só na
              contagem de &ldquo;aguardando&rdquo;.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activated.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleReveal} disabled={loadingActivated}>
                {revealed ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                {revealed ? 'Ocultar contatos' : 'Mostrar contatos'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => loadActivated(selected.id, revealed)} disabled={loadingActivated}>
              {loadingActivated ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="sr-only">Atualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Ativou em</TableHead>
                  <TableHead>Último acesso</TableHead>
                  {selected.canWrite && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={selected.canWrite ? 5 : 4} className="text-center text-muted-foreground">
                      Ninguém ativou o benefício ainda.
                    </TableCell>
                  </TableRow>
                )}
                {activated.map((a) => (
                  <TableRow key={a.studentId}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="whitespace-nowrap">{a.email}</div>
                      <div className="whitespace-nowrap">{a.whatsappId}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {a.activatedAt ? new Date(a.activatedAt).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {a.lastAccessDate ? new Date(a.lastAccessDate).toLocaleDateString('pt-BR') : 'nunca'}
                    </TableCell>
                    {selected.canWrite && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => setRevokeTarget({ label: a.name, payload: { studentId: a.studentId } })}
                        >
                          <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                          Revogar
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {activated.length > 0 && !revealed && (
            <p className="mt-3 text-xs text-muted-foreground">
              Contatos abreviados. Foram informados pela própria pessoa ao ativar — use
              &ldquo;Mostrar contatos&rdquo; só quando precisar falar com ela.
            </p>
          )}
        </CardContent>
      </Card>

      <LookupCard canWrite={selected.canWrite} onLookup={lookup} onRevoke={setRevokeTarget} />

      <RevokeDialog
        target={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revoke}
      />

      <ConfirmUploadDialog
        preview={pendingConfirm}
        fileName={file?.name ?? null}
        sending={uploading}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => uploadCsv(true)}
      />

      {/* Histórico de envios */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Envios</CardTitle>
            <CardDescription>Pode levar alguns segundos até um envio aparecer aqui.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadBatches(selected.id)} disabled={loadingBatches}>
            {loadingBatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Atualizar</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Pessoas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum envio ainda.
                    </TableCell>
                  </TableRow>
                )}
                {batches.map((b) => (
                  <TableRow key={b.batchId}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleString('pt-BR')}
                    </TableCell>
                    {/* Lote anterior à auditoria não tem autor — não inventar um. */}
                    <TableCell className="text-sm">{b.createdByEmail ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {b.source === 'csv' ? 'Lista' : b.source === 'single' ? 'Individual' : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{b.receivedRows}/{b.totalRows}</TableCell>
                    <TableCell>{statusBadge(b.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function BeneficiariosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <BeneficiariosContent />
    </Suspense>
  )
}
