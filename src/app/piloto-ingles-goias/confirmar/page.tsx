'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, MailX, ServerCrash } from 'lucide-react'
import { ROTAS } from '../_lib/config'
import { comSimulacao, confirmarEmail, modoSimulacao } from '../_lib/cadastro-service'
import { limparFluxo } from '../_lib/rascunho'
import { CartaoStatus, linkBotao } from '../_components/cartao-status'

type Estado = 'verificando' | 'link-invalido' | 'ja-cadastrado' | 'indisponivel'

/**
 * Destino do link enviado por e-mail: /piloto-ingles-goias/confirmar#token=...
 * (o backend põe o token no fragmento; `?token=` também é aceito).
 * Valida o token (ver confirmarEmail em _lib/cadastro-service.ts) e, se der certo,
 * segue para a página de agradecimento.
 */
export default function ConfirmarEmailPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('verificando')
  const token = useRef<string | null>(null)
  const iniciou = useRef(false)

  const confirmar = useCallback(async () => {
    setEstado('verificando')
    if (!token.current) {
      setEstado('link-invalido')
      return
    }
    let resultado
    try {
      resultado = await confirmarEmail(token.current)
    } catch {
      resultado = { status: 'indisponivel' as const }
    }
    if (resultado.status === 'confirmado') {
      limparFluxo()
      router.replace(comSimulacao(ROTAS.agradecimento, modoSimulacao()))
      return
    }
    if (resultado.status === 'ja-cadastrado') limparFluxo()
    setEstado(resultado.status)
  }, [router])

  useEffect(() => {
    // StrictMode roda o efeito duas vezes em dev; o token é de uso único.
    if (iniciou.current) return
    iniciou.current = true

    const params = new URLSearchParams(window.location.search)
    const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    token.current = fragmento.get('token') ?? params.get('token')
    // Tira o token da barra de endereço (histórico, compartilhamento de tela).
    params.delete('token')
    const resto = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${resto ? `?${resto}` : ''}`)

    void confirmar()
  }, [confirmar])

  if (estado === 'verificando') {
    return (
      <CartaoStatus icone={<Loader2 className="animate-spin" />} titulo="Confirmando seu e-mail…">
        <p role="status">Aguarde um instante.</p>
      </CartaoStatus>
    )
  }

  if (estado === 'link-invalido') {
    return (
      <CartaoStatus
        icone={<MailX />}
        tom="erro"
        titulo="Este link de confirmação não é válido"
        acoes={
          <Link href={comSimulacao(ROTAS.formulario, modoSimulacao())} className={linkBotao.primario}>
            Voltar ao cadastro
          </Link>
        }
      >
        <p role="alert">
          O link pode ter expirado ou já ter sido usado. Confira se abriu o link da mensagem mais recente ou
          envie o cadastro novamente.
        </p>
      </CartaoStatus>
    )
  }

  if (estado === 'ja-cadastrado') {
    return (
      <CartaoStatus
        icone={<Building2 />}
        titulo="Este hotel já tem cadastro confirmado"
        acoes={
          <Link href={ROTAS.landing} className={linkBotao.secundario}>
            Voltar à página do plano de capacitação
          </Link>
        }
      >
        <p role="status">
          Seu e-mail foi confirmado, mas já existe um cadastro confirmado para este CNPJ no plano de capacitação. Os dados
          deste novo envio não foram guardados.
        </p>
      </CartaoStatus>
    )
  }

  return (
    <CartaoStatus
      icone={<ServerCrash />}
      tom="erro"
      titulo="Não foi possível confirmar agora"
      acoes={
        <button type="button" onClick={() => void confirmar()} className={linkBotao.primario}>
          Tentar novamente
        </button>
      }
    >
      <p role="alert">
        Seu cadastro ainda não foi confirmado. Tente novamente em alguns minutos ou abra outra vez o link
        recebido por e-mail.
      </p>
    </CartaoStatus>
  )
}
