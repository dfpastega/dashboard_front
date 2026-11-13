'use client'

/**
 * Agente Comercial — a fila de sugestões.
 *
 * Esta tela existe porque a regra do enriquecimento é NUNCA SOBRESCREVER. Quando a
 * busca web acha um telefone diferente do que está no cadastro, o cadastro não muda:
 * nasce uma sugestão com o valor, a URL e o trecho literal que o sustentam. A primeira
 * rodada de verdade — 101 estabelecimentos, US$ 18,96 — produziu 232 dessas linhas, e
 * até aqui nenhuma tinha tela: dado pago, nunca decidido.
 *
 * Três coisas aqui não são estética:
 *
 *  - **A fonte fica ao lado do valor.** Decidir sem ver de onde veio é chutar. O trecho
 *    literal e o link abrem na própria linha.
 *  - **O valor é editável antes de aceitar.** Quatro das 29 sugestões de e-mail são uma
 *    LISTA ("reservas@x; contato@x") — é por isso que são sugestão. Quem decide escolhe
 *    um e aceita o escolhido; o backend registra a correção ao lado da original.
 *  - **"O cadastro mudou" não é aviso decorativo.** Se alguém corrigiu o campo depois
 *    da busca, aceitar apagaria a correção de uma pessoa com a leitura de um modelo.
 *    A tela pede uma segunda confirmação explícita.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertCircle, AlertTriangle, Check, ChevronLeft, ChevronRight, ExternalLink, Info,
  Loader2, RefreshCw, Search, Trash2, Undo2,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  AJUDA_CAMPO, BASE, CLASSE_STATUS_SUGESTAO, ROTULO_CAMPO, ROTULO_PROVEDOR,
  ROTULO_STATUS_SUGESTAO, formatarCnpj, formatarDataCurta, mensagemErro,
  type CampoSugestao, type Paginado, type ResumoSugestoes, type Sugestao,
} from '../_lib'
import { NavAgente } from '../_nav'

const STATUS = [
  { valor: 'pending', rotulo: 'Esperando decisão' },
  { valor: 'accepted', rotulo: 'Aceitas' },
  { valor: 'discarded', rotulo: 'Descartadas' },
  { valor: 'superseded', rotulo: 'Substituídas' },
  { valor: 'todos', rotulo: 'Todas' },
]

/** Como mostrar o valor de cada campo; CNPJ cru é ilegível. */
function valorLegivel(campo: CampoSugestao, valor: string | null): string {
  if (!valor) return '—'
  return campo === 'cnpj' ? formatarCnpj(valor) : valor
}

