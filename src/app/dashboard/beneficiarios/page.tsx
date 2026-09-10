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
  UserPlus, Loader2, Upload, RefreshCw, Building2, AlertCircle, Info, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, handleUnauthorized } from '@/lib/api'
import { maskCpf, maskDate } from '@/lib/masks'

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

interface UploadResult {
  queuedRows: number
  chunks: number
  invalidRows: Array<{ line: number; reason: string }>
}

const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback

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

// ─── Página ──────────────────────────────────────────────────────────────────

function BeneficiariosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const contractIdParam = searchParams?.get('contractId') ?? null

  const [contracts, setContracts] = useState<MyContract[] | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  // inclusão individual
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [adding, setAdding] = useState(false)

  // upload
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

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

  useEffect(() => {
    // Sem `slots` o contrato não está mapeado no StormBot, e /my/batches responderia 409
    // pelo mesmo motivo — a tela já explica isso num alerta. Buscar assim mesmo só
    // produziria um toast de erro por cima da explicação.
    if (selected?.slots) loadBatches(selected.id)
  }, [selected, loadBatches])

  /** Recarrega contratos (slots) e lotes após um envio. */
  async function refresh(contractId: string) {
    await Promise.all([loadContracts(), loadBatches(contractId)])
  }

  async function addOne() {
    if (!selected) return
    if (!cpf.trim() || !birthDate.trim()) {
      toast.error('Preencha o CPF e a data de nascimento.')
      return
    }
    setAdding(true)
    try {
      await api.post('/api/affinity/my/beneficiaries', {
        contractId: selected.id,
        cpf,
        birthDate,
      })
      toast.success('Beneficiário enviado. O convite chega por WhatsApp em alguns minutos.')
      setCpf(''); setBirthDate('')
      // A réplica leva alguns segundos até refletir o novo pendente.
      setTimeout(() => refresh(selected.id), 4000)
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível incluir o beneficiário.'))
    } finally {
      setAdding(false)
    }
  }

  async function uploadCsv() {
    if (!selected || !file) {
      toast.error('Escolha o arquivo CSV.')
      return
    }
    setUploading(true)
    setUploadResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('contractId', selected.id)
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
      if (!res.ok) throw { response: { data } }

      setUploadResult(data)
      toast.success(`${data.queuedRows} beneficiário(s) enviado(s).`)
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
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Inclusão individual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incluir um beneficiário</CardTitle>
              <CardDescription>
                Ele recebe o convite por WhatsApp e ativa o curso sozinho.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="ben-cpf">CPF</Label>
                <Input
                  id="ben-cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  disabled={!canAdd}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ben-nasc">Data de nascimento</Label>
                <Input
                  id="ben-nasc"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="DD/MM/AAAA"
                  value={birthDate}
                  onChange={(e) => setBirthDate(maskDate(e.target.value))}
                  disabled={!canAdd}
                />
              </div>
              <Button onClick={addOne} disabled={adding || !canAdd} className="w-full">
                {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Incluir
              </Button>
              {slots.available === 0 && !outOfTerm && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sem vagas livres. Fale com a Storm para ampliar o contrato.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upload de lista */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enviar uma lista</CardTitle>
              <CardDescription>
                Arquivo CSV com uma pessoa por linha, no formato{' '}
                <code className="rounded bg-muted px-1">cpf;dataNascimento</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="ben-file">Arquivo CSV</Label>
                <Input
                  id="ben-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={!canAdd}
                />
              </div>
              <Button onClick={uploadCsv} disabled={uploading || !canAdd || !file} className="w-full">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Enviar lista
              </Button>
              <p className="text-xs text-muted-foreground">
                O arquivo é recusado por inteiro se tiver mais pessoas do que vagas —
                assim ninguém fica de fora sem você saber.
              </p>
              {uploadResult && (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <p><span className="font-medium">{uploadResult.queuedRows}</span> enviado(s), aguardando processamento.</p>
                  {uploadResult.invalidRows.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-amber-600 dark:text-amber-400">
                        {uploadResult.invalidRows.length} linha(s) ignorada(s)
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
        </div>
      )}

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
