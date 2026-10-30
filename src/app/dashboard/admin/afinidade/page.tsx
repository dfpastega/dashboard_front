'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Handshake, Loader2, Upload, RefreshCw, ShieldOff, ExternalLink, AlertTriangle,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api, handleUnauthorized } from '@/lib/api'
import { maskCpf, maskDate } from '@/lib/masks'

// ─── Tipos (respostas do backend /api/affinity) ──────────────────────────────

interface Batch {
  batchId: number
  externalId: string
  contractId: number
  totalRows: number
  receivedRows: number
  status: string
  createdAt: string
  eligibles: string
}

/** Contagens de um contrato — a mesma forma que o painel do contratante consome. */
interface Slots {
  contractId: number
  customerName: string
  contractedSlots: number
  usedSlots: number
  startDate: string
  endDate: string
  pending: number
  activated: number
  revoked: number
  available: number
  expired: boolean
  notStarted: boolean
}

/** Uma linha de GET /api/affinity/contracts. */
interface ContratoAfinidade {
  /** Id no dashboard — é o que vai na URL do painel do contratante. */
  id: string
  name: string
  /** Null = contrato vendido mas não mapeado no StormBot; não funciona. */
  stormbotContractId: number | null
  linkedUsers: number
  lastBatchAt: string | null
  slots: Slots | null
}

interface UploadResult {
  batchExternalId: string
  validRows: number
  chunks: number
  invalidRows: Array<{ line: number; reason: string }>
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ingesting: 'bg-amber-500/15 text-amber-600',
    complete: 'bg-emerald-500/15 text-emerald-600',
    failed: 'bg-red-500/15 text-red-600',
  }
  return <Badge className={map[status] ?? ''} variant="outline">{status}</Badge>
}

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

/**
 * Estado da vigência em uma palavra.
 *
 * Fora da vigência o worker recusa ativação mesmo com vaga livre, então um contrato
 * encerrado com 40 vagas livres não é um contrato com 40 vagas livres — e a tabela
 * precisa dizer isso antes que alguém mande lista para ele.
 */
function selo(slots: Slots) {
  if (slots.expired) return <Badge variant="outline" className="bg-red-500/15 text-red-600">encerrado</Badge>
  if (slots.notStarted) return <Badge variant="outline" className="bg-amber-500/15 text-amber-600">não iniciado</Badge>
  return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600">vigente</Badge>
}

