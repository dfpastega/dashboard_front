'use client'

/**
 * Agente Comercial — fila de achados.
 *
 * Cada linha é uma reclamação pública sobre equipe que não fala inglês, já conferida
 * contra a página de origem pelo backend. O time revisa com a fonte ao lado e aprova
 * ou recusa; nada sai por e-mail sem essa aprovação.
 *
 * A citação e o link da fonte ficam em destaque no dialog de propósito: quem aprova
 * precisa poder abrir a página e confirmar com os próprios olhos antes de liberar um
 * contato em nome da Storm. A verificação automática reduz o risco, não o elimina.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  AlertCircle, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Loader2, Play,
  RefreshCw, Search, ShieldAlert, ShieldCheck, X,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  AJUDA_EMAIL_PESSOA, AJUDA_VERIFICACAO, BASE, CLASSE_STATUS, CLASSE_VERIFICACAO, PAGINA,
  ROTULO_STATUS, ROTULO_VERIFICACAO, formatarData, formatarDataCurta, formatarUsd,
  mensagemErro, type Achado, type Config, type Paginado, type Resumo,
} from './_lib'
import { NavAgente } from './_nav'

/**
 * Copia para a área de transferência.
 *
 * Existe porque o envio é ação humana e vai continuar sendo: ninguém dispara e-mail
 * daqui. Quem aprova leva o endereço, o assunto e o corpo para o próprio cliente de
 * e-mail, e sem isto esse transporte é seleção de texto à mão — onde se perde um
 * caractere do endereço e a mensagem volta.
 *
 * `navigator.clipboard` exige contexto seguro (https ou localhost); fora dele, o
 * toast diz o que aconteceu em vez de falhar calado.
 */
async function copiar(texto: string, oque: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(`${oque} copiado.`)
  } catch {
    toast.error(`Não foi possível copiar — selecione e copie à mão.`)
  }
}

const FILTROS = [
  { valor: 'pending', rotulo: 'Pendentes' },
  { valor: 'approved', rotulo: 'Aprovados' },
  { valor: 'rejected', rotulo: 'Recusados' },
  { valor: 'todos', rotulo: 'Todos' },
]

/**
 * Eixo separado da situação: aqui se filtra por CONFERÊNCIA da citação, não pelo
 * estágio comercial. "Não conferidos" é a fila de quem precisa abrir a fonte.
 */
const FILTROS_VERIFICACAO = [
  { valor: 'todos', rotulo: 'Todas' },
  { valor: 'unverified', rotulo: 'Não conferidos' },
  { valor: 'verified', rotulo: 'Conferidos pelo agente' },
  { valor: 'confirmed', rotulo: 'Confirmados por pessoa' },
]

