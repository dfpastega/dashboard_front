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
  AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, Plus, RefreshCw, Search,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  BASE, CLASSE_MONITORAMENTO, ROTULO_MONITORAMENTO, formatarDataCurta, mensagemErro,
  type Estabelecimento, type Paginado, type StatusMonitoramento,
} from '../_lib'
import { NavAgente } from '../_nav'

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
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [editando, setEditando] = useState<Estabelecimento | null>(null)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState<Formulario>(VAZIO)
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

  function abrirEdicao(e: Estabelecimento) {
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
                      <TableHead>Último e-mail</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.items.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="max-w-[16rem]">
                          <div className="truncate font-medium" title={e.name}>{e.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[e.city, e.state].filter(Boolean).join('/') || '—'}
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
    </div>
  )
}