export default function SugestoesPage() {
  const params = useSearchParams()
  // A tela de estabelecimentos linka para cá com ?estabelecimento=<id>.
  const estabelecimentoInicial = params?.get('estabelecimento') ?? ''

  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [status, setStatus] = useState('pending')
  const [campo, setCampo] = useState('todos')
  const [pagina, setPagina] = useState(1)

  const [dados, setDados] = useState<Paginado<Sugestao> | null>(null)
  const [resumo, setResumo] = useState<ResumoSugestoes | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  /** Valor editado por linha; ausente significa "aceitar como veio". */
  const [editado, setEditado] = useState<Record<string, string>>({})
  /** Qual linha está sendo decidida agora. */
  const [decidindo, setDecidindo] = useState<string | null>(null)
  /** Linhas em que o aceitar já avisou que o cadastro mudou e espera confirmação. */
  const [confirmando, setConfirmando] = useState<Record<string, string>>({})

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
      const url = estabelecimentoInicial
        ? `${BASE}/estabelecimentos/${estabelecimentoInicial}/sugestoes`
        : `${BASE}/sugestoes`
      const { data } = await api.get<Paginado<Sugestao>>(url, {
        params: {
          pagina,
          status,
          ...(campo !== 'todos' ? { campo } : {}),
          ...(buscaAplicada ? { busca: buscaAplicada } : {}),
        },
      })
      setDados(data)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar a fila de sugestões.'))
    } finally {
      setLoading(false)
    }
  }, [pagina, status, campo, buscaAplicada, estabelecimentoInicial])

  const carregarResumo = useCallback(async () => {
    try {
      const { data } = await api.get<ResumoSugestoes>(`${BASE}/sugestoes/resumo`)
      setResumo(data)
    } catch {
      setResumo(null)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { carregarResumo() }, [carregarResumo])

  async function aceitar(s: Sugestao, sobrescrever = false) {
    const valor = (editado[s.id] ?? s.suggestedValue).trim()
    if (!valor) {
      toast.error('O valor não pode ficar vazio.')
      return
    }
    setDecidindo(s.id)
    try {
      const { data } = await api.post<{ message: string }>(
        `${BASE}/sugestoes/${s.id}/aceitar`,
        {
          // Só manda `valor` quando foi editado: assim o backend sabe distinguir
          // "aceitei o que o provedor disse" de "corrigi e aceitei o meu".
          ...(valor !== s.suggestedValue.trim() ? { valor } : {}),
          ...(sobrescrever ? { sobrescrever: true } : {}),
        },
      )
      toast.success(`${s.establishmentName}: ${data.message}`)
      setConfirmando((c) => { const n = { ...c }; delete n[s.id]; return n })
      setEditado((e) => { const n = { ...e }; delete n[s.id]; return n })
      carregar()
      carregarResumo()
    } catch (err) {
      const msg = mensagemErro(err, 'Não foi possível aceitar.')
      // 409 do `current_value`: o backend explica o que mudou e a linha passa a
      // oferecer o "sobrescrever mesmo assim" — não é um erro para ignorar.
      const st = (err as { response?: { status?: number } })?.response?.status
      if (st === 409 && !sobrescrever) setConfirmando((c) => ({ ...c, [s.id]: msg }))
      else toast.error(msg)
    } finally {
      setDecidindo(null)
    }
  }

  async function descartar(s: Sugestao) {
    setDecidindo(s.id)
    try {
      await api.post(`${BASE}/sugestoes/${s.id}/descartar`)
      toast.success(`${ROTULO_CAMPO[s.field]} de ${s.establishmentName}: descartada.`)
      carregar()
      carregarResumo()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível descartar.'))
    } finally {
      setDecidindo(null)
    }
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1

  /** Os campos que aparecem no seletor saem da própria fila, com a contagem. */
  const camposNaFila = useMemo(
    () => resumo?.porCampo ?? [],
    [resumo],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sugestões de dado</h1>
        <p className="text-muted-foreground text-sm">
          O enriquecimento nunca sobrescreve o cadastro: o que divergiu espera decisão aqui
        </p>
        {resumo && (
          <p className="text-muted-foreground text-sm">
            {resumo.pendentes} esperando decisão em {resumo.estabelecimentos} estabelecimento(s)
          </p>
        )}
      </div>

      <NavAgente />

      {/* Os selos por campo são filtro e panorama ao mesmo tempo: é como se vê que
          metade da fila é endereço, e que os 60 CNPJs valem mais que os 11 sites —
          cada CNPJ aceito vincula uma ficha do Cadastur inteira. */}
      {camposNaFila.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {camposNaFila.map((c) => (
            <button
              key={c.campo}
              type="button"
              onClick={() => { setCampo(campo === c.campo ? 'todos' : c.campo); setPagina(1) }}
              className={
                'rounded-full border px-3 py-1 text-xs transition-colors ' +
                (campo === c.campo
                  ? 'border-primary bg-primary/10 font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
              title={AJUDA_CAMPO[c.campo]}
            >
              {ROTULO_CAMPO[c.campo]}
              <span className="ml-1.5 tabular-nums">{c.total}</span>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-2 sm:w-64">
                <Label htmlFor="busca-sug">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="busca-sug"
                    placeholder="Hotel ou valor sugerido"
                    value={busca}
                    onChange={(ev) => setBusca(ev.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-full space-y-2 sm:w-52">
                <Label htmlFor="filtro-status-sug">Situação</Label>
                <Select value={status} onValueChange={(v) => { setStatus(v); setPagina(1) }}>
                  <SelectTrigger id="filtro-status-sug" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((f) => (
                      <SelectItem key={f.valor} value={f.valor}>{f.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" onClick={() => { carregar(); carregarResumo() }} disabled={loading}>
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
              {status === 'pending'
                ? 'Nenhuma sugestão esperando decisão.'
                : 'Nada nesta situação.'}
            </p>
          ) : dados ? (
            <div className={loading ? 'opacity-60 transition-opacity' : undefined} aria-busy={loading}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estabelecimento</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead>Sugerido</TableHead>
                      <TableHead>No cadastro</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead className="text-right">Decisão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.items.map((s) => {
                      const pendente = s.status === 'pending'
                      const valor = editado[s.id] ?? s.suggestedValue
                      const aviso = confirmando[s.id]
                      return (
                        <TableRow key={s.id} className="[&>td]:align-top">
                          <TableCell className="max-w-[14rem]">
                            <div className="truncate font-medium" title={s.establishmentName}>
                              {s.establishmentName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[s.establishmentCity, s.establishmentState].filter(Boolean).join('/') || '—'}
                              {' · '}{formatarDataCurta(s.createdAt)}
                            </div>
                          </TableCell>

                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="text-sm">{ROTULO_CAMPO[s.field]}</span>
                              {AJUDA_CAMPO[s.field] && (
                                <span title={AJUDA_CAMPO[s.field]} className="inline-flex">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {ROTULO_PROVEDOR[s.provider]}
                            </div>
                          </TableCell>

                          {/* Editável de propósito: a sugestão existe porque o valor
                              não entrava direto, e às vezes a correção é só escolher
                              um dos dois e-mails da linha. */}
                          <TableCell className="max-w-[20rem]">
                            {pendente ? (
                              <Input
                                value={valor}
                                onChange={(ev) =>
                                  setEditado((e) => ({ ...e, [s.id]: ev.target.value }))
                                }
                                className="h-8 text-sm"
                                aria-label={`Valor sugerido para ${ROTULO_CAMPO[s.field]}`}
                              />
                            ) : (
                              <div className="break-words text-sm">
                                {valorLegivel(s.field, s.suggestedValue)}
                              </div>
                            )}
                            {pendente && valor !== s.suggestedValue && (
                              <button
                                type="button"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                                onClick={() =>
                                  setEditado((e) => { const n = { ...e }; delete n[s.id]; return n })
                                }
                              >
                                <Undo2 className="h-3 w-3" />
                                voltar ao valor da fonte
                              </button>
                            )}
                            {!pendente && (
                              <Badge
                                variant="outline"
                                className={`mt-1 ${CLASSE_STATUS_SUGESTAO[s.status]}`}
                              >
                                {ROTULO_STATUS_SUGESTAO[s.status]}
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="max-w-[12rem] text-sm">
                            <div className="break-words">
                              {valorLegivel(s.field, s.valorNoCadastro)}
                            </div>
                            {s.cadastroMudou && (
                              <div className="mt-1 flex items-start gap-1 text-xs text-amber-600">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>
                                  mudou depois da busca (era{' '}
                                  {s.currentValue ? `"${s.currentValue}"` : 'vazio'})
                                </span>
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="max-w-[16rem]">
                            {s.sourceUrl ? (
                              <a
                                href={s.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm hover:underline"
                              >
                                abrir<ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                            {s.sourceExcerpt && (
                              <p
                                className="mt-1 line-clamp-3 whitespace-normal break-words text-xs text-muted-foreground"
                                title={s.sourceExcerpt}
                              >
                                “{s.sourceExcerpt}”
                              </p>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            {pendente ? (
                              <div className="flex flex-col items-end gap-1">
                                {aviso ? (
                                  <div className="space-y-1 whitespace-normal break-words rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-left text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                                    <div>{aviso}</div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm" variant="outline"
                                        className="h-6 bg-background px-2"
                                        disabled={decidindo === s.id}
                                        onClick={() => aceitar(s, true)}
                                      >
                                        Sobrescrever
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost" className="h-6 px-2"
                                        onClick={() =>
                                          setConfirmando((c) => {
                                            const n = { ...c }; delete n[s.id]; return n
                                          })
                                        }
                                      >
                                        Deixar como está
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="sm" variant="outline"
                                      disabled={decidindo === s.id}
                                      onClick={() => aceitar(s)}
                                    >
                                      {decidindo === s.id
                                        ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        : <Check className="h-4 w-4 mr-1" />}
                                      Aceitar
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost"
                                      disabled={decidindo === s.id}
                                      onClick={() => descartar(s)}
                                      title="Fecha a linha sem gravar nada no cadastro."
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {formatarDataCurta(s.decidedAt)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
    </div>
  )
}
