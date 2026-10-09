'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { ROTAS } from '../_lib/config'
import { comSimulacao, modoSimulacao, type ModoSimulacao } from '../_lib/cadastro-service'
import { emailDoUltimoEnvio } from '../_lib/rascunho'
import { CartaoStatus, linkBotao } from '../_components/cartao-status'

/** Logo após o envio: o cadastro fica pendente até a pessoa clicar no link do e-mail. */
export default function ConfirmeSeuEmailPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [simulacao, setSimulacao] = useState<ModoSimulacao>(null)

  // O e-mail vem só da memória da aba (nunca da URL); ao recarregar, cai no texto genérico.
  useEffect(() => {
    setEmail(emailDoUltimoEnvio())
    setSimulacao(modoSimulacao())
  }, [])

  return (
    <CartaoStatus
      icone={<MailCheck />}
      titulo="Confirme seu e-mail para concluir o cadastro"
      acoes={
        <>
          <Link href={comSimulacao(ROTAS.formulario, simulacao)} className={linkBotao.secundario}>
            Corrigir dados do cadastro
          </Link>
          {simulacao && (
            <Link
              href={`${ROTAS.confirmar}?token=pre-visualizacao&simular=${simulacao}`}
              className={linkBotao.primario}
            >
              Simular clique no link do e-mail
            </Link>
          )}
        </>
      }
    >
      {email ? (
        <p>
          Enviamos uma mensagem para <strong className="break-all">{email}</strong>.
        </p>
      ) : (
        <p>Se você acabou de enviar o cadastro, enviamos uma mensagem para o e-mail informado.</p>
      )}
      <p>
        Abra o e-mail e clique no link de confirmação. <strong>O cadastro só é concluído depois dessa confirmação.</strong>
      </p>
      <p className="text-sm">Não encontrou a mensagem? Verifique as pastas de spam e lixo eletrônico.</p>
    </CartaoStatus>
  )
}
