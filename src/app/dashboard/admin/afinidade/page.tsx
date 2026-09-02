'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Handshake, Loader2, Upload, RefreshCw, ShieldOff, Search } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

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

interface Summary {
  contractId: number
  customerName: string
  contractedSlots: number
  usedSlots: number
  startDate: string
  endDate: string
  pending: string
  activated: string
  revoked: string
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

export default function AfinidadePage() {
  // resumo
  const [summaryContractId, setSummaryContractId] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // upload
  const [uploadContractId, setUploadContractId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  // lotes
  const [batches, setBatches] = useState<Batch[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  // revogação
  const [revokeHash, setRevokeHash] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)

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

  async function loadSummary() {
    const id = parseInt(summaryContractId, 10)
    if (!id) { toast.error('Informe o ID do contrato.'); return }
    setLoadingSummary(true)
    setSummary(null)
    try {
      const { data } = await api.get<Summary>(`/api/affinity/contracts/${id}/summary`)
      setSummary(data)
    } catch {
      toast.error('Contrato não encontrado (a réplica pode levar alguns segundos).')
    } finally {
      setLoadingSummary(false)
    }
  }

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
      const data: UploadResult & { error?: string } = await res.json()
      if (!res.ok) throw { response: { data } }
      setUploadResult(data)
      toast.success(`Lote enviado: ${data.validRows} elegíveis em ${data.chunks} chunk(s).`)
      setFile(null)
      setTimeout(loadBatches, 4000) // ingestão + replicação levam alguns segundos
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Resumo por contrato */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo do contrato</CardTitle>
            <CardDescription>Slots e ativações (dados da réplica).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="ID do contrato"
                inputMode="numeric"
                value={summaryContractId}
                onChange={(e) => setSummaryContractId(e.target.value.replace(/\D/g, ''))}
              />
              <Button onClick={loadSummary} disabled={loadingSummary}>
                {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {summary && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">{summary.customerName} <span className="text-muted-foreground">(#{summary.contractId})</span></p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums">{summary.usedSlots}/{summary.contractedSlots}</p>
                    <p className="text-xs text-muted-foreground">slots usados</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums">{summary.pending}</p>
                    <p className="text-xs text-muted-foreground">pendentes</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums text-emerald-600">{summary.activated}</p>
                    <p className="text-xs text-muted-foreground">ativados</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums text-red-600">{summary.revoked}</p>
                    <p className="text-xs text-muted-foreground">revogados</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vigência: {new Date(summary.startDate).toLocaleDateString('pt-BR')} — {new Date(summary.endDate).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
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
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="upl-contract">Contrato</Label>
              <Input
                id="upl-contract"
                placeholder="ID do contrato B2B"
                inputMode="numeric"
                value={uploadContractId}
                onChange={(e) => setUploadContractId(e.target.value.replace(/\D/g, ''))}
              />
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
            <Button onClick={uploadBatch} disabled={uploading} className="w-full">
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Enviar lote
            </Button>
            {uploadResult && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p><span className="font-medium">{uploadResult.validRows}</span> elegíveis enfileirados (lote <code className="text-xs">{uploadResult.batchExternalId.slice(0, 8)}…</code>).</p>
                {uploadResult.invalidRows.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-amber-600">
                      {uploadResult.invalidRows.length} linha(s) inválida(s)
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

      {/* Lotes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
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

      {/* Revogação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldOff className="h-4 w-4" /> Revogar elegível</CardTitle>
          <CardDescription>
            Devolve o slot se já estava ativado. O hash aparece nos relatórios de reconciliação
            (a resolução hash→pessoa só existe via aluno ativado).
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
