'use client'

/**
 * Agente Comercial — os prompts.
 *
 * Três coisas que o agente escreve com IA, e as três ficam aqui à vista: o comando da
 * busca de reclamações, o que escreve o rascunho do e-mail e o da busca de
 * pessoas-chave. É nesta tela que se mexe em tom de voz, personalidade, região, sites
 * consultados e tamanho do texto — sem passar por deploy.
 *
 * Cada prompt tem duas partes, e a separação é deliberada:
 *
 *   - a parte EDITÁVEL, que é o que está nas caixas de texto;
 *   - um bloco FIXO, que o servidor cola depois dela e que esta tela mostra apenas para
 *     leitura. Na busca, é o bloco que exige trecho literal e URL visível — sem isso a
 *     conferência contra a página de origem não tem o que conferir. No e-mail, é o que
 *     impede o modelo de escrever link, assinatura ou rodapé, que são injetados na hora
 *     do envio.
 *
 * Ou seja: um prompt mal escrito pode trazer menos resultado ou mudar o tom do e-mail.
 * Não consegue afrouxar a verificação nem assinar nada em nome da Storm.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, Eye, Info, Loader2, RotateCcw, Save, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { BASE, mensagemErro, type Config, type VariavelPrompt } from '../_lib'
import { NavAgente } from '../_nav'

type Qual = 'busca' | 'email' | 'pessoas'

export default function PromptsPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<Qual | null>(null)

  // Rascunhos: o que está nas caixas até alguém salvar.
  const [textoBusca, setTextoBusca] = useState('')
  const [textoEmail, setTextoEmail] = useState('')
  const [textoPessoas, setTextoPessoas] = useState('')

  const aplicar = useCallback((cfg: Config) => {
    setConfig(cfg)
    setTextoBusca(cfg.searchPrompt ?? '')
    setTextoEmail(cfg.emailPrompt ?? '')
    setTextoPessoas(cfg.peoplePrompt ?? '')
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const { data } = await api.get<Config>(`${BASE}/config`)
      aplicar(data)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar os prompts.'))
    } finally {
      setLoading(false)
    }
  }, [aplicar])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * `null` é "voltar ao padrão", não "prompt vazio": o backend guarda NULL e volta a
   * usar o texto do código, o que faz melhoria no padrão chegar sem ninguém editar.
   */
  async function salvar(qual: Qual, valor: string | null) {
    setSalvando(qual)
    try {
      const campo =
        qual === 'busca' ? 'searchPrompt'
          : qual === 'email' ? 'emailPrompt'
            : 'peoplePrompt'
      const { data } = await api.put<{ config: Config }>(`${BASE}/config`, { [campo]: valor })
      aplicar(data.config)
      toast.success(valor === null ? 'Prompt restaurado para o padrão.' : 'Prompt salvo.')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar o prompt.'))
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prompts do agente</h1>
        <p className="text-muted-foreground text-sm">
          O que o agente manda para a IA na busca e na redação do e-mail
        </p>
      </div>

      <NavAgente />

      {erro ? (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />{erro}
        </div>
      ) : loading || !config ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex gap-3 rounded-md border bg-muted/40 px-4 py-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-muted-foreground">
              <p>
                Cada prompt tem duas partes. A de cima é sua: tom de voz, região, sites,
                tamanho do texto, o que valorizar. A de baixo é fixa e o servidor cola
                sempre — é o que garante trecho literal com fonte na busca, e e-mail sem
                link nem assinatura inventada.
              </p>
              <p>
                Mudança no prompt vale a partir da próxima execução. Os achados e
                rascunhos que já estão no painel não mudam.
              </p>
            </div>
          </div>

          {/* Backend sem os campos de prompt: acontece na janela entre o deploy do
              backend e o do frontend. Sem esta guarda a aba quebraria em branco. */}
          {typeof config.searchPromptPadrao !== 'string' ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Esta tela precisa de uma versão mais nova do servidor. Recarregue em alguns
              minutos; se continuar, o deploy do backend ainda não subiu.
            </div>
          ) : (
          <>
          <CardPrompt
            id="busca"
            titulo="Prompt da busca"
            descricao="Vai para a OpenAI junto com a ferramenta de busca na web. É ele que define onde procurar, em que idiomas e o que conta como reclamação."
            valor={textoBusca}
            salvo={config.searchPrompt}
            padrao={config.searchPromptPadrao}
            personalizado={config.searchPromptPersonalizado}
            blocoFixo={config.searchPromptFixo}
            explicacaoFixo="Define o que a resposta precisa trazer para o achado poder ser conferido na página de origem: nome, URL exata e o trecho copiado literalmente. Sem isso, não há o que verificar — e achado não verificado é descartado."
            variaveis={config.variaveisBusca}
            salvando={salvando === 'busca'}
            bloqueado={salvando !== null}
            onChange={setTextoBusca}
            onSalvar={() => salvar('busca', textoBusca)}
            onRestaurar={() => salvar('busca', null)}
          />

          <CardPrompt
            id="email"
            titulo="Prompt do e-mail"
            descricao="Escreve o assunto e o corpo do rascunho de cada achado. É aqui que se ajusta tom de voz, personalidade, tamanho e o que oferecer."
            valor={textoEmail}
            salvo={config.emailPrompt}
            padrao={config.emailPromptPadrao}
            personalizado={config.emailPromptPersonalizado}
            blocoFixo={config.emailPromptFixo}
            explicacaoFixo="O link de contato, a identificação da Storm e o descadastro são adicionados na hora do envio. Se o modelo também escrevesse os dele, o e-mail sairia com dois — por isso essa parte não é editável."
            variaveis={config.variaveisEmail}
            salvando={salvando === 'email'}
            bloqueado={salvando !== null}
            onChange={setTextoEmail}
            onSalvar={() => salvar('email', textoEmail)}
            onRestaurar={() => salvar('email', null)}
          />

          {/* O card de pessoas chegou depois dos outros dois: num servidor que ainda
              nao subiu, `peoplePromptPadrao` vem undefined e o card renderizaria vazio.
              A guarda e por campo, e nao a do topo, porque `searchPromptPadrao` JA
              existe no servidor antigo — aquela guarda nao pegaria este caso. */}
          {typeof config.peoplePromptPadrao === 'string' && (
          <CardPrompt
            id="pessoas"
            titulo="Prompt das pessoas-chave"
            descricao="Procura dono, gerência e RH do estabelecimento em fontes públicas. É disparado por quem clica em Pessoas na tela de Estabelecimentos, e é aqui que se escolhe onde procurar."
            valor={textoPessoas}
            salvo={config.peoplePrompt}
            padrao={config.peoplePromptPadrao}
            personalizado={config.peoplePromptPersonalizado}
            blocoFixo={config.peoplePromptFixo}
            explicacaoFixo="Três garantias que não dá para afrouxar: trecho literal com a URL onde o nome aparece; nunca montar e-mail a partir do nome e do domínio (endereço inventado volta como bounce e queima a reputação do nosso envio); e limite de coleta — só nome, cargo, e-mail profissional e perfil público."
            variaveis={config.variaveisPessoas}
            salvando={salvando === 'pessoas'}
            bloqueado={salvando !== null}
            onChange={setTextoPessoas}
            onSalvar={() => salvar('pessoas', textoPessoas)}
            onRestaurar={() => salvar('pessoas', null)}
          />
          )}
          </>
          )}

          <p className="text-xs text-muted-foreground">
            As duas buscas têm uma chamada a mais à IA, que só converte o resultado em
            dados e não aceita prompt: ela não decide nada de conteúdo e trabalha restrita
            às páginas que a busca citou de fato.
          </p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Um prompt: a caixa editável, as variáveis que ele pode usar, o bloco fixo em leitura
 * e a prévia do texto completo.
 *
 * É componente separado porque o diálogo de prévia tem estado próprio — duas instâncias
 * na mesma tela não podem disputar um único `open`.
 */
function CardPrompt(props: {
  id: string
  titulo: string
  descricao: string
  valor: string
  salvo: string
  padrao: string
  personalizado: boolean
  blocoFixo: string
  explicacaoFixo: string
  variaveis: VariavelPrompt[]
  salvando: boolean
  bloqueado: boolean
  onChange: (v: string) => void
  onSalvar: () => void
  onRestaurar: () => void
}) {
  const [verPrevia, setVerPrevia] = useState(false)

  const sujo = props.valor.trim() !== props.salvo.trim()
  const ehOPadrao = props.valor.trim() === props.padrao.trim()
  const vazio = !props.valor.trim()

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{props.titulo}</CardTitle>
          <Badge variant={props.personalizado ? 'default' : 'outline'}>
            {props.personalizado ? 'personalizado' : 'padrão'}
          </Badge>
          {sujo && <Badge variant="outline" className="text-amber-600">não salvo</Badge>}
        </div>
        <CardDescription>{props.descricao}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`prompt-${props.id}`}>Parte editável</Label>
          <Textarea
            id={`prompt-${props.id}`}
            value={props.valor}
            onChange={(e) => props.onChange(e.target.value)}
            rows={16}
            spellCheck={false}
            className="font-mono text-[13px] leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            {props.valor.length} caracteres (máximo 8000).{' '}
            {vazio
              ? 'Em branco, o agente volta a usar o prompt padrão.'
              : ehOPadrao
                ? 'Igual ao padrão.'
                : 'Diferente do padrão.'}
          </p>
        </div>

        <div className="space-y-2 rounded-md border px-4 py-3">
          <p className="text-sm font-medium">Variáveis</p>
          <p className="text-xs text-muted-foreground">
            O servidor troca cada uma pelo valor real antes de enviar. Uma linha cujas
            variáveis todas ficarem vazias é removida — por isso{' '}
            <code className="font-mono">Cidade: {'{{cidade}}'}</code> simplesmente
            desaparece quando a cidade é desconhecida.
          </p>
          <dl className="mt-2 space-y-1.5">
            {(props.variaveis ?? []).map((v) => (
              <div key={v.nome} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 sm:w-44">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {`{{${v.nome}}}`}
                  </code>
                  {v.obrigatoria && (
                    <span className="ml-1.5 text-xs text-muted-foreground">obrigatória</span>
                  )}
                </dt>
                <dd className="text-xs text-muted-foreground">{v.descricao}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* `details` nativo: o repositório não tem componente de colapso, e o bloco
            fixo é informação de consulta — não precisa ocupar a tela toda o tempo. */}
        <details className="rounded-md border bg-muted/30 px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Regras fixas — o servidor cola isto no final
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">{props.explicacaoFixo}</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
            {props.blocoFixo}
          </pre>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setVerPrevia(true)} disabled={props.bloqueado}>
              <Eye className="h-4 w-4 mr-2" />
              Ver o prompt completo
            </Button>
            <Button
              variant="outline"
              onClick={props.onRestaurar}
              disabled={props.bloqueado || (!props.personalizado && ehOPadrao)}
              title={
                props.personalizado || !ehOPadrao
                  ? 'Descarta o texto personalizado e volta ao prompt padrão'
                  : 'Já está no padrão'
              }
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar padrão
            </Button>
          </div>
          <Button onClick={props.onSalvar} disabled={props.bloqueado || !sujo}>
            {props.salvando
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Save className="h-4 w-4 mr-2" />}
            Salvar prompt
          </Button>
        </div>
      </CardContent>

      {/* Prévia: a parte editável mais o bloco fixo, exatamente na ordem em que o
          servidor monta. As variáveis aparecem sem substituir, porque os valores só
          existem no momento de cada busca. */}
      <Dialog open={verPrevia} onOpenChange={setVerPrevia}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{props.titulo} — texto completo</DialogTitle>
            <DialogDescription>
              É isto que vai para a OpenAI, nesta ordem, com as variáveis já trocadas
              pelos valores de cada achado.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed">
            {`${(props.valor.trim() || props.padrao.trim())}\n\n${props.blocoFixo}`}
          </pre>
          <p className="text-xs text-muted-foreground">
            {vazio && 'Mostrando o prompt padrão, porque a caixa está em branco. '}
            {sujo && !vazio && 'Mostrando o texto da caixa, que ainda não foi salvo.'}
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
