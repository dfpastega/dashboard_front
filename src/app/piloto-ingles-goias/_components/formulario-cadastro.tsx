'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { maskCep, maskCnpj, maskPhone } from '@/lib/masks'
import { onlyDigits, UFS } from '@/lib/br-validators'
import { buscarCep, type Endereco } from '@/lib/cep'
import { POLITICA_PRIVACIDADE_URL, ROTAS } from '../_lib/config'
import {
  comSimulacao,
  enviarCadastro,
  modoSimulacao,
  type ResultadoEnvio,
} from '../_lib/cadastro-service'
import { guardarRascunho, lerRascunho, registrarEnvio } from '../_lib/rascunho'
import {
  montarPayload,
  ROTULOS,
  validarCampo,
  validarTudo,
  VALORES_INICIAIS,
  type Campo,
  type ErrosFormulario,
  type ValoresFormulario,
} from '../_lib/validacao'

type EstadoCep = 'ocioso' | 'buscando' | 'preenchido' | 'nao-encontrado' | 'indisponivel'
type FalhaEnvio = { titulo: string; texto: string }

// Turnstile (Cloudflare), igual ao /ativar: só entra quando a chave pública existe. O backend
// exige o token sempre que tiver TURNSTILE_SECRET_KEY — as duas chaves andam juntas.
const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
type Turnstile = {
  render: (
    el: HTMLElement,
    opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void },
  ) => string
  reset: (id?: string) => void
}
const turnstile = () => (window as unknown as { turnstile?: Turnstile }).turnstile

const CAMPOS_ENDERECO = ['logradouro', 'bairro', 'municipio', 'uf'] as const

const MENSAGEM_CEP: Record<Exclude<EstadoCep, 'ocioso'>, string> = {
  buscando: 'Buscando endereço…',
  preenchido: 'Endereço sugerido a partir do CEP. Confira e ajuste se precisar.',
  'nao-encontrado': 'Não encontramos este CEP. Preencha o endereço manualmente.',
  indisponivel: 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.',
}

function falhaPara(
  r: Exclude<ResultadoEnvio, { status: 'confirmacao-pendente' }>,
): FalhaEnvio {
  switch (r.status) {
    case 'dados-invalidos':
      return { titulo: 'Revise os dados do cadastro', texto: r.mensagem }
    case 'limite':
      return { titulo: 'Aguarde para enviar de novo', texto: `${r.mensagem} Seus dados continuam preenchidos.` }
    case 'indisponivel':
      return {
        titulo: 'Não foi possível enviar seu cadastro agora',
        texto: 'Seus dados continuam preenchidos. Verifique sua conexão e tente novamente em alguns minutos.',
      }
  }
}

// dark:bg-white: a landing é sempre clara, mas o Input traz `dark:bg-input/30` do painel.
const classeControle = 'h-11 bg-white dark:bg-white md:text-base'

