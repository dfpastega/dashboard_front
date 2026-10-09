import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { ROTAS } from '../_lib/config'
import { CartaoStatus, linkBotao } from '../_components/cartao-status'

export const metadata: Metadata = {
  title: 'Cadastro recebido · Piloto de inglês para o trade de Goiás',
  robots: { index: false },
}

/** Final do fluxo, depois de o e-mail ser confirmado em /confirmar. */
export default function ObrigadoPage() {
  return (
    <CartaoStatus
      icone={<CheckCircle2 />}
      tom="sucesso"
      titulo="Cadastro recebido. Obrigado!"
      acoes={
        <Link href={ROTAS.landing} className={linkBotao.secundario}>
          Voltar à página do piloto
        </Link>
      }
    >
      <p>Seu e-mail foi confirmado e o cadastro do hotel foi recebido.</p>
      <p>
        <strong>A equipe do piloto entrará em contato em breve.</strong>
      </p>
    </CartaoStatus>
  )
}