export default function AgenteComercialPage() {
  const [filtro, setFiltro] = useState('pending')
  const [filtroVerificacao, setFiltroVerificacao] = useState('todos')
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)

  const [dados, setDados] = useState<Paginado<Achado> | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [executando, setExecutando] = useState(false)

  // Busca avulsa
  const [dialogBusca, setDialogBusca] = useState(false)
  const [instrucoes, setInstrucoes] = useState('')
  const [aguardando, setAguardando] = useState(false)

  // Revisão
  const [aberto, setAberto] = useState<Achado | null>(null)
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca.trim())
      setPagina(1)
    }, 350)
    return () => clearTimeout(t)
  }, [busca])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [achados, res, cfg] = await Promise.all([
        api.get<Paginado<Achado>>(`${BASE}/achados`, {
          params: {
            pagina,
            ...(filtro !== 'todos' ? { status: filtro } : {}),
            ...(filtroVerificacao !== 'todos' ? { verificacao: filtroVerificacao } : {}),
            ...(buscaAplicada ? { busca: buscaAplicada } : {}),
          },
        }),
        api.get<Resumo>(`${BASE}/resumo`),
        api.get<Config>(`${BASE}/config`),
      ])
      setDados(achados.data)
      setResumo(res.data)
      setConfig(cfg.data)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar os achados.'))
    } finally {
      setLoading(false)
    }
  }, [pagina, filtro, filtroVerificacao, buscaAplicada])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrirRevisao(achado: Achado) {
    setAberto(achado)
    setAssunto(achado.emailSubject ?? '')
    setCorpo(achado.emailBody ?? '')
    setMotivo('')
  }

  /**
   * Dispara a busca avulsa e acompanha até terminar.
   *
   * O backend responde 202 e segue trabalhando, então a tela não tem como saber o
   * resultado pela resposta. Ela observa o resumo até aparecer uma execução nova já
   * encerrada — e desiste depois de ~100s em vez de ficar observando para sempre,
   * porque uma execução pode ficar presa se o dyno reiniciar no meio.
   */
  async function buscarAgora() {
    setExecutando(true)
    const idAnterior = resumo?.ultimaExecucao?.id ?? null

    try {
      const { data } = await api.post<{ message: string }>(`${BASE}/busca-avulsa`, {
        ...(instrucoes.trim() ? { instrucoes: instrucoes.trim() } : {}),
      })
      setDialogBusca(false)
      toast.success(data.message)
      setAguardando(true)

      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 4000))
        const { data: res } = await api.get<Resumo>(`${BASE}/resumo`)
        const u = res.ultimaExecucao
        if (u && u.id !== idAnterior && u.status !== 'running') {
          setInstrucoes('')
          await carregar()
          if (u.findingsNew > 0) {
            toast.success(
              `Busca concluída: ${u.findingsNew} reclamação(ões) nova(s) para revisar.`,
            )
          } else {
            toast.info(
              u.findingsUnverified > 0
                ? `Nada novo. ${u.findingsUnverified} achado(s) não puderam ser confirmados na fonte — veja em Execuções.`
                : 'Busca concluída, mas nada novo foi encontrado.',
            )
          }
          return
        }
      }
      toast.info('A busca ainda está rodando. Acompanhe em Execuções.')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível iniciar a busca.'))
    } finally {
      setExecutando(false)
      setAguardando(false)
    }
  }

  async function aprovar() {
    if (!aberto) return
    setSalvando(true)
    try {
      // Só manda o texto se mudou: o backend grava o revisado antes da transição,
      // e na F2 é esse texto que será enviado.
      const corpoMudou = corpo.trim() && corpo !== aberto.emailBody
      const assuntoMudou = assunto.trim() && assunto !== aberto.emailSubject
      await api.post(`${BASE}/achados/${aberto.id}/aprovar`, {
        ...(assuntoMudou ? { subject: assunto.trim() } : {}),
        ...(corpoMudou ? { bodyMarkdown: corpo.trim() } : {}),
      })
      toast.success('Achado aprovado.')
      setAberto(null)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível aprovar.'))
    } finally {
      setSalvando(false)
    }
  }

  /**
   * Confirmação humana: quem clica está dizendo que abriu o link e viu a reclamação.
   * É o que destrava a aprovação de um achado que o agente não conseguiu conferir.
   */
  async function confirmarNaFonte() {
    if (!aberto) return
    setSalvando(true)
    try {
      const { data } = await api.post<{ achado: Achado }>(`${BASE}/achados/${aberto.id}/confirmar`)
      setAberto(data.achado)
      toast.success('Confirmado. Agora dá para aprovar.')
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível confirmar.'))
    } finally {
      setSalvando(false)
    }
  }

  async function recusar() {
    if (!aberto) return
    if (motivo.trim().length < 3) {
      toast.error('Diga em poucas palavras por que está recusando.')
      return
    }
    setSalvando(true)
    try {
      await api.post(`${BASE}/achados/${aberto.id}/recusar`, { motivo: motivo.trim() })
      toast.success('Achado recusado.')
      setAberto(null)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível recusar.'))
    } finally {
      setSalvando(false)
    }
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agente Comercial</h1>
          <p className="text-muted-foreground text-sm">
            Reclamações públicas sobre equipe que não fala inglês, conferidas na fonte
          </p>
        </div>
        {/* Sem `disabled` pelo estado do agente: a busca avulsa existe justamente
            para rodar com ele desligado e fora da janela. */}
        <Button onClick={() => setDialogBusca(true)} disabled={executando}>
          {executando
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{aguardando ? 'Buscando…' : 'Iniciando…'}</>
            : <><Play className="h-4 w-4 mr-2" />Buscar agora</>}
        </Button>
      </div>

      <NavAgente />

      {config && !config.isActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            O agente está desligado: não vai buscar sozinho. &ldquo;Buscar agora&rdquo; continua funcionando.
          </span>
          <Link href={`${PAGINA}/configuracao`} className="font-medium underline">
            Ligar na configuração
          </Link>
        </div>
      )}

      {config?.isActive && !config.openaiConfigurada && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          O agente está ligado, mas o servidor não tem <code className="font-mono">OPENAI_API_KEY</code>.
          Os ciclos vão falhar até a chave ser configurada.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aguardando revisão</CardDescription>
            <CardTitle className="text-3xl">{resumo ? resumo.achados.pendentes : '—'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {resumo && resumo.achados.naoConfirmados > 0 ? (
              <button
                type="button"
                onClick={() => { setFiltroVerificacao('unverified'); setPagina(1) }}
                className="text-amber-600 underline underline-offset-2"
              >
                {resumo.achados.naoConfirmados} aguardando conferência na fonte
              </button>
            ) : (
              'todos conferidos'
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última execução</CardDescription>
            <CardTitle className="text-lg">
              {resumo?.ultimaExecucao ? formatarDataCurta(resumo.ultimaExecucao.startedAt) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {resumo?.ultimaExecucao
              ? `${resumo.ultimaExecucao.findingsNew} novo(s) · ${resumo.ultimaExecucao.findingsUnverified} não confirmado(s)`
              : 'nenhuma ainda'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Próxima execução</CardDescription>
            <CardTitle className="text-lg">
              {config?.isActive ? formatarDataCurta(config.nextRunAt) : 'desligado'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {config?.isActive ? formatarData(config.nextRunAt) : 'ligue o agente para agendar'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Custo no mês</CardDescription>
            <CardTitle className="text-3xl">{resumo ? formatarUsd(resumo.custoMesUsd) : '—'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            estimativa; a fatura da OpenAI é a fonte real
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-2 sm:w-64">
                <Label htmlFor="busca-achados">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="busca-achados"
                    placeholder="Estabelecimento ou trecho"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-full space-y-2 sm:w-44">
                <Label htmlFor="filtro-status">Situação</Label>
                <Select
                  value={filtro}
                  onValueChange={(v) => { setFiltro(v); setPagina(1) }}
                >
                  <SelectTrigger id="filtro-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTROS.map((f) => (
                      <SelectItem key={f.valor} value={f.valor}>{f.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-2 sm:w-56">
                <Label htmlFor="filtro-verificacao">Conferência</Label>
                <Select
                  value={filtroVerificacao}
                  onValueChange={(v) => { setFiltroVerificacao(v); setPagina(1) }}
                >
                  <SelectTrigger id="filtro-verificacao" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTROS_VERIFICACAO.map((f) => (
                      <SelectItem key={f.valor} value={f.valor}>{f.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" onClick={carregar} disabled={loading}>
              {loading
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
          </div>
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
              {buscaAplicada
                ? 'Nenhum achado para essa busca.'
                : filtro === 'pending'
                  ? 'Nada aguardando revisão.'
                  : 'Nenhum achado nesta situação.'}
            </p>
          ) : dados ? (
            <div className={loading ? 'opacity-60 transition-opacity' : undefined} aria-busy={loading}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estabelecimento</TableHead>
                      <TableHead>Reclamação</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Encontrado</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Revisar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.items.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="max-w-[14rem]">
                          <div className="truncate font-medium" title={a.establishmentName ?? ''}>
                            {a.establishmentName ?? 'não identificado'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[a.establishmentCity, a.establishmentState].filter(Boolean).join('/') || '—'}
                          </div>
                        </TableCell>
                        {/* `whitespace-normal` porque o TableCell deste repo vem com
                            `whitespace-nowrap`: sem isso a citação não quebra e o
                            line-clamp corta no meio da palavra, sem reticências. */}
                        <TableCell className="max-w-[22rem] whitespace-normal">
                          <p className="line-clamp-2 text-sm text-muted-foreground" title={a.excerpt}>
                            “{a.excerpt}”
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          <a
                            href={a.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            {a.sourceSite}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatarDataCurta(a.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className={CLASSE_STATUS[a.status]}>
                              {ROTULO_STATUS[a.status]}
                            </Badge>
                            {/* O selo de conferência só aparece quando diz algo: o caso
                                normal é o agente ter conferido, e repeti-lo em toda
                                linha esconderia justamente as que precisam de atenção. */}
                            {a.verificationStatus !== 'verified' && (
                              <Badge
                                variant="outline"
                                className={CLASSE_VERIFICACAO[a.verificationStatus]}
                                title={AJUDA_VERIFICACAO[a.verificationStatus]}
                              >
                                {ROTULO_VERIFICACAO[a.verificationStatus]}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => abrirRevisao(a)}>
                            {a.status === 'pending' ? 'Revisar' : 'Ver'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPaginas > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Página {dados.pagina} de {totalPaginas} · {dados.total} achado(s)
                  </span>
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

      {/* ── Dialog: busca avulsa ───────────────────────────────────────────── */}
      <Dialog open={dialogBusca} onOpenChange={(ab) => !ab && setDialogBusca(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buscar agora</DialogTitle>
            <DialogDescription>
              Roda uma verificação única na hora, mesmo com o agente desligado e fora do
              horário programado. Não altera o próximo ciclo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instrucoes">Restringir esta busca a (opcional)</Label>
              <Textarea
                id="instrucoes"
                value={instrucoes}
                onChange={(e) => setInstrucoes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="ex.: somente hotéis na cidade do Rio de Janeiro"
              />
              <p className="text-xs text-muted-foreground">
                {instrucoes.trim()
                  ? 'O agente vai fazer uma busca só, limitada ao que você escreveu.'
                  : 'Em branco, o agente usa as buscas de descoberta e os estabelecimentos monitorados (até três por vez).'}
              </p>
            </div>

            <div className="rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Leva cerca de um minuto. A tela avisa quando terminar — e o que for
              encontrado entra na fila para revisão, nunca enviado direto.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogBusca(false)} disabled={executando}>
              Cancelar
            </Button>
            <Button onClick={buscarAgora} disabled={executando}>
              {executando
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Play className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: revisão do achado ──────────────────────────────────────── */}
      <Dialog open={!!aberto} onOpenChange={(ab) => !ab && setAberto(null)}>
        <DialogContent className="sm:max-w-2xl">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle>{aberto.establishmentName ?? 'Estabelecimento não identificado'}</DialogTitle>
                <DialogDescription>
                  {[aberto.establishmentCity, aberto.establishmentState].filter(Boolean).join('/') || 'local não informado'}
                  {' · encontrado em '}{formatarData(aberto.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* A citação, destacada. É o que justifica o contato. */}
                <div className="space-y-2">
                  <Label>Reclamação encontrada</Label>
                  <blockquote className="border-l-2 border-primary bg-muted/40 px-4 py-3 text-sm italic">
                    “{aberto.excerpt}”
                  </blockquote>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <a
                      href={aberto.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                    >
                      Abrir a fonte ({aberto.sourceSite})
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {aberto.reviewDate && <span>avaliação de {formatarDataCurta(aberto.reviewDate)}</span>}
                    {aberto.excerptLanguage && <span>idioma: {aberto.excerptLanguage}</span>}
                  </div>
                  {/* O que a conferência diz, e o que falta fazer. É o bloco mais
                      importante do diálogo quando o agente não conseguiu ler a página:
                      o achado pode ser legítimo e a decisão passa a ser humana. */}
                  {aberto.verificationStatus === 'verified' && (
                    <p className="text-xs text-muted-foreground">
                      O agente abriu a página e achou este trecho, palavra por palavra. Ainda
                      assim, confira na fonte antes de aprovar — a conferência reduz o risco de
                      citação errada, não o elimina.
                    </p>
                  )}

                  {aberto.verificationStatus === 'confirmed' && (
                    <p className="text-xs text-sky-700 dark:text-sky-300">
                      Alguém do time abriu a fonte e confirmou esta reclamação
                      {aberto.verifiedAt ? ` em ${formatarData(aberto.verifiedAt)}` : ''}.
                    </p>
                  )}

                  {aberto.verificationStatus === 'unverified' && (
                    <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <div className="flex gap-2">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="space-y-1">
                          <p className="font-medium">O agente não conseguiu conferir este trecho.</p>
                          <p className="text-xs">
                            {aberto.verificationReason
                              ? `Motivo técnico: ${aberto.verificationReason}. `
                              : ''}
                            Em geral é o site bloqueando leitura automática — a reclamação
                            costuma estar lá e visível no navegador. Abra a fonte, procure o
                            trecho acima e confirme só se encontrar.
                          </p>
                        </div>
                      </div>
                      {aberto.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={confirmarNaFonte}
                          disabled={salvando}
                          className="bg-background"
                        >
                          {salvando
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <ShieldCheck className="h-4 w-4 mr-2" />}
                          Abri a fonte e a reclamação está lá
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Contato: na F1 o envio não acontece aqui, mas o time precisa ver o que
                    já temos (e o que falta) para decidir. */}
                <div className="space-y-2">
                  <Label>Contato do estabelecimento</Label>
                  <div className="rounded-md border px-4 py-3 text-sm">
                    {aberto.contactEmail ? (
                      <div className="break-all">{aberto.contactEmail}</div>
                    ) : (
                      <div className="text-muted-foreground">
                        Sem e-mail cadastrado.{' '}
                        <Link
                          href={`/dashboard/admin/agente-comercial/estabelecimentos?busca=${encodeURIComponent(aberto.establishmentName ?? '')}`}
                          className="font-medium text-foreground underline"
                        >
                          Preencher em Estabelecimentos
                        </Link>
                      </div>
                    )}
                    {aberto.contactName && (
                      <div className="text-xs text-muted-foreground">
                        {aberto.contactName}{aberto.contactRole ? ` · ${aberto.contactRole}` : ''}
                      </div>
                    )}
                    {aberto.lastEmailedAt && (
                      <div className="mt-1 text-xs text-amber-600">
                        Último e-mail nosso: {formatarDataCurta(aberto.lastEmailedAt)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Para quem escrever.
                    O contato acima é quase sempre um `reservas@` que não decide
                    treinamento. Estas são as pessoas que a varredura de decisores
                    achou no domínio do próprio hotel, com nome, cargo e caixa testada
                    — e nenhuma delas aparecia nesta tela, que é onde a decisão de
                    escrever acontece. */}
                {aberto.pessoasComEmail && aberto.pessoasComEmail.length > 0 && (
                  <div className="space-y-2">
                    <Label>Para quem escrever</Label>
                    <div className="divide-y rounded-md border text-sm">
                      {aberto.pessoasComEmail.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{p.fullName}</span>
                              {p.decisor === 'sim' && (
                                <Badge variant="outline" className="bg-violet-500/15 text-violet-600">
                                  decide treinamento
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  p.emailStatus === 'verified'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : p.emailStatus === 'invalid'
                                      ? 'bg-red-500/15 text-red-600'
                                      : 'bg-amber-500/15 text-amber-600'
                                }
                                title={AJUDA_EMAIL_PESSOA[p.emailStatus]}
                              >
                                {p.emailStatus === 'verified'
                                  ? 'caixa confirmada'
                                  : p.emailStatus === 'invalid'
                                    ? 'reprovado — não envie'
                                    : 'não validado'}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.role || 'cargo não informado'}
                            </div>
                            <div className="break-all">{p.email}</div>
                            {p.emailDomainMatches === false && (
                              <div className="text-xs text-amber-600">
                                O endereço é de outro domínio — pode ser de outra empresa.
                              </div>
                            )}
                            {p.sourceUrl && (
                              <a
                                href={p.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                              >
                                fonte<ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copiar(p.email, 'Endereço')}
                          >
                            <Copy className="h-4 w-4 mr-1" />Copiar
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O agente não manda e-mail. Aprovar aqui significa “liberado para
                      enviar”: quem envia é uma pessoa, do próprio cliente de e-mail, com
                      o texto e o endereço copiados desta tela.
                    </p>
                  </div>
                )}

                {aberto.status === 'pending' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="assunto">Assunto do e-mail</Label>
                      <Input
                        id="assunto"
                        value={assunto}
                        onChange={(e) => setAssunto(e.target.value)}
                        placeholder="O agente não gerou assunto para este achado"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="corpo">Rascunho</Label>
                      <Textarea
                        id="corpo"
                        value={corpo}
                        onChange={(e) => setCorpo(e.target.value)}
                        rows={10}
                        placeholder="O agente não gerou rascunho para este achado"
                        className="font-mono text-xs"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm" variant="outline"
                          disabled={!assunto.trim()}
                          onClick={() => copiar(assunto, 'Assunto')}
                        >
                          <Copy className="h-4 w-4 mr-1" />Copiar assunto
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          disabled={!corpo.trim()}
                          onClick={() => copiar(corpo, 'Rascunho')}
                        >
                          <Copy className="h-4 w-4 mr-1" />Copiar rascunho
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Escrito pelo agente e editável. O envio é manual: o que você
                        copiar daqui é o que vai, com a sua assinatura e o seu remetente.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="motivo">Motivo da recusa</Label>
                      <Input
                        id="motivo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Preencha só se for recusar"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Situação</Label>
                    <div className="rounded-md border px-4 py-3 text-sm">
                      <Badge variant="outline" className={CLASSE_STATUS[aberto.status]}>
                        {ROTULO_STATUS[aberto.status]}
                      </Badge>
                      {aberto.reviewedAt && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          em {formatarData(aberto.reviewedAt)}
                        </span>
                      )}
                      {aberto.rejectionReason && (
                        <p className="mt-2 text-muted-foreground">Motivo: {aberto.rejectionReason}</p>
                      )}
                      {aberto.emailSubject && (
                        <div className="mt-3 space-y-2">
                          <div className="font-medium">{aberto.emailSubject}</div>
                          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                            {aberto.emailBody}
                          </p>
                          {aberto.status === 'approved' && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm" variant="outline"
                                onClick={() => copiar(aberto.emailSubject ?? '', 'Assunto')}
                              >
                                <Copy className="h-4 w-4 mr-1" />Copiar assunto
                              </Button>
                              <Button
                                size="sm" variant="outline"
                                onClick={() => copiar(aberto.emailBody ?? '', 'Texto')}
                              >
                                <Copy className="h-4 w-4 mr-1" />Copiar texto
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {aberto.status === 'pending' && (
                <DialogFooter>
                  <Button variant="destructive" onClick={recusar} disabled={salvando}>
                    {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                    Recusar
                  </Button>
                  <Button
                    onClick={aprovar}
                    disabled={salvando || aberto.verificationStatus === 'unverified'}
                    title={
                      aberto.verificationStatus === 'unverified'
                        ? 'Confirme na fonte antes de aprovar'
                        : undefined
                    }
                  >
                    {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Aprovar
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
