'use client'

/**
 * Agente Comercial — configuração e buscas de descoberta.
 *
 * Os tetos aqui são o freio de custo: cada busca de um ciclo é uma chamada com a
 * ferramenta de busca na web, que é a parte cara da conta. A tela mostra o custo
 * aproximado de cada ciclo para a escolha não ser às cegas.
 *
 * A frequência mínima é de 1 hora porque o Heroku Scheduler chama o script a cada 10
 * minutos: pedir menos que isso não antecipa nada, só multiplica chamadas.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { AlertCircle, Loader2, Play, Plus, Save, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import {
  BASE, FREQUENCIAS, formatarData, formatarDataCurta, mensagemErro,
  type Busca, type Config,
} from '../_lib'
import { NavAgente } from '../_nav'

const MODELOS = ['gpt-5.5', 'gpt-5', 'gpt-4.1', 'gpt-4.1-mini']

export default function ConfiguracaoPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [buscas, setBuscas] = useState<Busca[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Formulário da configuração (espelha `config` até salvar).
  const [ativo, setAtivo] = useState(false)
  const [frequencia, setFrequencia] = useState('1440')
  const [maxBuscas, setMaxBuscas] = useState('12')
  const [maxAchados, setMaxAchados] = useState('30')
  const [cooldown, setCooldown] = useState('90')
  const [modelo, setModelo] = useState('gpt-5.5')

  // Dialog de busca
  const [editandoBusca, setEditandoBusca] = useState<Busca | null>(null)
  const [criandoBusca, setCriandoBusca] = useState(false)
  const [formBusca, setFormBusca] = useState({ label: '', region: '', searchPhrase: '' })
  const [removendo, setRemovendo] = useState<Busca | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [cfg, bs] = await Promise.all([
        api.get<Config>(`${BASE}/config`),
        api.get<{ queries: Busca[] }>(`${BASE}/buscas`),
      ])
      setConfig(cfg.data)
      setBuscas(bs.data.queries)
      setAtivo(cfg.data.isActive)
      setFrequencia(String(cfg.data.frequencyMinutes))
      setMaxBuscas(String(cfg.data.maxSearchesPerCycle))
      setMaxAchados(String(cfg.data.maxFindingsPerCycle))
      setCooldown(String(cfg.data.emailCooldownDays))
      setModelo(cfg.data.openaiModel)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar a configuração.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvarConfig() {
    const nBuscas = Number(maxBuscas)
    const nAchados = Number(maxAchados)
    const nCooldown = Number(cooldown)

    if (!Number.isInteger(nBuscas) || nBuscas < 1 || nBuscas > 100) {
      toast.error('Buscas por ciclo: use um número de 1 a 100.')
      return
    }
    if (!Number.isInteger(nAchados) || nAchados < 1 || nAchados > 500) {
      toast.error('Achados por ciclo: use um número de 1 a 500.')
      return
    }
    if (!Number.isInteger(nCooldown) || nCooldown < 0 || nCooldown > 3650) {
      toast.error('Intervalo entre e-mails: use um número de 0 a 3650 dias.')
      return
    }

    setSalvando(true)
    try {
      const { data } = await api.put<{ config: Config }>(`${BASE}/config`, {
        isActive: ativo,
        frequencyMinutes: Number(frequencia),
        maxSearchesPerCycle: nBuscas,
        maxFindingsPerCycle: nAchados,
        emailCooldownDays: nCooldown,
        openaiModel: modelo,
      })
      setConfig(data.config)
      toast.success('Configuração salva.')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar.'))
    } finally {
      setSalvando(false)
    }
  }

  /** Pede ao agendador o ciclo inteiro (todas as buscas ativas + monitorados). */
  async function rodarCicloCompleto() {
    setSalvando(true)
    try {
      const { data } = await api.post<{ message: string }>(`${BASE}/executar`)
      toast.success(data.message)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível solicitar o ciclo.'))
    } finally {
      setSalvando(false)
    }
  }

  function abrirCriacaoBusca() {
    setEditandoBusca(null)
    setCriandoBusca(true)
    setFormBusca({
      label: '',
      region: '',
      searchPhrase: 'reclamações de hóspedes sobre a equipe não falar inglês',
    })
  }

  function abrirEdicaoBusca(b: Busca) {
    setCriandoBusca(false)
    setEditandoBusca(b)
    setFormBusca({ label: b.label, region: b.region, searchPhrase: b.searchPhrase })
  }

  async function salvarBusca() {
    if (!formBusca.label.trim() || !formBusca.region.trim() || !formBusca.searchPhrase.trim()) {
      toast.error('Preencha nome, região e o que procurar.')
      return
    }
    setSalvando(true)
    try {
      const corpo = {
        label: formBusca.label.trim(),
        region: formBusca.region.trim(),
        searchPhrase: formBusca.searchPhrase.trim(),
      }
      if (editandoBusca) {
        await api.put(`${BASE}/buscas/${editandoBusca.id}`, corpo)
        toast.success('Busca atualizada.')
      } else {
        await api.post(`${BASE}/buscas`, corpo)
        toast.success('Busca criada.')
      }
      setEditandoBusca(null)
      setCriandoBusca(false)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar a busca.'))
    } finally {
      setSalvando(false)
    }
  }

  async function alternarBusca(b: Busca) {
    try {
      await api.put(`${BASE}/buscas/${b.id}`, { isActive: !b.isActive })
      setBuscas((atual) => atual.map((x) => (x.id === b.id ? { ...x, isActive: !x.isActive } : x)))
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível alterar a busca.'))
    }
  }

  async function removerBusca() {
    if (!removendo) return
    setSalvando(true)
    try {
      await api.delete(`${BASE}/buscas/${removendo.id}`)
      toast.success('Busca removida.')
      setRemovendo(null)
      carregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível remover.'))
    } finally {
      setSalvando(false)
    }
  }

  const buscasAtivas = buscas.filter((b) => b.isActive).length
  const dialogBuscaAberto = criandoBusca || !!editandoBusca

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuração do agente</h1>
        <p className="text-muted-foreground text-sm">
          Frequência, tetos de custo e as buscas de descoberta
        </p>
      </div>

      <NavAgente />

      {erro ? (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />{erro}
        </div>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {config && !config.openaiConfigurada && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              O servidor não tem <code className="font-mono">OPENAI_API_KEY</code>. Ligar o
              agente não vai surtir efeito: os ciclos falham na primeira chamada.
            </div>
          )}

          {/* ── O agente ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>O agente</CardTitle>
              <CardDescription>
                {config?.lastRunAt
                  ? `Última execução em ${formatarData(config.lastRunAt)}.`
                  : 'Ainda não rodou nenhuma vez.'}
                {config?.isActive && config.nextRunAt && ` Próxima prevista para ${formatarData(config.nextRunAt)}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="ativo" className="text-base">Agente ligado</Label>
                  <p className="text-xs text-muted-foreground">
                    Desligado, nenhum ciclo roda e nada é cobrado.
                  </p>
                </div>
                <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="frequencia">Com que frequência buscar</Label>
                  <Select value={frequencia} onValueChange={setFrequencia}>
                    <SelectTrigger id="frequencia" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIAS.map((f) => (
                        <SelectItem key={f.valor} value={String(f.valor)}>{f.rotulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    O agendador chama o agente a cada 10 minutos; ele só trabalha quando
                    este intervalo vence.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelo">Modelo</Label>
                  <Select value={modelo} onValueChange={setModelo}>
                    <SelectTrigger id="modelo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(MODELOS.includes(modelo) ? MODELOS : [modelo, ...MODELOS]).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Modelos menores custam menos e erram mais a citação — o que aparece
                    como &ldquo;não confirmado&rdquo; no log.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-buscas">Buscas por ciclo</Label>
                  <Input
                    id="max-buscas"
                    type="number" min={1} max={100}
                    value={maxBuscas}
                    onChange={(e) => setMaxBuscas(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Metade vai para as buscas de descoberta e metade para os
                    estabelecimentos monitorados, começando pelos menos recentes.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-achados">Achados por ciclo</Label>
                  <Input
                    id="max-achados"
                    type="number" min={1} max={500}
                    value={maxAchados}
                    onChange={(e) => setMaxAchados(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Teto de novidade por execução, para a fila não chegar impossível de revisar.
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="cooldown">Dias sem repetir e-mail para o mesmo estabelecimento</Label>
                  <Input
                    id="cooldown"
                    type="number" min={0} max={3650}
                    value={cooldown}
                    onChange={(e) => setCooldown(e.target.value)}
                    className="sm:max-w-[12rem]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Vale a partir da fase de envio. Antes disso, serve de aviso na revisão.
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                Com {maxBuscas || '0'} busca(s) por ciclo, cada execução custa por volta de{' '}
                <strong>US$ {(Number(maxBuscas || 0) * 0.04).toFixed(2)}</strong>. É só ordem
                de grandeza: o valor real vai no log de execuções e, de verdade, na fatura da OpenAI.
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Complementa o "Buscar agora" da fila: lá roda na hora, mas no máximo
                    três buscas; aqui roda o ciclo inteiro, no agendador, onde um
                    trabalho longo não concorre com as requisições do painel. */}
                <Button
                  variant="outline"
                  onClick={rodarCicloCompleto}
                  disabled={salvando || !config?.isActive}
                  title={
                    config?.isActive
                      ? 'Roda todas as buscas configuradas na próxima passada do agendador'
                      : 'Ligue o agente para usar o ciclo completo'
                  }
                >
                  {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Rodar o ciclo completo
                </Button>
                <Button onClick={salvarConfig} disabled={salvando}>
                  {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar configuração
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Buscas de descoberta ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle>Buscas de descoberta</CardTitle>
                <CardDescription>
                  {buscasAtivas} ativa(s) de {buscas.length}. Procuram estabelecimentos novos por região.
                </CardDescription>
              </div>
              <Button onClick={abrirCriacaoBusca}>
                <Plus className="h-4 w-4 mr-2" />Nova busca
              </Button>
            </CardHeader>
            <CardContent>
              {buscas.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhuma busca cadastrada. Sem buscas de descoberta e sem estabelecimentos
                  monitorados, o ciclo roda sem fazer nada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Busca</TableHead>
                        <TableHead>Região</TableHead>
                        <TableHead>Última vez</TableHead>
                        <TableHead>Ativa</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buscas.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="max-w-[18rem]">
                            <div className="font-medium">{b.label}</div>
                            <div className="truncate text-xs text-muted-foreground" title={b.searchPhrase}>
                              {b.searchPhrase}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{b.region}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatarDataCurta(b.lastSearchedAt)}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={b.isActive}
                              onCheckedChange={() => alternarBusca(b)}
                              aria-label={`Ativar ou desativar ${b.label}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => abrirEdicaoBusca(b)}>
                                Editar
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setRemovendo(b)}
                                aria-label={`Remover ${b.label}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Remetentes (próxima fase) ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Remetentes</CardTitle>
                <Badge variant="outline">próxima fase</Badge>
              </div>
              <CardDescription>
                Nesta fase o agente para em &ldquo;aprovado&rdquo;: o time copia o texto revisado e
                envia pela própria caixa. O cadastro de remetentes e o envio direto pelo painel,
                com descadastro e identificação obrigatórios, entram na fase seguinte.
              </CardDescription>
            </CardHeader>
          </Card>
        </>
      )}

      {/* ── Dialog: busca ─────────────────────────────────────────────────── */}
      <Dialog
        open={dialogBuscaAberto}
        onOpenChange={(ab) => { if (!ab) { setEditandoBusca(null); setCriandoBusca(false) } }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoBusca ? 'Editar busca' : 'Nova busca de descoberta'}</DialogTitle>
            <DialogDescription>
              O agente combina a região e o que procurar num comando de busca na web.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="b-nome">Nome *</Label>
              <Input
                id="b-nome"
                value={formBusca.label}
                onChange={(e) => setFormBusca({ ...formBusca, label: e.target.value })}
                placeholder="Litoral de SC — hotéis"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-regiao">Região *</Label>
              <Input
                id="b-regiao"
                value={formBusca.region}
                onChange={(e) => setFormBusca({ ...formBusca, region: e.target.value })}
                placeholder="Balneário Camboriú e Itajaí, Santa Catarina"
              />
              <p className="text-xs text-muted-foreground">
                Quanto mais específico, melhores os resultados. Uma cidade costuma render
                mais do que um estado inteiro.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-frase">O que procurar *</Label>
              <Textarea
                id="b-frase"
                value={formBusca.searchPhrase}
                onChange={(e) => setFormBusca({ ...formBusca, searchPhrase: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditandoBusca(null); setCriandoBusca(false) }}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={salvarBusca} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: confirmar remoção ─────────────────────────────────────── */}
      <Dialog open={!!removendo} onOpenChange={(ab) => !ab && setRemovendo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover a busca?</DialogTitle>
            <DialogDescription>
              {removendo?.label} deixa de ser consultada. Os achados que ela já trouxe
              continuam no painel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovendo(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={removerBusca} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
