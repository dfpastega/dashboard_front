/**
 * Agente Comercial — pessoas-chave de um estabelecimento.
 *
 * Sem a diretiva `'use client'`: este arquivo é importado por uma página que já é
 * cliente, então entra no mesmo grafo. Com a diretiva, o plugin do Next o trataria como
 * entrada de fronteira e recusaria `onFechar`/`onMudou` por não serem serializáveis.
 *
 * Dialog próprio, e não uma seção no dialog de edição do estabelecimento: são duas
 * tarefas diferentes. Editar o estabelecimento é corrigir um cadastro; aqui se faz
 * triagem — procurar, ler a fonte, confirmar ou descartar nome por nome.
 *
 * Duas coisas esta tela precisa comunicar sem rodeio, porque é onde o erro sai caro:
 *
 *   1. Pessoa cuja fonte o agente não conseguiu ler aparece marcada, com o motivo
 *      técnico e um botão de confirmar. O padrão é o mesmo da fila de achados, e pela
 *      mesma razão: 403 de um site não é prova de que o dado é falso.
 *   2. E-mail "achado na fonte" não é e-mail validado. A página pode estar velha, e o
 *      agente nunca monta endereço a partir do nome — quem envia precisa saber a
 *      diferença antes de clicar.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertCircle, CheckCircle2, ExternalLink, Info, Loader2, Plus, Search, Trash2,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  AJUDA_EMAIL_PESSOA, AJUDA_VERIFICACAO_PESSOA, BASE, CLASSE_GRUPO,
  CLASSE_VERIFICACAO_PESSOA, GRUPOS_CARGO, ROTULO_GRUPO, ROTULO_ORIGEM_PESSOA,
  ROTULO_VERIFICACAO_PESSOA, formatarUsd, mensagemErro,
  type Estabelecimento, type GrupoCargo, type Pessoa, type RespostaPessoas,
} from './_lib'

type FormPessoa = {
  fullName: string
  role: string
  roleGroup: GrupoCargo
  email: string
  phone: string
  linkedinUrl: string
}

const VAZIO: FormPessoa = {
  fullName: '', role: '', roleGroup: 'gerencia', email: '', phone: '', linkedinUrl: '',
}

export function PessoasDialog({
  estabelecimento,
  onFechar,
  onMudou,
}: {
  estabelecimento: Estabelecimento | null
  onFechar: () => void
  /** Avisa a tela de trás para recarregar os contadores da linha. */
  onMudou: () => void
}) {
  const [dados, setDados] = useState<RespostaPessoas | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [instrucao, setInstrucao] = useState('')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState<FormPessoa>(VAZIO)
  const [salvando, setSalvando] = useState(false)

  const id = estabelecimento?.id ?? null

  const carregar = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setErro(null)
    try {
      const { data } = await api.get<RespostaPessoas>(`${BASE}/estabelecimentos/${id}/pessoas`)
      setDados(data)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar as pessoas.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!id) {
      setDados(null)
      setInstrucao('')
      setCriando(false)
      setForm(VAZIO)
      return
    }
    carregar()
  }, [id, carregar])

  async function buscar() {
    if (!id) return
    setBuscando(true)
    try {
      const { data } = await api.post<{ message: string; custoUsd: string; naoVerificadas: number }>(
        `${BASE}/estabelecimentos/${id}/pessoas/buscar`,
        { instrucao: instrucao.trim() || null },
      )
      toast.success(data.message, {
        description: data.naoVerificadas > 0
          ? `${data.naoVerificadas} aguardam você conferir a fonte · custo ${formatarUsd(data.custoUsd)}`
          : `Custo da busca: ${formatarUsd(data.custoUsd)}`,
      })
      await carregar()
      onMudou()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível buscar.'))
    } finally {
      setBuscando(false)
    }
  }

  async function confirmar(p: Pessoa) {
    setConfirmando(p.id)
    try {
      await api.post(`${BASE}/pessoas/${p.id}/confirmar`, {})
      toast.success(`${p.fullName}: confirmado na fonte.`)
      await carregar()
      onMudou()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível confirmar.'))
    } finally {
      setConfirmando(null)
    }
  }

  async function remover(p: Pessoa) {
    setRemovendo(p.id)
    try {
      await api.delete(`${BASE}/pessoas/${p.id}`)
      toast.success(`${p.fullName} removido.`)
      await carregar()
      onMudou()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível remover.'))
    } finally {
      setRemovendo(null)
    }
  }

  async function salvar() {
    if (!id) return
    if (!form.fullName.trim()) {
      toast.error('Informe o nome completo.')
      return
    }
    setSalvando(true)
    try {
      await api.post(`${BASE}/estabelecimentos/${id}/pessoas`, {
        fullName: form.fullName.trim(),
        role: form.role.trim() || null,
        roleGroup: form.roleGroup,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
      })
      toast.success('Pessoa cadastrada.')
      setCriando(false)
      setForm(VAZIO)
      await carregar()
      onMudou()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar.'))
    } finally {
      setSalvando(false)
    }
  }

  const ultima = dados?.ultimaBusca

  return (
    <Dialog open={!!estabelecimento} onOpenChange={(ab) => { if (!ab) onFechar() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pessoas-chave</DialogTitle>
          <DialogDescription>
            {estabelecimento?.name}
            {estabelecimento?.city ? ` · ${estabelecimento.city}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* ── Buscar ───────────────────────────────────────────────────────── */}
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="p-instrucao">Procurar em fontes públicas</Label>
              <Input
                id="p-instrucao"
                placeholder="Opcional: “procure o gerente de RH”"
                value={instrucao}
                onChange={(e) => setInstrucao(e.target.value)}
              />
            </div>
            <Button onClick={buscar} disabled={buscando || !id}>
              {buscando
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Procura no site do estabelecimento, em notícias, sites de associações e perfis
            públicos indexados. Cada busca gasta uma consulta paga — o custo aparece
            abaixo. O texto do prompt é editável na aba{' '}
            <strong>Prompts</strong>.
          </p>
          {ultima && (
            <p className="text-xs text-muted-foreground">
              Última busca: {ultima.encontradas} encontrada(s) · {ultima.novas} nova(s) ·{' '}
              {ultima.duplicadas} já tinha(m) ·{' '}
              {ultima.naoVerificadas} aguardando conferência · custo{' '}
              {formatarUsd(ultima.custoUsd)}
              {ultima.erro ? ` · ${ultima.erro}` : ''}
            </p>
          )}
        </div>

        {/* ── Lista ────────────────────────────────────────────────────────── */}
        {erro ? (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />{erro}
          </div>
        ) : loading && !dados ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : dados && dados.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma pessoa ainda. Use a busca acima ou cadastre à mão.
          </p>
        ) : (
          <div className="space-y-3">
            {dados?.items.map((p) => (
              <div key={p.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.fullName}</span>
                      <Badge variant="outline" className={CLASSE_GRUPO[p.roleGroup]}>
                        {ROTULO_GRUPO[p.roleGroup]}
                      </Badge>
                      {/* "conferido" é o esperado: só destacamos o que exige atenção. */}
                      {p.verificationStatus !== 'verified' && (
                        <Badge
                          variant="outline"
                          className={CLASSE_VERIFICACAO_PESSOA[p.verificationStatus]}
                          title={AJUDA_VERIFICACAO_PESSOA[p.verificationStatus]}
                        >
                          {ROTULO_VERIFICACAO_PESSOA[p.verificationStatus]}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {p.role || '—'} · {ROTULO_ORIGEM_PESSOA[p.origin]}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remover(p)}
                    disabled={removendo === p.id}
                    aria-label={`Remover ${p.fullName}`}
                  >
                    {removendo === p.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="space-y-1 text-sm">
                  {p.email ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>
                      <Badge
                        variant="outline"
                        className={p.emailStatus === 'verified'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : p.emailStatus === 'invalid'
                            ? 'bg-red-500/15 text-red-600'
                            : 'bg-muted text-muted-foreground'}
                        title={AJUDA_EMAIL_PESSOA[p.emailStatus]}
                      >
                        {p.emailStatus === 'found'
                          ? 'achado na fonte'
                          : p.emailStatus === 'verified'
                            ? 'validado'
                            : p.emailStatus === 'invalid'
                              ? 'inválido'
                              : 'sem e-mail'}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">sem e-mail</span>
                  )}
                  {p.phone && <div className="text-muted-foreground">{p.phone}</div>}
                  {p.linkedinUrl && (
                    <a
                      href={p.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                    >
                      LinkedIn<ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {p.sourceExcerpt && (
                  <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">
                    “{p.sourceExcerpt}”
                  </blockquote>
                )}

                {p.sourceUrl && (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  >
                    <span className="max-w-[26rem] truncate">{p.sourceUrl}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}

                {/* A fila de conferência, dentro da ficha da pessoa. */}
                {p.verificationStatus === 'unverified' && (
                  <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    <div className="flex gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p>{AJUDA_VERIFICACAO_PESSOA.unverified}</p>
                        {p.verificationReason && (
                          <p className="mt-1 text-xs opacity-80">
                            Motivo técnico: {p.verificationReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmar(p)}
                      disabled={confirmando === p.id}
                    >
                      {confirmando === p.id
                        ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      Abri a fonte e o nome está lá
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Cadastro manual ──────────────────────────────────────────────── */}
        {criando ? (
          <div className="space-y-4 rounded-md border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-nome">Nome completo *</Label>
                <Input
                  id="p-nome"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cargo">Cargo</Label>
                <Input
                  id="p-cargo"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Gerente Geral"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-grupo">Função</Label>
                <Select
                  value={form.roleGroup}
                  onValueChange={(v) => setForm({ ...form, roleGroup: v as GrupoCargo })}
                >
                  <SelectTrigger id="p-grupo" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRUPOS_CARGO.map((g) => (
                      <SelectItem key={g.valor} value={g.valor}>{g.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-email">E-mail</Label>
                <Input
                  id="p-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-fone">Telefone</Label>
                <Input
                  id="p-fone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-li">LinkedIn</Label>
                <Input
                  id="p-li"
                  value={form.linkedinUrl}
                  onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/…"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={salvar} disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setCriando(false)} disabled={salvando}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setCriando(true)} className="w-fit">
            <Plus className="h-4 w-4 mr-2" />Cadastrar à mão
          </Button>
        )}

        <div className="flex gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Dados de contato profissional, coletados de fontes públicas, para prospecção
            B2B. Toda pessoa que não foi digitada aqui guarda a página de onde veio.
            Guardar não é contatar: o envio continua passando pelo cooldown e pelo
            descadastro.
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
