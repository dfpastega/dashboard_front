'use client'

/**
 * Agente Comercial — Cadastur, o universo de prospecção.
 *
 * As outras telas mostram o funil: o que o agente achou e o que o time está trabalhando.
 * Esta mostra o universo inteiro de onde o funil pode escolher — os ~21 mil meios de
 * hospedagem do cadastro do Ministério do Turismo, obrigatório por lei e publicado em
 * dados abertos.
 *
 * Isso inverte a ordem de trabalho. Antes, um hotel só existia aqui se alguém tivesse
 * reclamado dele numa avaliação pública indexada. Agora o time filtra o universo pelo
 * perfil que interessa — porte, região, e principalmente quem NÃO declara atender em
 * inglês — e a reclamação passa a ser o argumento do e-mail, não a porta de entrada.
 *
 * A tela tem um dever de honestidade sobre o campo "idiomas": é autodeclarado e está em
 * branco em 43% das linhas. "Não declara inglês" é prioridade de prospecção, não prova
 * de que a equipe não fala inglês — e é por isso que a diferença entre "declarou outros
 * idiomas, sem inglês" e "não declarou nada" aparece separada no filtro e na linha.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, Info, Loader2,
  RefreshCw, Search,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  BASE, CLASSE_MONITORAMENTO, CLASSE_SYNC, FILTROS_INGLES, PAGINA, ROTULO_MONITORAMENTO,
  ROTULO_SYNC, formatarCnpj, formatarData, mensagemErro,
  type FichaCadastur, type OpcoesCadastur, type Paginado, type ResumoCadastur,
} from '../_lib'
import { NavAgente } from '../_nav'

const UHS_MIN = [
  { valor: '0', rotulo: 'Qualquer tamanho' },
  { valor: '20', rotulo: '20+ quartos' },
  { valor: '30', rotulo: '30+ quartos' },
  { valor: '50', rotulo: '50+ quartos' },
  { valor: '100', rotulo: '100+ quartos' },
]

const DATASET = 'https://dados.turismo.gov.br/dataset/meios-de-hospedagem'

export default function CadasturPage() {
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [uf, setUf] = useState('todas')
  const [tipo, setTipo] = useState('todos')
  const [ingles, setIngles] = useState<string>('sem')
  const [uhsMin, setUhsMin] = useState('30')
  const [comEmail, setComEmail] = useState(true)
  const [foraDoFunil, setForaDoFunil] = useState(false)
  const [pagina, setPagina] = useState(1)

  const [dados, setDados] = useState<Paginado<FichaCadastur> | null>(null)
  const [resumo, setResumo] = useState<ResumoCadastur | null>(null)
  const [opcoes, setOpcoes] = useState<OpcoesCadastur | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [promovendo, setPromovendo] = useState<string | null>(null)

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
      const { data } = await api.get<Paginado<FichaCadastur>>(`${BASE}/cadastur`, {
        params: {
          pagina,
          ...(buscaAplicada ? { busca: buscaAplicada } : {}),
          ...(uf !== 'todas' ? { uf } : {}),
          ...(tipo !== 'todos' ? { tipo } : {}),
          ...(ingles !== 'todos' ? { ingles } : {}),
          ...(uhsMin !== '0' ? { uhsMin } : {}),
          ...(comEmail ? { comEmail: true } : {}),
          ...(foraDoFunil ? { noFunil: 'nao' } : {}),
        },
      })
      setDados(data)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar o Cadastur.'))
    } finally {
      setLoading(false)
    }
  }, [pagina, buscaAplicada, uf, tipo, ingles, uhsMin, comEmail, foraDoFunil])

  const carregarResumo = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([
        api.get<ResumoCadastur>(`${BASE}/cadastur/resumo`),
        api.get<OpcoesCadastur>(`${BASE}/cadastur/opcoes`),
      ])
      setResumo(r.data)
      setOpcoes(o.data)
    } catch {
      // O resumo é complemento: a listagem já reporta o próprio erro, e duas mensagens
      // de erro para a mesma causa só poluem a tela.
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { carregarResumo() }, [carregarResumo])

  /**
   * A importação baixa ~7 MB e processa 21 mil linhas, então o backend responde 202 e
   * segue em segundo plano. O progresso vem do resumo, que a tela recarrega.
   */
  async function sincronizar(forcar = false) {
    setSincronizando(true)
    try {
      const { data, status } = await api.post<{ message: string }>(
        `${BASE}/cadastur/sincronizar`,
        null,
        { params: forcar ? { forcar: true } : {} },
      )
      toast.success(data.message)
      if (status === 202) {
        // Dá tempo de o importador avançar antes de a tela mostrar os números.
        setTimeout(() => { carregarResumo(); carregar() }, 8000)
      } else {
        carregarResumo()
        carregar()
      }
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível sincronizar.'))
    } finally {
      setSincronizando(false)
    }
  }

  async function promover(ficha: FichaCadastur) {
    setPromovendo(ficha.cnpj)
    try {
      const { data } = await api.post<{ message: string }>(
        `${BASE}/cadastur/${ficha.cnpj}/promover`,
        {},
      )
      toast.success(data.message)
      carregar()
      carregarResumo()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível promover.'))
    } finally {
      setPromovendo(null)
    }
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1
  const sync = resumo?.ultimaSincronizacao
  const baseVazia = resumo !== null && resumo.total === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cadastur</h1>
          <p className="text-muted-foreground text-sm">
            Os meios de hospedagem cadastrados no Ministério do Turismo — o universo de
            onde o funil escolhe
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => sincronizar(false)} disabled={sincronizando}>
            {sincronizando
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Download className="h-4 w-4 mr-2" />}
            Sincronizar
          </Button>
        </div>
      </div>

      <NavAgente />

      {/* ── Estado da base ─────────────────────────────────────────────────── */}
      {baseVazia ? (
        <Card>
          <CardContent className="space-y-3 py-6 text-sm">
            <p className="font-medium">A base do Cadastur ainda não foi importada.</p>
            <p className="text-muted-foreground">
              O Ministério do Turismo publica o cadastro de meios de hospedagem em dados
              abertos, por trimestre. São cerca de 21 mil estabelecimentos com CNPJ,
              e-mail, telefone, responsável, número de quartos e os idiomas que cada um
              declara atender. A importação leva alguns minutos e não usa IA nem API paga.
            </p>
            <Button onClick={() => sincronizar(false)} disabled={sincronizando}>
              {sincronizando
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Download className="h-4 w-4 mr-2" />}
              Importar agora
            </Button>
          </CardContent>
        </Card>
      ) : resumo ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em operação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {resumo.emOperacao.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground">
                de {resumo.total.toLocaleString('pt-BR')} no cadastro
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Não declaram inglês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {resumo.semIngles.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground">
                incluindo quem não declarou idioma nenhum
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alvo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {resumo.alvo.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground">
                operando, sem inglês, 30+ quartos e com e-mail
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Já no funil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {resumo.noFunil.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground">promovidos a estabelecimento</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ── O que o campo "idiomas" é e o que não é ────────────────────────── */}
      {!baseVazia && (
        <div className="flex gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p>
              <span className="font-medium">Os idiomas são autodeclarados</span> pelo
              próprio estabelecimento, e 43% da base não declarou nenhum. &ldquo;Não
              declara inglês&rdquo; é um bom critério para <em>priorizar</em> a
              prospecção — não é prova de que a equipe não fala inglês.
            </p>
            <p className="text-muted-foreground text-xs">
              Número de funcionários não existe em base pública por CNPJ. O que mais se
              aproxima, e para este produto diz mais, é o número de quartos: ele prevê o
              tamanho da equipe que atende hóspede estrangeiro.
            </p>
          </div>
        </div>
      )}

      {/* ── Filtros e lista ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="gap-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="cad-busca">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="cad-busca"
                  placeholder="Nome ou CNPJ"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cad-uf">Estado</Label>
              <Select value={uf} onValueChange={(v) => { setUf(v); setPagina(1) }}>
                <SelectTrigger id="cad-uf" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos os estados</SelectItem>
                  {opcoes?.ufs.map((o) => (
                    <SelectItem key={o.uf} value={o.uf}>
                      {o.uf} ({o.total.toLocaleString('pt-BR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cad-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setPagina(1) }}>
                <SelectTrigger id="cad-tipo" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {opcoes?.tipos.map((o) => (
                    <SelectItem key={o.tipo} value={o.tipo}>
                      {o.tipo} ({o.total.toLocaleString('pt-BR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cad-ingles">Idioma</Label>
              <Select value={ingles} onValueChange={(v) => { setIngles(v); setPagina(1) }}>
                <SelectTrigger id="cad-ingles" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTROS_INGLES.map((f) => (
                    <SelectItem key={f.valor} value={f.valor}>{f.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-2 sm:w-48">
                <Label htmlFor="cad-uhs">Tamanho</Label>
                <Select value={uhsMin} onValueChange={(v) => { setUhsMin(v); setPagina(1) }}>
                  <SelectTrigger id="cad-uhs" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UHS_MIN.map((o) => (
                      <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  id="cad-email"
                  checked={comEmail}
                  onCheckedChange={(v) => { setComEmail(v); setPagina(1) }}
                />
                <Label htmlFor="cad-email" className="cursor-pointer font-normal">
                  Só com e-mail
                </Label>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  id="cad-fora"
                  checked={foraDoFunil}
                  onCheckedChange={(v) => { setForaDoFunil(v); setPagina(1) }}
                />
                <Label htmlFor="cad-fora" className="cursor-pointer font-normal">
                  Esconder quem já está no funil
                </Label>
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
              Nenhum estabelecimento com esses filtros.
            </p>
          ) : dados ? (
            <div className={loading ? 'opacity-60 transition-opacity' : undefined} aria-busy={loading}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estabelecimento</TableHead>
                      <TableHead className="text-right">Quartos</TableHead>
                      <TableHead>Idiomas</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.items.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="max-w-[20rem]">
                          <div
                            className="truncate font-medium"
                            title={f.razaoSocial}
                          >
                            {f.nomeFantasia || f.razaoSocial}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[f.municipio, f.uf].filter(Boolean).join('/') || '—'}
                            {f.tipoHospedagem ? ` · ${f.tipoHospedagem}` : ''}
                            {' · '}{formatarCnpj(f.cnpj)}
                          </div>
                          {f.situacaoAtividade && f.situacaoAtividade !== 'Operação' && (
                            <Badge variant="outline" className="mt-1 bg-muted text-muted-foreground">
                              {f.situacaoAtividade}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.unidadesHabitacionais ?? '—'}
                          {f.leitos ? (
                            <div className="text-xs text-muted-foreground">
                              {f.leitos} leitos
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[12rem] text-sm">
                          {f.idiomas ? (
                            <>
                              <span className="truncate" title={f.idiomas}>
                                {f.idiomas.replace(/\|/g, ', ')}
                              </span>
                              {!f.declaraIngles && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 block w-fit bg-amber-500/15 text-amber-600"
                                >
                                  sem inglês
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              não declarou
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[14rem] text-sm">
                          {f.email ? (
                            <div className="truncate" title={f.email}>{f.email}</div>
                          ) : (
                            <span className="text-muted-foreground">sem e-mail</span>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {f.telefone ?? '—'}
                            {f.website && (
                              <>
                                {' · '}
                                <a
                                  href={f.website.startsWith('http') ? f.website : `https://${f.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 hover:underline"
                                >
                                  site<ExternalLink className="h-3 w-3" />
                                </a>
                              </>
                            )}
                          </div>
                          {f.responsavelNome && (
                            <div
                              className="truncate text-xs text-muted-foreground"
                              title={f.responsavelNome}
                            >
                              resp.: {f.responsavelNome.split('|')[0]}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {f.establishmentId ? (
                            <div className="flex flex-col items-end gap-1">
                              <Badge
                                variant="outline"
                                className={f.monitoringStatus
                                  ? CLASSE_MONITORAMENTO[f.monitoringStatus]
                                  : undefined}
                              >
                                {f.monitoringStatus
                                  ? ROTULO_MONITORAMENTO[f.monitoringStatus]
                                  : 'no funil'}
                              </Badge>
                              <a
                                href={`${PAGINA}/estabelecimentos?busca=${encodeURIComponent(
                                  f.nomeFantasia || f.razaoSocial,
                                )}`}
                                className="text-xs text-muted-foreground hover:underline"
                              >
                                abrir no funil
                              </a>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <Button
                                size="sm"
                                onClick={() => promover(f)}
                                disabled={promovendo === f.cnpj}
                              >
                                {promovendo === f.cnpj && (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                )}
                                Monitorar
                              </Button>
                              {f.possivelEstabelecimentoId && (
                                <span className="text-xs text-muted-foreground">
                                  já existe no funil sem CNPJ — será vinculado
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {dados.total.toLocaleString('pt-BR')} com esses filtros
                  {totalPaginas > 1 && ` · página ${dados.pagina} de ${totalPaginas}`}
                </span>
                {totalPaginas > 1 && (
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
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Procedência da base ────────────────────────────────────────────── */}
      {sync && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">De onde vêm estes dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Cadastro de prestadores de serviços turísticos do Ministério do Turismo,
              obrigatório por lei para meio de hospedagem.{' '}
              <a
                href={DATASET}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-foreground hover:underline"
              >
                Dados abertos do MTur<ExternalLink className="h-3 w-3" />
              </a>
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={CLASSE_SYNC[sync.status]}>
                {ROTULO_SYNC[sync.status]}
              </Badge>
              <span className="text-muted-foreground">
                {sync.recurso ? `arquivo “${sync.recurso}”` : 'arquivo não identificado'}
                {' · '}
                {formatarData(sync.finishedAt ?? sync.startedAt)}
                {sync.trigger === 'scheduled' ? ' · automática' : ' · manual'}
              </span>
            </div>

            {sync.status === 'success' && (
              <p className="text-muted-foreground">
                {sync.lidas.toLocaleString('pt-BR')} linhas lidas ·{' '}
                {sync.inseridas.toLocaleString('pt-BR')} novas ·{' '}
                {sync.atualizadas.toLocaleString('pt-BR')} atualizadas ·{' '}
                {sync.desativadas.toLocaleString('pt-BR')} saíram do cadastro ·{' '}
                {sync.estabelecimentosEnriquecidos.toLocaleString('pt-BR')} estabelecimentos
                do funil enriquecidos
              </p>
            )}

            {sync.erro && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{sync.erro}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              O MTur publica por trimestre, sem data fixa. A verificação roda uma vez por
              dia e só baixa quando há arquivo novo — por isso{' '}
              <strong>nada novo</strong> é o resultado normal.
            </p>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => sincronizar(true)}
              disabled={sincronizando}
            >
              {sincronizando
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-2" />}
              Reimportar o mesmo arquivo
            </Button>
            <span className="ml-1 text-xs text-muted-foreground">
              (só é útil se a leitura do arquivo mudou)
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
