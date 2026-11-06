'use client'

/**
 * Agente Comercial — log de execuções.
 *
 * A coluna que vale olhar é "não confirmados": achados cuja citação o agente não
 * conseguiu conferir na página de origem. Eles NÃO são descartados — ficam na fila de
 * revisão marcados, e só podem ser aprovados depois que alguém abrir a fonte e
 * confirmar. Uma taxa alta não é defeito do log: diz que as fontes daquela busca
 * bloqueiam leitura automática (TripAdvisor é o caso clássico) e que mexer no prompt
 * para procurar em outros sites rende mais. O motivo de cada uma está no dialog.
 *
 * O custo é estimativa calculada com preços fixos no código do backend; a fatura da
 * OpenAI é a fonte real.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import {
  BASE, CLASSE_EXECUCAO, duracao, formatarData, formatarUsd, mensagemErro,
  type Execucao, type ExecucaoDetalhada, type Paginado,
} from '../_lib'
import { NavAgente } from '../_nav'

export default function ExecucoesPage() {
  const [pagina, setPagina] = useState(1)
  const [dados, setDados] = useState<Paginado<Execucao> | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [detalhe, setDetalhe] = useState<ExecucaoDetalhada | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const { data } = await api.get<Paginado<Execucao>>(`${BASE}/execucoes`, { params: { pagina } })
      setDados(data)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar as execuções.'))
    } finally {
      setLoading(false)
    }
  }, [pagina])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function abrirDetalhe(id: string) {
    setCarregandoDetalhe(true)
    try {
      const { data } = await api.get<ExecucaoDetalhada>(`${BASE}/execucoes/${id}`)
      setDetalhe(data)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível carregar o detalhe.'))
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Execuções</h1>
        <p className="text-muted-foreground text-sm">
          Cada ciclo do agente, com o que achou, o que não conseguiu conferir e quanto custou
        </p>
      </div>

      <NavAgente />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <p className="text-sm text-muted-foreground">
            {dados ? `${dados.total} execução(ões)` : '—'}
          </p>
          <Button variant="outline" onClick={carregar} disabled={loading}>
            {loading
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {erro ? (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />{erro}
            </div>
          ) : loading && !dados ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dados && dados.items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              O agente ainda não rodou nenhuma vez.
            </p>
          ) : dados ? (
            <div className={loading ? 'opacity-60 transition-opacity' : undefined} aria-busy={loading}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Início</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Gatilho</TableHead>
                      <TableHead className="text-right">Buscas</TableHead>
                      <TableHead className="text-right">Novos</TableHead>
                      <TableHead className="text-right">Repetidos</TableHead>
                      <TableHead className="text-right">Não confirmados</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.items.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatarData(r.startedAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {duracao(r.startedAt, r.finishedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.trigger === 'manual' ? 'manual' : 'agendado'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.searchesDone}
                          {r.searchesPlanned !== r.searchesDone && (
                            <span className="text-muted-foreground">/{r.searchesPlanned}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{r.findingsNew}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.findingsDuplicate}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={r.findingsUnverified > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                            {r.findingsUnverified}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatarUsd(r.estimatedCostUsd)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={CLASSE_EXECUCAO[r.status]}>
                            {r.status === 'partial' ? 'parcial' : r.status === 'success' ? 'ok' : r.status === 'failed' ? 'falhou' : 'rodando'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => abrirDetalhe(r.id)}
                            disabled={carregandoDetalhe}
                          >
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPaginas > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Página {dados.pagina} de {totalPaginas}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      disabled={loading || pagina <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                      disabled={loading || pagina >= totalPaginas}
                    >
                      Próxima<ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Dialog: detalhe por busca ──────────────────────────────────────── */}
      <Dialog open={!!detalhe} onOpenChange={(ab) => !ab && setDetalhe(null)}>
        <DialogContent className="sm:max-w-2xl">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle>Execução de {formatarData(detalhe.startedAt)}</DialogTitle>
                <DialogDescription>
                  {detalhe.searchesDone} busca(s) · {detalhe.findingsNew} novo(s) ·{' '}
                  {detalhe.findingsUnverified} não confirmado(s) ·{' '}
                  {Number(detalhe.inputTokens).toLocaleString('pt-BR')} +{' '}
                  {Number(detalhe.outputTokens).toLocaleString('pt-BR')} tokens ·{' '}
                  {formatarUsd(detalhe.estimatedCostUsd)} (estimado)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {detalhe.errorMessage && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {detalhe.errorMessage}
                  </div>
                )}

                {(detalhe.details?.errors ?? []).length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Avisos</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
                      {detalhe.details.errors!.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {(detalhe.details?.buscas ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma busca foi executada neste ciclo. Verifique se há buscas de
                    descoberta ativas ou estabelecimentos monitorados.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {detalhe.details.buscas!.map((b, i) => (
                      <div key={i} className="rounded-md border px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{b.alvo}</span>
                          <Badge variant="outline" className="shrink-0">
                            {b.tipo === 'descoberta' ? 'descoberta' : 'dirigida'}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {b.brutos ?? 0} devolvido(s) pelo modelo · {b.novos ?? 0} novo(s) ·{' '}
                          {b.duplicados ?? 0} repetido(s) · {b.naoVerificados ?? 0} não confirmado(s)
                        </div>
                        {b.erro && (
                          <p className="mt-2 text-xs text-red-600 dark:text-red-400">Erro: {b.erro}</p>
                        )}
                        {(b.descartes ?? []).length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <li className="text-muted-foreground">
                              Não conferidos nesta busca (continuam na fila, marcados):
                            </li>
                            {b.descartes!.map((d, j) => (
                              <li key={j} className="break-all">
                                <span className="text-amber-600">{d.motivo}</span> — {d.url}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