export function FormularioCadastro() {
  const router = useRouter()

  // Ao voltar da tela "confirme seu e-mail" para corrigir algo, os dados reaparecem.
  const [valores, setValores] = useState<ValoresFormulario>(() => lerRascunho()?.valores ?? VALORES_INICIAIS)
  const [consentimento, setConsentimento] = useState(() => lerRascunho()?.consentimento ?? false)
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [tentouEnviar, setTentouEnviar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<FalhaEnvio | null>(null)
  const [estadoCep, setEstadoCep] = useState<EstadoCep>('ocioso')
  // Incrementa a cada envio barrado/falho; o efeito abaixo move o foco depois do render.
  const [focarAviso, setFocarAviso] = useState<{ alvo: 'resumo' | 'falha'; n: number } | null>(null)

  const enviandoRef = useRef(false)
  const ultimoAutoPreenchimento = useRef<Partial<Endereco>>({})
  const resumoRef = useRef<HTMLDivElement>(null)
  const falhaRef = useRef<HTMLDivElement>(null)
  const captchaEl = useRef<HTMLDivElement>(null)
  const captchaWidget = useRef<string | null>(null)
  const captchaToken = useRef('')

  function renderizarCaptcha() {
    const ts = turnstile()
    if (!TURNSTILE_KEY || !ts || !captchaEl.current || captchaWidget.current !== null) return
    captchaWidget.current = ts.render(captchaEl.current, {
      sitekey: TURNSTILE_KEY,
      callback: (t) => { captchaToken.current = t },
      'expired-callback': () => { captchaToken.current = '' },
    })
  }

  // Navegação client-side: o script pode já estar carregado e o onLoad não dispara de novo.
  useEffect(() => {
    renderizarCaptcha()
  }, [])

  useEffect(() => {
    if (!focarAviso) return
    const el = focarAviso.alvo === 'resumo' ? resumoRef.current : falhaRef.current
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focarAviso])

  function atualizar(campo: Campo, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }))
    // Erro já exibido some assim que o campo fica certo.
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: validarCampo(campo, valor) }))
  }

  function aoSair(campo: Campo) {
    // Não acusa campo vazio só porque a pessoa passou por ele com Tab.
    if (!valores[campo].trim() && !tentouEnviar) return
    setErros((e) => ({ ...e, [campo]: validarCampo(campo, valores[campo]) }))
  }

  // Busca o endereço quando o CEP fica completo.
  const cepDigitos = onlyDigits(valores.cep)
  useEffect(() => {
    if (cepDigitos.length !== 8) {
      setEstadoCep('ocioso')
      return
    }
    const controle = new AbortController()
    setEstadoCep('buscando')
    buscarCep(cepDigitos, controle.signal)
      .then((r) => {
        if (r.status !== 'ok') {
          setEstadoCep(r.status)
          return
        }
        // Só sobrescreve o que está vazio ou ainda é a sugestão anterior — nunca o que a pessoa digitou.
        const anterior = ultimoAutoPreenchimento.current
        ultimoAutoPreenchimento.current = r.endereco
        setValores((v) => {
          const novo = { ...v }
          for (const campo of CAMPOS_ENDERECO) {
            const sugerido = r.endereco[campo]
            if (sugerido && (!v[campo].trim() || v[campo] === anterior[campo])) novo[campo] = sugerido
          }
          return novo
        })
        setErros((e) => {
          const novo = { ...e }
          for (const campo of CAMPOS_ENDERECO) if (r.endereco[campo]) delete novo[campo]
          return novo
        })
        setEstadoCep('preenchido')
      })
      .catch(() => undefined) // cancelado porque o CEP mudou
    return () => controle.abort()
  }, [cepDigitos])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (enviandoRef.current) return

    setTentouEnviar(true)
    setFalha(null)
    const encontrados = validarTudo(valores, consentimento)
    setErros(encontrados)
    if (Object.keys(encontrados).length > 0) {
      setFocarAviso((f) => ({ alvo: 'resumo', n: (f?.n ?? 0) + 1 }))
      return
    }

    if (TURNSTILE_KEY && !captchaToken.current) {
      setFalha({
        titulo: 'Aguarde a verificação de segurança',
        texto: 'A verificação abaixo do formulário ainda não terminou. Aguarde alguns segundos e envie de novo.',
      })
      setFocarAviso((f) => ({ alvo: 'falha', n: (f?.n ?? 0) + 1 }))
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    guardarRascunho(valores, consentimento)

    let resultado: ResultadoEnvio
    try {
      resultado = await enviarCadastro(montarPayload(valores, POLITICA_PRIVACIDADE_URL), captchaToken.current)
    } catch {
      resultado = { status: 'indisponivel' }
    }

    if (resultado.status === 'confirmacao-pendente') {
      // Mantém o botão travado até a troca de tela.
      registrarEnvio(valores.email.trim().toLowerCase())
      router.push(comSimulacao(ROTAS.confirmeEmail, modoSimulacao()))
      return
    }

    enviandoRef.current = false
    setEnviando(false)
    // O token do Turnstile é de uso único: o próximo envio precisa de outro.
    if (TURNSTILE_KEY) {
      captchaToken.current = ''
      turnstile()?.reset(captchaWidget.current ?? undefined)
    }

    // Recusa do servidor apontando campos: mostra junto de cada campo, como os erros locais.
    if (resultado.status === 'dados-invalidos' && Object.keys(resultado.erros).length > 0) {
      setErros(resultado.erros)
      setFocarAviso((f) => ({ alvo: 'resumo', n: (f?.n ?? 0) + 1 }))
      return
    }
    setFalha(falhaPara(resultado))
    setFocarAviso((f) => ({ alvo: 'falha', n: (f?.n ?? 0) + 1 }))
  }

  const listaErros = Object.entries(erros).filter(([, msg]) => msg) as [Campo | 'consentimento', string][]

  return (
    <form noValidate onSubmit={enviar} aria-describedby="aviso-obrigatorios" className="space-y-8">
      <p id="aviso-obrigatorios" className="text-sm text-muted-foreground">
        Campos marcados com <span className="font-bold text-abih-azul">*</span> são obrigatórios.
      </p>

      {tentouEnviar && listaErros.length > 0 && (
        <div
          ref={resumoRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="resumo-erros-titulo"
          className="rounded-xl border-2 border-destructive bg-red-50 p-4 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30"
        >
          <h3 id="resumo-erros-titulo" className="flex items-center gap-2 font-semibold text-destructive">
            <AlertCircle aria-hidden className="size-5 shrink-0" />
            {listaErros.length === 1 ? 'Há 1 campo para corrigir' : `Há ${listaErros.length} campos para corrigir`}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-9 text-sm">
            {listaErros.map(([campo, msg]) => (
              <li key={campo}>
                <a href={`#campo-${campo}`} className="text-destructive underline underline-offset-2">
                  {ROTULOS[campo]}: {msg}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Secao titulo="Dados do hotel">
        <CampoFormulario id="nomeHotel" rotulo="Nome do hotel" erro={erros.nomeHotel} className="sm:col-span-6">
          {(a) => (
            <Input {...a} autoComplete="organization" className={classeControle}
              value={valores.nomeHotel} onChange={(e) => atualizar('nomeHotel', e.target.value)}
              onBlur={() => aoSair('nomeHotel')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="cnpj" rotulo="CNPJ" erro={erros.cnpj} className="sm:col-span-3">
          {(a) => (
            <Input {...a} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              placeholder="00.000.000/0000-00" className={classeControle}
              value={valores.cnpj} onChange={(e) => atualizar('cnpj', maskCnpj(e.target.value))}
              onBlur={() => aoSair('cnpj')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="funcionarios" rotulo="Número de funcionários" erro={erros.funcionarios} className="sm:col-span-3">
          {(a) => (
            <Input {...a} inputMode="numeric" autoComplete="off" placeholder="Ex.: 25" className={classeControle}
              value={valores.funcionarios}
              onChange={(e) => atualizar('funcionarios', e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7))}
              onBlur={() => aoSair('funcionarios')} />
          )}
        </CampoFormulario>

        <CampoFormulario
          id="cep" rotulo="CEP" erro={erros.cep} className="sm:col-span-2"
          extra={
            <p id="campo-cep-busca" aria-live="polite"
              className={cn('flex min-h-5 items-start gap-1.5 text-xs',
                estadoCep === 'preenchido' ? 'text-emerald-700' : 'text-muted-foreground')}>
              {estadoCep === 'buscando' && <Loader2 aria-hidden className="mt-px size-3.5 shrink-0 animate-spin" />}
              {estadoCep === 'preenchido' && <CheckCircle2 aria-hidden className="mt-px size-3.5 shrink-0" />}
              {estadoCep !== 'ocioso' && MENSAGEM_CEP[estadoCep]}
            </p>
          }
          descricaoExtra="campo-cep-busca"
        >
          {(a) => (
            <Input {...a} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000"
              className={classeControle} aria-busy={estadoCep === 'buscando'}
              value={valores.cep} onChange={(e) => atualizar('cep', maskCep(e.target.value))}
              onBlur={() => aoSair('cep')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="logradouro" rotulo="Logradouro" erro={erros.logradouro} className="sm:col-span-4">
          {(a) => (
            <Input {...a} autoComplete="address-line1" placeholder="Rua, avenida…" className={classeControle}
              value={valores.logradouro} onChange={(e) => atualizar('logradouro', e.target.value)}
              onBlur={() => aoSair('logradouro')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="numero" rotulo="Número" erro={erros.numero} className="sm:col-span-2">
          {(a) => (
            <Input {...a} autoComplete="off" placeholder="Ex.: 120 ou S/N" className={classeControle}
              value={valores.numero} onChange={(e) => atualizar('numero', e.target.value.slice(0, 20))}
              onBlur={() => aoSair('numero')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="complemento" rotulo="Complemento" obrigatorio={false} className="sm:col-span-4">
          {(a) => (
            <Input {...a} autoComplete="address-line2" placeholder="Quadra, lote, sala…" className={classeControle}
              value={valores.complemento} onChange={(e) => atualizar('complemento', e.target.value)} />
          )}
        </CampoFormulario>

        <CampoFormulario id="bairro" rotulo="Bairro" erro={erros.bairro} className="sm:col-span-2">
          {(a) => (
            <Input {...a} autoComplete="address-level3" className={classeControle}
              value={valores.bairro} onChange={(e) => atualizar('bairro', e.target.value)}
              onBlur={() => aoSair('bairro')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="municipio" rotulo="Município" erro={erros.municipio} className="sm:col-span-2">
          {(a) => (
            <Input {...a} autoComplete="address-level2" className={classeControle}
              value={valores.municipio} onChange={(e) => atualizar('municipio', e.target.value)}
              onBlur={() => aoSair('municipio')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="uf" rotulo="Estado" erro={erros.uf} className="sm:col-span-2">
          {(a) => (
            <select {...a} autoComplete="address-level1"
              className={cn(
                'border-input flex h-11 w-full rounded-md border bg-white dark:bg-white px-3 text-base shadow-xs outline-none transition-[color,box-shadow]',
                'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                !valores.uf && 'text-muted-foreground',
              )}
              value={valores.uf}
              onChange={(e) => {
                atualizar('uf', e.target.value)
                if (tentouEnviar || erros.uf) setErros((er) => ({ ...er, uf: validarCampo('uf', e.target.value) }))
              }}
              onBlur={() => aoSair('uf')}
            >
              <option value="">Selecione</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf} className="text-foreground">{uf}</option>
              ))}
            </select>
          )}
        </CampoFormulario>
      </Secao>

      <Secao titulo="Dados da pessoa responsável pelo cadastro">
        <CampoFormulario id="nomeResponsavel" rotulo="Nome completo" erro={erros.nomeResponsavel} className="sm:col-span-3">
          {(a) => (
            <Input {...a} autoComplete="name" className={classeControle}
              value={valores.nomeResponsavel} onChange={(e) => atualizar('nomeResponsavel', e.target.value)}
              onBlur={() => aoSair('nomeResponsavel')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="cargo" rotulo="Cargo no hotel" erro={erros.cargo} className="sm:col-span-3">
          {(a) => (
            <Input {...a} autoComplete="organization-title" placeholder="Ex.: Gerente geral" className={classeControle}
              value={valores.cargo} onChange={(e) => atualizar('cargo', e.target.value)}
              onBlur={() => aoSair('cargo')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="email" rotulo="E-mail" erro={erros.email} className="sm:col-span-3"
          dica="Enviaremos um link para confirmar o cadastro.">
          {(a) => (
            <Input {...a} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              placeholder="nome@hotel.com.br" className={classeControle}
              value={valores.email} onChange={(e) => atualizar('email', e.target.value)}
              onBlur={() => aoSair('email')} />
          )}
        </CampoFormulario>

        <CampoFormulario id="celular" rotulo="Telefone celular" erro={erros.celular} className="sm:col-span-3"
          dica="Com DDD.">
          {(a) => (
            <Input {...a} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(62) 91234-5678"
              className={classeControle}
              value={valores.celular} onChange={(e) => atualizar('celular', maskPhone(e.target.value))}
              onBlur={() => aoSair('celular')} />
          )}
        </CampoFormulario>
      </Secao>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <input
            id="campo-consentimento"
            type="checkbox"
            required
            checked={consentimento}
            onChange={(e) => {
              setConsentimento(e.target.checked)
              if (e.target.checked) setErros((er) => ({ ...er, consentimento: undefined }))
            }}
            aria-invalid={erros.consentimento ? true : undefined}
            aria-describedby={erros.consentimento ? 'campo-consentimento-erro' : undefined}
            className="mt-0.5 size-5 shrink-0 cursor-pointer accent-abih-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-abih-azul"
          />
          <label htmlFor="campo-consentimento" className="cursor-pointer text-sm leading-relaxed">
            Autorizo o tratamento dos dados informados neste cadastro para que a equipe do piloto avalie a
            participação do hotel e entre em contato, conforme a{' '}
            {/* Nova aba: navegar para a política nesta aba descartaria o que já foi digitado. */}
            <a
              href={POLITICA_PRIVACIDADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-abih-azul underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-abih-azul"
            >
              Política de Privacidade<span className="sr-only"> (abre em nova aba)</span>
            </a>
            . <span aria-hidden className="font-bold text-abih-azul">*</span>
          </label>
        </div>
        {erros.consentimento && <MensagemErro id="campo-consentimento-erro">{erros.consentimento}</MensagemErro>}
      </div>

      {TURNSTILE_KEY && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onLoad={renderizarCaptcha}
          />
          <div ref={captchaEl} />
        </>
      )}

      {falha && (
        <div
          ref={falhaRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border-2 border-destructive bg-red-50 p-4 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30"
        >
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertCircle aria-hidden className="size-5 shrink-0" />
            {falha.titulo}
          </p>
          <p className="mt-1 pl-7 text-sm text-foreground">{falha.texto}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          size="lg"
          disabled={enviando}
          className="h-12 w-full rounded-full bg-abih-azul px-8 text-base font-semibold text-white hover:bg-abih-azul-escuro focus-visible:ring-abih-azul/40 sm:w-auto"
        >
          {enviando ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Enviando cadastro…
            </>
          ) : (
            'Enviar cadastro'
          )}
        </Button>
        <p className="text-sm text-muted-foreground">
          Depois do envio, confirme seu e-mail para concluir o cadastro.
        </p>
      </div>
      <p role="status" className="sr-only">
        {enviando ? 'Enviando cadastro, aguarde.' : ''}
      </p>
    </form>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-5">
      <legend className="mb-5 w-full border-b pb-3 font-display text-lg font-bold text-abih-marinho">
        {titulo}
      </legend>
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-6">{children}</div>
    </fieldset>
  )
}

type AtributosControle = {
  id: string
  required?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

function CampoFormulario({
  id,
  rotulo,
  obrigatorio = true,
  erro,
  dica,
  extra,
  descricaoExtra,
  className,
  children,
}: {
  id: Campo
  rotulo: string
  obrigatorio?: boolean
  erro?: string
  dica?: string
  extra?: ReactNode
  descricaoExtra?: string
  className?: string
  children: (atributos: AtributosControle) => ReactNode
}) {
  const idControle = `campo-${id}`
  const descricoes = [
    dica && `${idControle}-dica`,
    descricaoExtra,
    erro && `${idControle}-erro`,
  ].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={idControle} className="text-sm font-semibold leading-snug">
        {rotulo}
        {obrigatorio ? (
          <span aria-hidden className="ml-0.5 font-bold text-abih-azul">*</span>
        ) : (
          <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
        )}
      </Label>
      {children({
        id: idControle,
        required: obrigatorio || undefined,
        'aria-invalid': erro ? true : undefined,
        'aria-describedby': descricoes || undefined,
      })}
      {dica && (
        <p id={`${idControle}-dica`} className="text-xs text-muted-foreground">
          {dica}
        </p>
      )}
      {extra}
      {erro && <MensagemErro id={`${idControle}-erro`}>{erro}</MensagemErro>}
    </div>
  )
}

function MensagemErro({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-destructive">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="sr-only">Erro: </span>
        {children}
      </span>
    </p>
  )
}
