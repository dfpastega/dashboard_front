'use client'

/**
 * Agente Comercial — estabelecimentos.
 *
 * Duas origens convivem aqui: o que o time cadastrou e o que o agente descobriu numa
 * busca. A diferença importa no custo — só `monitorado` consome uma busca dirigida por
 * ciclo. Descoberto fica visível, mas fora do radar até alguém promover.
 *
 * É também onde se preenche o e-mail do responsável quando o agente não achou: na F1 o
 * enriquecimento automático não existe, e sem contato não há a quem escrever.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Link2, Loader2, Plus, RefreshCw, Unlink,
  Search, Sparkles, Users,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import {
  AJUDA_CASAMENTO, BASE, CLASSE_MONITORAMENTO, PAGINA, ROTULO_MONITORAMENTO, formatarCnpj,
  formatarDataCurta, formatarUsd, mensagemErro,
  type Estabelecimento, type Paginado, type Resumo, type StatusCasamento,
  type StatusMonitoramento,
} from '../_lib'
import { NavAgente } from '../_nav'
import { PessoasDialog } from '../_pessoas'

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'monitored', rotulo: 'Monitorados' },
  { valor: 'discovered', rotulo: 'Descobertos' },
  { valor: 'ignored', rotulo: 'Ignorados' },
]

type Formulario = {
  name: string
  city: string
  state: string
  website: string
  contactEmail: string
  contactName: string
  contactRole: string
  contactPhone: string
  monitoringStatus: StatusMonitoramento
  notes: string
}

const VAZIO: Formulario = {
  name: '', city: '', state: '', website: '', contactEmail: '',
  contactName: '', contactRole: '', contactPhone: '',
  monitoringStatus: 'monitored', notes: '',
}

export default function EstabelecimentosPage() {
  const params = useSearchParams()
  // A fila de achados linka para cá com ?busca=<nome> quando falta contato.
  const buscaInicial = params?.get('busca') ?? ''

  const [busca, setBusca] = useState(buscaInicial)
  const [buscaAplicada, setBuscaAplicada] = useState(buscaInicial)
  const [filtro, setFiltro] = useState('todos')
  const [pagina, setPagina] = useState(1)

  const [dados, setDados] = useState<Paginado<Estabelecimento> | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [editando, setEditando] = useState<Estabelecimento | null>(null)
  const [vendoPessoas, setVendoPessoas] = useState<Estabelecimento | null>(null)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState<Formulario>(VAZIO)
  const [salvando, setSalvando] = useState(false)
  /** Qual linha está mexendo na ficha do Cadastur agora. */
  const [casando, setCasando] = useState<string | null>(null)
  const [cnpjManual, setCnpjManual] = useState('')
  /**
   * O enriquecimento sob demanda. Tem dialog próprio porque GASTA: busca web sempre
   * (US$ 0,16 na média de 116 execuções) e créditos do Snov.io quando a varredura é
   * marcada. Botão que gasta dinheiro não dispara no primeiro clique.
   */
  const [enriquecendo, setEnriquecendo] = useState<Estabelecimento | null>(null)
  const [comSnovio, setComSnovio] = useState(false)
  const [rodandoEnriquecimento, setRodandoEnriquecimento] = useState(false)

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
      const { data } = await api.get<Paginado<Estabelecimento>>(`${BASE}/estabelecimentos`, {
        params: {
          pagina,
          ...(filtro !== 'todos' ? { status: filtro } : {}),
          ...(buscaAplicada ? { busca: buscaAplicada } : {}),
        },
      })
      setDados(data)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar os estabelecimentos.'))
    } finally {
      setLoading(false)
    }
  }, [pagina, filtro, buscaAplicada])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * O resumo é complemento: a listagem já reporta o próprio erro, e duas mensagens para
   * a mesma causa só poluem a tela. Recarrega junto com a lista para o número de
   * pessoas aguardando conferência não ficar velho depois de uma busca.
   */
  const carregarResumo = useCallback(async () => {
    try {
      const { data } = await api.get<Resumo>(`${BASE}/resumo`)
      setResumo(data)
    } catch {
      setResumo(null)
    }
  }, [])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  // ── Ficha do Cadastur ──────────────────────────────────────────────────────
  //
  // Nenhuma das três gasta API paga: é consulta ao espelho local do Cadastur. Daí não
  // haver confirmação nem aviso de custo, ao contrário da busca de pessoas.

  /** Procura a ficha por nome + cidade agora, sem esperar a próxima importação. */
  async function casarCadastur(e: Estabelecimento) {
    setCasando(e.id)
    try {
      const { data } = await api.post<{
        message: string
        resultado: { status: StatusCasamento }
      }>(`${BASE}/estabelecimentos/${e.id}/casar-cadastur`)

      // 'linked' é sucesso; candidato e "não achei" são informação, não conquista.
      if (data.resultado.status === 'linked') toast.success(data.message)
      else toast.info(data.message)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível procurar no Cadastur.'))
    } finally {
      setCasando(null)
    }
  }

  /** "É este hotel": vincula a ficha candidata, sem limiar. */
  async function vincularFicha(e: Estabelecimento) {
    if (!e.cadasturCandidateCnpj) return
    setCasando(e.id)
    try {
      const { data } = await api.post<{ message: string }>(
        `${BASE}/estabelecimentos/${e.id}/cadastur`,
        { cnpj: e.cadasturCandidateCnpj },
      )
      toast.success(data.message)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível vincular a ficha.'))
    } finally {
      setCasando(null)
    }
  }

  /** "Não é": decisão terminal — a ficha não volta a ser sugerida. */
  async function recusarFicha(e: Estabelecimento) {
    setCasando(e.id)
    try {
      const { data } = await api.delete<{ message: string }>(
        `${BASE}/estabelecimentos/${e.id}/cadastur`,
      )
      toast.success(data.message)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível recusar a ficha.'))
    } finally {
      setCasando(null)
    }
  }

  /**
   * Desfaz um vínculo errado — o casamento por nome erra, e sem isto o erro fica para
   * sempre. Limpa só o que veio da ficha; o que alguém digitou depois fica.
   */
  async function desvincularFicha(e: Estabelecimento) {
    setCasando(e.id)
    try {
      const { data } = await api.delete<{ message: string }>(
        `${BASE}/estabelecimentos/${e.id}/vinculo-cadastur`,
      )
      toast.success(data.message)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível desfazer o vínculo.'))
    } finally {
      setCasando(null)
    }
  }

  /**
   * Vínculo manual por CNPJ. É a saída para o hotel cuja ficha o nome não acha — ou acha
   * errado: 'B&B HOTEL SP Luz Centro' casa com 'Hotel SP Centro' por trigramas, e só uma
   * pessoa sabe que a ficha certa é a 'B&B Hotels SP Luz'. Não passa por limiar.
   */
  async function vincularPorCnpj(e: Estabelecimento) {
    const limpo = cnpjManual.replace(/\D/g, '')
    if (limpo.length !== 14) {
      toast.error('O CNPJ precisa ter 14 dígitos.')
      return
    }
    setCasando(e.id)
    try {
      const { data } = await api.post<{ message: string }>(
        `${BASE}/estabelecimentos/${e.id}/cadastur`,
        { cnpj: limpo },
      )
      toast.success(data.message)
      setCnpjManual('')
      setEditando(null)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível vincular a ficha.'))
    } finally {
      setCasando(null)
    }
  }

  /**
   * Enriquecimento sob demanda, síncrono — como a busca de pessoas. Pode levar perto de
   * um minuto e meio: a busca institucional mediu ~83 s de média, e a varredura do
   * Snov.io soma o tempo das páginas.
   */
  async function enriquecer() {
    const alvo = enriquecendo
    if (!alvo) return
    setRodandoEnriquecimento(true)
    try {
      const { data } = await api.post<{ message: string }>(
        `${BASE}/estabelecimentos/${alvo.id}/enriquecer`,
        { snovio: comSnovio },
      )
      toast.success(`${alvo.name}: ${data.message}`, { duration: 10000 })
      setEnriquecendo(null)
      setComSnovio(false)
      carregar()
      carregarResumo()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível enriquecer.'))
    } finally {
      setRodandoEnriquecimento(false)
    }
  }

  function abrirEdicao(e: Estabelecimento) {
    setCnpjManual('')
    setEditando(e)
    setCriando(false)
    setForm({
      name: e.name,
      city: e.city ?? '',
      state: e.state ?? '',
      website: e.website ?? '',
      contactEmail: e.contactEmail ?? '',
      contactName: e.contactName ?? '',
      contactRole: e.contactRole ?? '',
      contactPhone: e.contactPhone ?? '',
      monitoringStatus: e.monitoringStatus,
      notes: e.notes ?? '',
    })
  }

  function abrirCriacao() {
    setEditando(null)
    setCriando(true)
    setForm(VAZIO)
  }

  async function salvar() {
    if (!form.name.trim()) {
      toast.error('Informe o nome do estabelecimento.')
      return
    }
    setSalvando(true)
    // Campo vazio vira null para o backend não gravar string vazia como contato.
    const corpo = {
      name: form.name.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      website: form.website.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactName: form.contactName.trim() || null,
      contactRole: form.contactRole.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      monitoringStatus: form.monitoringStatus,
      notes: form.notes.trim() || null,
    }
    try {
      if (editando) {
        await api.put(`${BASE}/estabelecimentos/${editando.id}`, corpo)
        toast.success('Estabelecimento atualizado.')
      } else {
        await api.post(`${BASE}/estabelecimentos`, corpo)
        toast.success('Estabelecimento cadastrado.')
      }
      setEditando(null)
      setCriando(false)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar.'))
    } finally {
      setSalvando(false)
    }
  }

  /** Promover ou tirar do radar sem abrir o dialog. */
  async function mudarMonitoramento(e: Estabelecimento, status: StatusMonitoramento) {
    try {
      await api.put(`${BASE}/estabelecimentos/${e.id}`, { monitoringStatus: status })
      toast.success(`${e.name}: ${ROTULO_MONITORAMENTO[status]}.`)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível alterar.'))
    }
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1
  const dialogAberto = criando || !!editando

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estabelecimentos</h1>
          <p className="text-muted-foreground text-sm">
            Só os monitorados são consultados nome a nome em cada ciclo
          </p>
          {/* `resumo.pessoas` não existe em servidor antigo — a janela entre o deploy do
              backend e o do frontend. O optional chaining é o que evita a tela em branco. */}
          {resumo?.pessoas ? (
            <p className="text-muted-foreground text-sm">
              {resumo.pessoas.total} pessoa(s)-chave cadastrada(s)
              {resumo.pessoas.comEmail > 0 && `, ${resumo.pessoas.comEmail} com e-mail`}
              {resumo.pessoas.naoConfirmadas > 0 && (
                <span className="text-amber-600">
                  {" · "}
                  {resumo.pessoas.naoConfirmadas} aguardando conferência na fonte
                </span>
              )}
            </p>
          ) : null}
          {/* A fila de sugestões não pode ficar escondida atrás de uma aba sem número:
              a primeira rodada deixou 232 linhas pagas esperando decisão. */}
          {resumo?.sugestoesPendentes ? (
            <p className="text-sm">
              <a href={`${PAGINA}/sugestoes`} className="text-amber-600 hover:underline">
                {resumo.sugestoesPendentes} sugestão(ões) de dado esperando decisão
              </a>
            </p>
          ) : null}
        </div>
        <Button onClick={abrirCriacao}>
          <Plus className="h-4 w-4 mr-2" />Cadastrar
        </Button>
      </div>

      <NavAgente />

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-2 sm:w-64">
                <Label htmlFor="busca-est">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="busca-est"
                    placeholder="Nome ou cidade"
                    value={busca}
                    onChange={(ev) => setBusca(ev.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-full space-y-2 sm:w-44">
                <Label htmlFor="filtro-mon">Situação</Label>
                <Select value={filtro} onValueChange={(v) => { setFiltro(v); setPagina(1) }}>
                  <SelectTrigger id="filtro-mon" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTROS.map((f) => (
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
              {buscaAplicada ? 'Nenhum estabelecimento para essa busca.' : 'Nenhum estabelecimento ainda.'}
            </p>
          ) : dados ? (
            <div className={loading ? 'opacity-60 transition-opacity' : undefined} aria-busy={loading}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estabelecimento</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Achados</TableHead>
                      <TableHead className="text-right">Pessoas</TableHead>
                      <TableHead>Último e-mail</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.items.map((e) => (
                      /* `align-top` porque a linha cresce quando há sugestão de ficha:
                         sem isto o selo "sem e-mail" e a situação flutuam no meio da
                         altura, longe do nome a que se referem. */
                      <TableRow key={e.id} className="[&>td]:align-top">
                        <TableCell className="max-w-[16rem]">
                          <div className="truncate font-medium" title={e.name}>{e.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[e.city, e.state].filter(Boolean).join('/') || '—'}
                            {e.cnpj ? ` · ${formatarCnpj(e.cnpj)}` : ''}
                            {e.website && (
                              <>
                                {' · '}
                                <a
                                  href={e.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 hover:underline"
                                >
                                  site<ExternalLink className="h-3 w-3" />
                                </a>
                              </>
                            )}
                          </div>
                          {/* O candidato empatado ou de nota baixa. Fica aqui, na linha,
                              e não num dialog: a decisão se toma comparando o nome e a
                              cidade que estão logo acima. */}
                          {e.cadasturMatchStatus === 'candidate' && e.cadasturCandidateCnpj && (
                            <div className="mt-1 space-y-1 whitespace-normal break-words rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                              <div>
                                Pode ser{' '}
                                <span className="font-medium">{e.cadasturCandidateNome}</span>
                                {' · '}{formatarCnpj(e.cadasturCandidateCnpj)}
                                {e.cadasturMatchScore
                                  ? ` · semelhança ${e.cadasturMatchScore}`
                                  : ''}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm" variant="outline"
                                  className="h-6 bg-background px-2"
                                  disabled={casando === e.id}
                                  onClick={() => vincularFicha(e)}
                                >
                                  É este
                                </Button>
                                <Button
                                  size="sm" variant="ghost" className="h-6 px-2"
                                  disabled={casando === e.id}
                                  onClick={() => recusarFicha(e)}
                                >
                                  Não é
                                </Button>
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[16rem] text-sm">
                          {e.contactEmail ? (
                            <>
                              <div className="truncate" title={e.contactEmail}>{e.contactEmail}</div>
                              {e.contactName && (
                                <div className="text-xs text-muted-foreground">{e.contactName}</div>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-600">
                              sem e-mail
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={CLASSE_MONITORAMENTO[e.monitoringStatus]}>
                            {ROTULO_MONITORAMENTO[e.monitoringStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{e.totalAchados}</TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            onClick={() => setVendoPessoas(e)}
                            className="inline-flex items-center gap-1 tabular-nums hover:underline"
                            title="Ver e procurar pessoas-chave"
                          >
                            {e.totalPessoas}
                            {e.pessoasNaoConfirmadas > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/15 text-amber-600"
                                title={`${e.pessoasNaoConfirmadas} aguardando conferência na fonte`}
                              >
                                {e.pessoasNaoConfirmadas}
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatarDataCurta(e.lastEmailedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {e.monitoringStatus !== 'monitored' && (
                              <Button
                                variant="outline" size="sm"
                                onClick={() => mudarMonitoramento(e, 'monitored')}
                              >
                                Monitorar
                              </Button>
                            )}
                            {e.monitoringStatus !== 'ignored' && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => mudarMonitoramento(e, 'ignored')}
                              >
                                Ignorar
                              </Button>
                            )}
                            {e.cnpj && e.cadasturMatchStatus === 'linked' && (
                              <Button
                                variant="ghost" size="sm"
                                disabled={casando === e.id}
                                onClick={() => desvincularFicha(e)}
                                title="Não é este hotel: desfaz o vínculo e limpa o que veio da ficha do Cadastur."
                              >
                                {casando === e.id
                                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  : <Unlink className="h-4 w-4 mr-1" />}
                                Desvincular
                              </Button>
                            )}
                            {!e.cnpj && e.cadasturMatchStatus !== 'candidate' && (
                              <Button
                                variant="ghost" size="sm"
                                disabled={casando === e.id}
                                onClick={() => casarCadastur(e)}
                                title={AJUDA_CASAMENTO[e.cadasturMatchStatus]}
                              >
                                {casando === e.id
                                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  : <Link2 className="h-4 w-4 mr-1" />}
                                Cadastur
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setComSnovio(false); setEnriquecendo(e) }}
                              title="Procurar site, e-mail, telefone e endereço na internet. Gasta busca paga."
                            >
                              <Sparkles className="h-4 w-4 mr-1" />Enriquecer
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setVendoPessoas(e)}>
                              <Users className="h-4 w-4 mr-1" />Pessoas
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => abrirEdicao(e)}>
                              Editar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPaginas > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Página {dados.pagina} de {totalPaginas} · {dados.total} no total
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

      {/* ── Dialog: cadastro / edição ──────────────────────────────────────── */}
      <Dialog
        open={dialogAberto}
        onOpenChange={(ab) => { if (!ab) { setEditando(null); setCriando(false) } }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar estabelecimento' : 'Cadastrar estabelecimento'}</DialogTitle>
            <DialogDescription>
              {editando
                ? 'O e-mail preenchido aqui é o destino do contato comercial.'
                : 'Entra como monitorado: será consultado nome a nome em cada ciclo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="f-nome">Nome *</Label>
              <Input
                id="f-nome"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Hotel Exemplo"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="f-cidade">Cidade</Label>
                <Input
                  id="f-cidade"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-uf">Estado</Label>
                <Input
                  id="f-uf"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder="GO"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-site">Site</Label>
              <Input
                id="f-site"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-email">E-mail do responsável</Label>
              <Input
                id="f-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="gerencia@hotel.com.br"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="f-contato">Nome do responsável</Label>
                <Input
                  id="f-contato"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-cargo">Cargo</Label>
                <Input
                  id="f-cargo"
                  value={form.contactRole}
                  onChange={(e) => setForm({ ...form, contactRole: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="f-fone">Telefone</Label>
                <Input
                  id="f-fone"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-mon">Monitoramento</Label>
                <Select
                  value={form.monitoringStatus}
                  onValueChange={(v) => setForm({ ...form, monitoringStatus: v as StatusMonitoramento })}
                >
                  <SelectTrigger id="f-mon" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monitored">Monitorado</SelectItem>
                    <SelectItem value="discovered">Descoberto</SelectItem>
                    <SelectItem value="ignored">Ignorado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-notas">Observações</Label>
              <Textarea
                id="f-notas"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>

            {editando && !editando.cnpj && (
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="f-cnpj">Ficha do Cadastur (CNPJ)</Label>
                <div className="flex gap-2">
                  <Input
                    id="f-cnpj"
                    value={cnpjManual}
                    onChange={(e) => setCnpjManual(e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                  <Button
                    variant="outline"
                    disabled={casando === editando.id || !cnpjManual.trim()}
                    onClick={() => vincularPorCnpj(editando)}
                  >
                    {casando === editando.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : 'Vincular'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Para o hotel cuja ficha o nome não acha — ou acha errada. Vincula na hora e
                  preenche os campos vazios com os dados oficiais; não passa pelo limiar de
                  semelhança, porque a escolha é sua.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditando(null); setCriando(false) }}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: enriquecer agora ───────────────────────────────────────
          Confirmação por causa do custo, e com o número medido à vista: botão que
          gasta dinheiro não dispara no primeiro clique, e quem clica tem direito de
          saber quanto custa antes, não depois. */}
      <Dialog
        open={!!enriquecendo}
        onOpenChange={(ab) => { if (!ab && !rodandoEnriquecimento) setEnriquecendo(null) }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enriquecer {enriquecendo?.name}</DialogTitle>
            <DialogDescription>
              Procura site, domínio de e-mail, telefone, endereço e CNPJ em fonte pública,
              e grava só o que estiver vazio. Divergência não sobrescreve: vira sugestão
              com a fonte ao lado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Custa uma busca web paga — {formatarUsd('0.16')} na média de 116 execuções
              reais — e leva perto de um minuto e meio. A tela fica esperando.
            </div>

            <label className="flex items-start gap-2">
              <Checkbox
                checked={comSnovio}
                onCheckedChange={(v) => setComSnovio(v === true)}
                disabled={rodandoEnriquecimento}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Procurar decisores no Snov.io também</span>
                <span className="block text-xs text-muted-foreground">
                  Nome, cargo e e-mail de quem decide treinamento. Gasta crédito: ~11 por
                  varredura, mais 1 por e-mail revelado. Só roda com domínio de e-mail
                  próprio — domínio de rede e provedor público são pulados antes de pagar.
                </span>
              </span>
            </label>

            {enriquecendo && !enriquecendo.contactEmail && (
              <p className="text-xs text-muted-foreground">
                Este estabelecimento não tem e-mail: se a busca achar um, o domínio sai
                dele — é o que destrava a busca de decisores.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEnriquecendo(null)}
              disabled={rodandoEnriquecimento}
            >
              Cancelar
            </Button>
            <Button onClick={enriquecer} disabled={rodandoEnriquecimento}>
              {rodandoEnriquecimento && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {rodandoEnriquecimento ? 'Procurando…' : 'Procurar agora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: pessoas-chave ──────────────────────────────────── */}
      <PessoasDialog
        estabelecimento={vendoPessoas}
        onFechar={() => setVendoPessoas(null)}
        onMudou={() => { carregar(); carregarResumo() }}
      />
    </div>
  )
}