/** Consumo do contrato: o que já ocupa vaga e o que vai ocupar ao ativar. */
function BarraVagas({ slots }: { slots: Slots }) {
  const total = Math.max(slots.contractedSlots, 1)
  const pct = (n: number) => `${Math.min(100, (n / total) * 100)}%`

  return (
    <div className="min-w-[9rem] space-y-1">
      <p className="text-sm tabular-nums">
        {slots.usedSlots + slots.pending}
        <span className="text-muted-foreground">/{slots.contractedSlots}</span>
        <span className="ml-2 text-xs text-muted-foreground">{slots.available} livres</span>
      </p>
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${slots.usedSlots} em uso e ${slots.pending} aguardando, de ${slots.contractedSlots} contratados`}
      >
        <div className="bg-primary" style={{ width: pct(slots.usedSlots) }} />
        <div className="bg-amber-400 dark:bg-amber-500" style={{ width: pct(slots.pending) }} />
      </div>
    </div>
  )
}

export default function AfinidadePage() {
  // carteira de afinidade
  const [contratos, setContratos] = useState<ContratoAfinidade[] | null>(null)
  const [loadingContratos, setLoadingContratos] = useState(false)

  // upload
  const [uploadContractId, setUploadContractId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  // lotes
  const [batches, setBatches] = useState<Batch[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  // revogação por hash (relatórios de reconciliação, onde só existe o hash)
  const [revokeHash, setRevokeHash] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)

  // revogação por pessoa (o caso comum do suporte: "tire o benefício do CPF X")
  const [pCpf, setPCpf] = useState('')
  const [pBirth, setPBirth] = useState('')
  const [pReason, setPReason] = useState('')
  const [pRevoking, setPRevoking] = useState(false)

  const loadContratos = useCallback(async () => {
    setLoadingContratos(true)
    try {
      const { data } = await api.get<ContratoAfinidade[]>('/api/affinity/contracts')
      setContratos(data)
    } catch {
      toast.error('Falha ao carregar os contratos de afinidade.')
      setContratos([])
    } finally {
      setLoadingContratos(false)
    }
  }, [])

  useEffect(() => { loadContratos() }, [loadContratos])

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true)
    try {
      const { data } = await api.get<Batch[]>('/api/affinity/batches')
      setBatches(data)
    } catch {
      toast.error('Falha ao carregar os lotes.')
    } finally {
      setLoadingBatches(false)
    }
  }, [])

  useEffect(() => { loadBatches() }, [loadBatches])

  async function uploadBatch() {
    const id = parseInt(uploadContractId, 10)
    if (!id || !file) { toast.error('Informe o contrato e o arquivo CSV.'); return }
    setUploading(true)
    setUploadResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('contractId', String(id))
      // fetch puro: o browser define o Content-Type multipart COM boundary
      // (o axios da instância forçaria application/json e quebraria o multer).
      const res = await fetch(`${api.defaults.baseURL}/api/affinity/batches`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      // fetch puro não passa pelo interceptor da api: tratar sessão expirada aqui.
      if (res.status === 401) { handleUnauthorized(); return }
      const data: UploadResult & { error?: string } = await res.json()
      if (!res.ok) throw { response: { data } }
      setUploadResult(data)
      toast.success(`Lote enviado: ${data.validRows} elegíveis em ${data.chunks} chunk(s).`)
      setFile(null)
      // ingestão + replicação levam alguns segundos
      setTimeout(() => { loadBatches(); loadContratos() }, 4000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Falha no upload do lote.')
    } finally {
      setUploading(false)
    }
  }

  async function revoke() {
    const hash = revokeHash.trim().toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(hash)) { toast.error('Hash inválido (64 hex).'); return }
    if (!revokeReason.trim()) { toast.error('Informe o motivo.'); return }
    setRevoking(true)
    try {
      await api.post(`/api/affinity/eligibles/${hash}/revoke`, { reason: revokeReason.trim() })
      toast.success('Revogação enfileirada — o worker devolve o slot se estava ativado.')
      setRevokeHash(''); setRevokeReason('')
    } catch {
      toast.error('Falha ao enfileirar a revogação.')
    } finally {
      setRevoking(false)
    }
  }

  async function revokeByPerson() {
    if (!pCpf.trim() || !pBirth.trim()) { toast.error('Informe CPF e data de nascimento.'); return }
    if (!pReason.trim()) { toast.error('Informe o motivo.'); return }
    setPRevoking(true)
    try {
      const { data } = await api.post<{ hash: string; contractId: number }>(
        '/api/affinity/eligibles/revoke-by-person',
        { cpf: pCpf, birthDate: pBirth, reason: pReason.trim() }
      )
      // O hash volta porque é a chave nos relatórios de reconciliação — sem ele o
      // operador não consegue acompanhar o que acabou de pedir.
      toast.success(`Revogação enfileirada (contrato ${data.contractId}, hash ${data.hash.slice(0, 8)}…).`)
      setPCpf(''); setPBirth(''); setPReason('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Falha ao enfileirar a revogação.')
    } finally {
      setPRevoking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Handshake className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Afinidade</h1>
          <p className="text-sm text-muted-foreground">
            Elegíveis por contratante B2B — a lista vive apenas como hash; nenhuma PII fica nos bancos.
          </p>
        </div>
      </div>

      {/*
        A carteira inteira, antes de qualquer formulário.

        Até aqui a única forma de olhar um contrato era digitar o id numérico dele — o
        que só funcionava para quem já sabia o número. Quem não sabia não tinha como
        descobrir nem que o contrato existia.
      */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Contratos de afinidade</CardTitle>
            <CardDescription>
              {contratos === null
                ? 'Carregando…'
                : `${contratos.length} contrato(s) com modalidade afinidade.`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadContratos} disabled={loadingContratos}>
            {loadingContratos ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Atualizar</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contratante</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Vagas</TableHead>
                  <TableHead>Beneficiários</TableHead>
                  <TableHead>Último envio</TableHead>
                  <TableHead>Acessos</TableHead>
                  <TableHead className="text-right">Painel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos !== null && contratos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum contrato de afinidade cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {contratos === null && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {contratos?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        dashboard #{c.id}
                        {c.stormbotContractId != null && ` · StormBot #${c.stormbotContractId}`}
                      </p>
                    </TableCell>

                    {/* Contrato sem mapeamento no StormBot não tem onde buscar número
                        nenhum. Mostrar zeros leria como "contrato vazio", que é o
                        oposto do problema — ele está vendido e não funciona. */}
                    {c.slots === null ? (
                      <TableCell colSpan={5}>
                        <Badge variant="outline" className="gap-1 bg-red-500/15 text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          sem vínculo com o StormBot
                        </Badge>
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="whitespace-nowrap">
                          <p className="text-sm tabular-nums">
                            {dataCurta(c.slots.startDate)} — {dataCurta(c.slots.endDate)}
                          </p>
                          <div className="mt-1">{selo(c.slots)}</div>
                        </TableCell>
                        <TableCell><BarraVagas slots={c.slots} /></TableCell>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums">
                          <span className="text-emerald-600 dark:text-emerald-400">{c.slots.activated}</span>
                          <span className="text-muted-foreground"> ativados</span>
                          <br />
                          <span className="text-amber-600 dark:text-amber-400">{c.slots.pending}</span>
                          <span className="text-muted-foreground"> aguardando</span>
                          {c.slots.revoked > 0 && (
                            <>
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {c.slots.revoked} revogado(s)
                              </span>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                          {dataCurta(c.lastBatchAt)}
                        </TableCell>
                        {/* Zero vínculos = ninguém do cliente consegue entrar no painel.
                            O contrato funciona, mas só a Storm consegue operar. */}
                        <TableCell className="text-sm tabular-nums">
                          {c.linkedUsers === 0 ? (
                            <Badge variant="outline" className="gap-1 bg-amber-500/15 text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              sem usuário
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              {c.linkedUsers} {c.linkedUsers === 1 ? 'usuário' : 'usuários'}
                            </span>
                          )}
                        </TableCell>
                      </>
                    )}

                    <TableCell className="text-right">
                      {/* `asChild` + `disabled` não desabilita nada: o Slot repassa o
                          atributo para um <a>, que o ignora. Sem mapeamento o painel
                          só mostraria o erro de contrato não vinculado — então o
                          caminho certo é não ter para onde clicar. */}
                      {c.slots === null ? (
                        <Button variant="outline" size="sm" disabled title="Contrato ainda não vinculado ao StormBot">
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Abrir painel
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/beneficiarios?contractId=${encodeURIComponent(c.id)}`}>
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            Abrir painel
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            &ldquo;Abrir painel&rdquo; leva à mesma tela que o gestor do contrato vê — com os
            mesmos botões de enviar lista e revogar acesso. A tela avisa de quem é o contrato.
          </p>
        </CardContent>
      </Card>

      {/* Upload de lote */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo lote de elegíveis</CardTitle>
          <CardDescription>
            CSV <code className="rounded bg-muted px-1">cpf;dataNascimento</code> (uma linha por pessoa; datas AAAA-MM-DD ou DD/MM/AAAA).
            O arquivo é processado em memória — só os hashes seguem adiante.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1">
            <Label htmlFor="upl-contract">Contrato</Label>
            {/*
              Era um campo livre de id numérico. Dois ids circulam aqui — o do dashboard
              e o do StormBot — e hoje eles coincidem nos contratos existentes, o que
              torna o erro invisível até o dia em que deixarem de coincidir. A rota
              espera o do StormBot; a lista resolve isso sem o operador precisar saber.
            */}
            <Select value={uploadContractId} onValueChange={setUploadContractId}>
              <SelectTrigger id="upl-contract">
                <SelectValue placeholder="Selecione o contrato" />
              </SelectTrigger>
              <SelectContent>
                {contratos
                  ?.filter((c) => c.stormbotContractId != null)
                  .map((c) => (
                    <SelectItem key={c.id} value={String(c.stormbotContractId)}>
                      {c.name} (StormBot #{c.stormbotContractId})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="upl-file">Arquivo CSV</Label>
            <Input
              id="upl-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={uploadBatch} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Enviar lote
          </Button>
          {uploadResult && (
            <div className="space-y-1 rounded-md border p-3 text-sm md:col-span-3">
              <p><span className="font-medium">{uploadResult.validRows}</span> elegíveis enfileirados (lote <code className="text-xs">{uploadResult.batchExternalId.slice(0, 8)}…</code>).</p>
              {uploadResult.invalidRows.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-amber-600">
                    {uploadResult.invalidRows.length} linha(s) inválida(s)
                  </summary>
                  <ul className="rolagem-fina mt-1 max-h-32 overflow-y-auto text-xs text-muted-foreground">
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

      {/* Lotes */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Lotes de ingestão</CardTitle>
            <CardDescription>Progresso via réplica (alguns segundos de atraso).</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadBatches} disabled={loadingBatches}>
            {loadingBatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Elegíveis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum lote ainda.</TableCell></TableRow>
                )}
                {batches.map((b) => (
                  <TableRow key={b.batchId}>
                    <TableCell className="font-mono text-xs">#{b.batchId} · {b.externalId.slice(0, 8)}…</TableCell>
                    <TableCell className="tabular-nums">{b.contractId}</TableCell>
                    <TableCell className="tabular-nums">{b.receivedRows}/{b.totalRows}</TableCell>
                    <TableCell className="tabular-nums">{b.eligibles}</TableCell>
                    <TableCell>{statusBadge(b.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Revogação por pessoa — o caso comum */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldOff className="h-4 w-4" /> Revogar por CPF
          </CardTitle>
          <CardDescription>
            O hash é calculado no servidor (o pepper não sai de lá), então basta identificar
            a pessoa. Devolve o slot se já estava ativado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input
            placeholder="CPF"
            inputMode="numeric"
            value={pCpf}
            onChange={(e) => setPCpf(maskCpf(e.target.value))}
          />
          <Input
            placeholder="DD/MM/AAAA"
            inputMode="numeric"
            value={pBirth}
            onChange={(e) => setPBirth(maskDate(e.target.value))}
          />
          <Input
            placeholder="Motivo"
            value={pReason}
            onChange={(e) => setPReason(e.target.value)}
          />
          <Button variant="destructive" onClick={revokeByPerson} disabled={pRevoking}>
            {pRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Revogar'}
          </Button>
        </CardContent>
      </Card>

      {/* Revogação por hash — reconciliação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldOff className="h-4 w-4" /> Revogar por hash</CardTitle>
          <CardDescription>
            Para quando o hash é tudo que existe — é o que aparece nos relatórios de
            reconciliação, onde não há CPF para consultar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Hash do elegível (64 hex)"
            value={revokeHash}
            onChange={(e) => setRevokeHash(e.target.value)}
            className="font-mono text-xs"
          />
          <Input
            placeholder="Motivo"
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
          />
          <Button variant="destructive" onClick={revoke} disabled={revoking}>
            {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Revogar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
