'use client'

/**
 * Cadastros de hotéis do piloto de inglês — Goiás (Sebrae + ABIH).
 *
 * Lista o que a landing pública /piloto-ingles-goias gravou depois da confirmação de e-mail
 * (tabela `dash_pilot_hotel_registrations`). Só super_admin: o item do menu é filtrado por
 * role e a rota GET /api/piloto-goias/admin/cadastros responde 403 para os demais.
 *
 * Contatos vêm mascarados, como no painel de afinidade. "Mostrar contatos" busca de novo com
 * `reveal=1`, e o backend registra quem pediu.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, Loader2, Map, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { maskCep, maskCnpj, maskPhone } from '@/lib/masks'

interface Cadastro {
  id: string
  confirmedAt: string
  hotelName: string
  cnpj: string
  cep: string
  street: string
  number: string
  complement: string | null
  district: string
  city: string
  state: string
  employees: number
  contactName: string
  contactRole: string
  contactEmail: string
  contactPhone: string
}

interface Resposta {
  total: number
  pagina: number
  porPagina: number
  pendentes: number
  contatosRevelados: boolean
  cadastros: Cadastro[]
}

const LANDING_URL = '/piloto-ingles-goias'
const PAGINA_URL = '/dashboard/admin/piloto-goias'

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Mascarado pelo backend ("(62) •••••-5678") já vem formatado; revelado vem só com dígitos. */
function formatarCelular(valor: string, revelado: boolean) {
  return revelado ? maskPhone(valor) : valor
}

export default function PilotoGoiasAdminPage() {
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [revelar, setRevelar] = useState(false)

  const [dados, setDados] = useState<Resposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<Cadastro | null>(null)

  // Espera a pessoa parar de digitar antes de buscar.
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
      const { data } = await api.get<Resposta>('/api/piloto-goias/admin/cadastros', {
        params: {
          pagina,
          ...(buscaAplicada ? { busca: buscaAplicada } : {}),
          ...(revelar ? { reveal: '1' } : {}),
        },
      })
      setDados(data)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setErro(
        status === 403
          ? 'Esta tela é restrita a super administradores.'
          : 'Não foi possível carregar os cadastros. Tente novamente.',
      )
    } finally {
      setLoading(false)
    }
  }, [pagina, buscaAplicada, revelar])

  useEffect(() => {
    carregar()
  }, [carregar])

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1
  const revelado = dados?.contatosRevelados ?? false

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Capacitação Goiás — hotéis cadastrados</h1>
          <p className="text-muted-foreground text-sm">
            Cadastros confirmados pela landing do plano de capacitação em inglês para o trade de Goiás (Sebrae + ABIH)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`${PAGINA_URL}/mapa`}>
              <Map className="h-4 w-4 mr-2" />Ver no mapa
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={LANDING_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />Abrir landing
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{buscaAplicada ? 'Cadastros encontrados' : 'Cadastros confirmados'}</CardDescription>
            <CardTitle className="text-3xl">{dados ? dados.total : '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aguardando confirmação de e-mail</CardDescription>
            <CardTitle className="text-3xl">{dados ? dados.pendentes : '—'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Envios dos últimos 2 dias que ainda não clicaram no link. Só viram cadastro após a confirmação.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full max-w-md space-y-2">
              <Label htmlFor="busca-cadastros">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca-cadastros"
                  placeholder="Hotel, município, responsável, e-mail ou CNPJ"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setRevelar((r) => !r)}
              disabled={loading}
              title={revelado ? 'Voltar a mascarar e-mail e celular' : 'Exibir e-mail e celular completos (o acesso fica registrado)'}
            >
              {revelado
                ? <><EyeOff className="h-4 w-4 mr-2" />Ocultar contatos</>
                : <><Eye className="h-4 w-4 mr-2" />Mostrar contatos</>}
            </Button>
          </div>
          {revelado && (
            <p className="text-xs text-muted-foreground">
              Contatos completos exibidos. O acesso foi registrado. Use os dados apenas para o contato sobre o plano de capacitação.
            </p>
          )}
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
          ) : dados && dados.cadastros.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {buscaAplicada ? 'Nenhum cadastro encontrado para essa busca.' : 'Nenhum hotel cadastrado ainda.'}
            </p>
          ) : dados ? (
            <div className={loading ? 'opacity-60 transition-opacity' : undefined} aria-busy={loading}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hotel</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead className="text-right">Funcionários</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Confirmado em</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.cadastros.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.hotelName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{maskCnpj(c.cnpj)}</div>
                      </TableCell>
                      <TableCell className="text-sm">{c.city}/{c.state}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.employees}</TableCell>
                      <TableCell>
                        <div className="text-sm">{c.contactName}</div>
                        <div className="text-xs text-muted-foreground">{c.contactRole}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="break-all">{c.contactEmail}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatarCelular(c.contactPhone, revelado)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatarData(c.confirmedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelecionado(c)}>
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPaginas > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Página {dados.pagina} de {totalPaginas}
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

      {/* ── Dialog: detalhes do cadastro ───────────────────────────────────── */}
      <Dialog open={!!selecionado} onOpenChange={(aberto) => !aberto && setSelecionado(null)}>
        <DialogContent className="sm:max-w-lg">
          {selecionado && (
            <>
              <DialogHeader>
                <DialogTitle>{selecionado.hotelName}</DialogTitle>
                <DialogDescription>
                  Confirmado em {formatarData(selecionado.confirmedAt)}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">CNPJ</dt>
                <dd className="font-mono">{maskCnpj(selecionado.cnpj)}</dd>
                <dt className="text-muted-foreground">Endereço</dt>
                <dd>
                  {selecionado.street}, {selecionado.number}
                  {selecionado.complement ? ` — ${selecionado.complement}` : ''}
                  <br />
                  {selecionado.district} · {selecionado.city}/{selecionado.state}
                  <br />
                  CEP {maskCep(selecionado.cep)}
                </dd>
                <dt className="text-muted-foreground">Funcionários</dt>
                <dd>{selecionado.employees}</dd>
                <dt className="text-muted-foreground">Responsável</dt>
                <dd>{selecionado.contactName} · {selecionado.contactRole}</dd>
                <dt className="text-muted-foreground">E-mail</dt>
                <dd className="break-all">{selecionado.contactEmail}</dd>
                <dt className="text-muted-foreground">Celular</dt>
                <dd className="tabular-nums">{formatarCelular(selecionado.contactPhone, revelado)}</dd>
              </dl>
              {!revelado && (
                <p className="text-xs text-muted-foreground">
                  E-mail e celular estão mascarados. Use “Mostrar contatos” para ver os dados completos.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
