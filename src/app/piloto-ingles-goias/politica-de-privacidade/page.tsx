import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ROTAS } from '../_lib/config'

export const metadata: Metadata = {
  title: 'Política de Privacidade · Plano de capacitação em inglês para o trade de Goiás',
  description:
    'Como os dados do cadastro de hotéis no plano de capacitação em inglês (Sebrae + ABIH, powered by Storm) são tratados, conforme a LGPD.',
}

/*
 * Política específica do cadastro de hotéis do piloto. Os dados da Storm (razão social,
 * CNPJ, sede, canais de atendimento e do encarregado) vêm da Política de Privacidade geral
 * da Storm Education, atualizada em 08/08/2025.
 *
 * REVISAR COM O JURÍDICO antes de publicar:
 *  - papéis na LGPD: aqui a Storm é a controladora e o Sebrae e a ABIH recebem os dados como
 *    instituições realizadoras. Se o acordo do piloto definir controladoria conjunta, ajustar
 *    as seções 1 e 5;
 *  - prazo de retenção depois do piloto (seção 7);
 *  - o que está escrito sobre registros e descarte (seções 2 e 7) é o que o backend faz:
 *    dashboard/src/services/pilotoGoias.service.ts grava data, hora e IP do envio e da
 *    confirmação e apaga envios não confirmados após 48h. Mudou lá, mude aqui.
 */

const ATUALIZACAO = '9 de outubro de 2026'

const SECOES = [
  { id: 'quem-somos', titulo: '1. Quem somos e a quem esta Política se aplica' },
  { id: 'dados', titulo: '2. Quais dados coletamos' },
  { id: 'finalidades', titulo: '3. Para que usamos os dados' },
  { id: 'bases-legais', titulo: '4. Bases legais' },
  { id: 'compartilhamento', titulo: '5. Com quem compartilhamos' },
  { id: 'transferencia', titulo: '6. Transferência internacional' },
  { id: 'retencao', titulo: '7. Por quanto tempo guardamos os dados' },
  { id: 'seguranca', titulo: '8. Como protegemos os dados' },
  { id: 'direitos', titulo: '9. Seus direitos' },
  { id: 'cookies', titulo: '10. Cookies e rastreamento' },
  { id: 'alteracoes', titulo: '11. Alterações desta Política' },
  { id: 'contato', titulo: '12. Contato e encarregado de dados' },
] as const

function Secao({ id, children }: { id: (typeof SECOES)[number]['id']; children: ReactNode }) {
  const titulo = SECOES.find((s) => s.id === id)!.titulo
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-6 space-y-4">
      <h2 id={`${id}-titulo`} className="font-display text-xl font-bold text-abih-marinho sm:text-2xl">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function Email({ endereco }: { endereco: string }) {
  return (
    <a href={`mailto:${endereco}`} className="font-semibold text-abih-azul underline underline-offset-2 break-all">
      {endereco}
    </a>
  )
}

export default function PoliticaPrivacidadePage() {
  return (
    <article className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="border-b pb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-abih-azul">
            Plano de capacitação em inglês para o trade de Goiás
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-abih-marinho sm:text-4xl">
            Política de Privacidade do cadastro de hotéis
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Última atualização: {ATUALIZACAO}</p>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Esta Política explica, de forma simples, quais dados pedimos no cadastro de hotéis interessados no
            plano de capacitação em inglês para o trade de turismo e hospitalidade de Goiás, para que os usamos,
            com quem os compartilhamos e como você pode exercer seus direitos, conforme a Lei Geral de Proteção
            de Dados (Lei nº 13.709/2018, “LGPD”).
          </p>
        </header>

        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-abih-marinho">Resumo</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
            <li>Pedimos apenas os dados necessários para avaliar a participação do hotel no plano de capacitação e entrar em contato.</li>
            <li>O cadastro só é efetivado depois que você confirma o e-mail informado.</li>
            <li>Os dados são compartilhados com o Sebrae e a ABIH, que realizam o plano de capacitação, e com fornecedores que operam o serviço.</li>
            <li>Não vendemos seus dados e não os usamos para publicidade.</li>
            <li>Você pode acessar, corrigir ou pedir a exclusão dos seus dados e revogar o consentimento a qualquer momento.</li>
          </ul>
        </div>

        <nav aria-labelledby="indice-titulo" className="mt-8">
          <h2 id="indice-titulo" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Nesta página
          </h2>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {SECOES.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-abih-azul underline-offset-2 hover:underline">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-12 leading-relaxed text-foreground/90 [&_li]:leading-relaxed">
          <Secao id="quem-somos">
            <p>
              O plano de capacitação é uma parceria entre o <strong>Sebrae</strong> e a <strong>ABIH</strong> (Associação
              Brasileira da Indústria de Hotéis), com a plataforma da <strong>Storm Education</strong>.
            </p>
            <p>
              O cadastro é coletado e operado pela <strong>Storm Education</strong> (“Storm”, “nós”), empresa
              brasileira de tecnologia educacional, inscrita no CNPJ sob o nº 47.836.164/0001-17, com sede em
              Curitiba/PR. Para os fins da LGPD, a Storm é a <strong>controladora</strong> dos dados pessoais
              informados neste cadastro.
            </p>
            <p>
              Esta Política vale para a página do plano de capacitação e para o formulário de cadastro de hotéis. O uso da
              plataforma de ensino da Storm por participantes é regido pela Política de Privacidade geral da Storm.
            </p>
          </Secao>

          <Secao id="dados">
            <p>Coletamos somente o que você informa no formulário e os registros técnicos do envio:</p>
            <dl className="space-y-4">
              <div>
                <dt className="font-semibold">Dados do hotel</dt>
                <dd className="text-muted-foreground">
                  Nome do hotel, CNPJ, endereço (CEP, logradouro, número, complemento, bairro, município e estado)
                  e número de funcionários.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Dados da pessoa responsável pelo cadastro</dt>
                <dd className="text-muted-foreground">Nome completo, e-mail, telefone celular e cargo no hotel.</dd>
              </div>
              <div>
                <dt className="font-semibold">Registros do cadastro</dt>
                <dd className="text-muted-foreground">
                  Data e hora do envio, do aceite desta Política e da confirmação do e-mail, e o endereço IP de onde
                  foram feitos — necessários para comprovar o consentimento e prevenir cadastros fraudulentos.
                </dd>
              </div>
            </dl>
            <p>
              Não pedimos dados pessoais sensíveis (como origem racial, saúde ou religião) nem documentos pessoais
              como CPF. Os dados do hotel são, em geral, dados da empresa; tratamos todos com o mesmo cuidado.
            </p>
          </Secao>

          <Secao id="finalidades">
            <p>Usamos os dados para:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>confirmar o e-mail informado e efetivar o cadastro;</li>
              <li>avaliar o interesse e a participação do hotel no plano de capacitação;</li>
              <li>entrar em contato com a pessoa responsável sobre o plano de capacitação;</li>
              <li>organizar e acompanhar o plano de capacitação junto ao Sebrae e à ABIH;</li>
              <li>manter a segurança do formulário e prevenir fraudes e cadastros duplicados;</li>
              <li>cumprir obrigações legais e defender direitos em processos, quando necessário.</li>
            </ol>
            <p>
              Não usamos os dados do cadastro para publicidade de terceiros e <strong>não vendemos</strong> dados
              pessoais. Qualquer uso para finalidade diferente das listadas dependerá de nova informação e, quando a
              lei exigir, de novo consentimento.
            </p>
          </Secao>

          <Secao id="bases-legais">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Consentimento</strong> (art. 7º, I, da LGPD): dado ao marcar a caixa de autorização e
                confirmado pelo link enviado ao seu e-mail. Base para o cadastro, o contato e o compartilhamento com
                as instituições realizadoras.
              </li>
              <li>
                <strong>Cumprimento de obrigação legal ou regulatória</strong> (art. 7º, II): para guardar registros
                quando a lei exigir.
              </li>
              <li>
                <strong>Exercício regular de direitos</strong> (art. 7º, VI): para defesa em processos judiciais,
                administrativos ou arbitrais.
              </li>
              <li>
                <strong>Legítimo interesse</strong> (art. 7º, IX): para a segurança do formulário e a prevenção de
                fraudes, sempre respeitando seus direitos e expectativas.
              </li>
            </ul>
          </Secao>

          <Secao id="compartilhamento">
            <p>Os dados podem ser compartilhados com:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Sebrae e ABIH</strong>, instituições realizadoras do plano de capacitação, para organizar, acompanhar e
                avaliar o programa e entrar em contato com os hotéis participantes;
              </li>
              <li>
                <strong>fornecedores que operam o serviço em nosso nome</strong>, como hospedagem em nuvem e envio de
                e-mails, que só podem tratar os dados conforme nossas instruções e com obrigações de
                confidencialidade e segurança;
              </li>
              <li>
                <strong>ViaCEP</strong>, serviço público de consulta de endereços: ao digitar o CEP, seu navegador
                consulta esse serviço para sugerir o endereço. Somente o CEP é enviado;
              </li>
              <li>
                <strong>autoridades públicas</strong>, quando houver obrigação legal ou ordem judicial.
              </li>
            </ul>
          </Secao>

          <Secao id="transferencia">
            <p>
              Alguns dos serviços de tecnologia que usamos, como a hospedagem em nuvem, podem armazenar dados fora do
              Brasil. Nesses casos, a transferência segue o que a LGPD determina (arts. 33 a 36), com fornecedores
              que oferecem garantias adequadas de proteção.
            </p>
          </Secao>

          <Secao id="retencao">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Cadastros não confirmados:</strong> se o e-mail não for confirmado, o cadastro não é efetivado
                e os dados enviados são descartados.
              </li>
              <li>
                <strong>Cadastros confirmados:</strong> guardamos os dados enquanto forem necessários para o plano de capacitação e
                seu acompanhamento, ou até você pedir a exclusão.
              </li>
              <li>
                Depois disso, os dados são excluídos ou anonimizados, exceto quando a lei exigir sua guarda por mais
                tempo ou forem necessários para o exercício regular de direitos.
              </li>
            </ul>
          </Secao>

          <Secao id="seguranca">
            <p>
              Adotamos medidas técnicas e administrativas para proteger os dados, como criptografia, controle de
              acesso restrito a pessoas autorizadas com autenticação em duas etapas, cópias de
              segurança e treinamento da equipe. Se ocorrer um incidente de segurança que possa gerar risco ou dano
              relevante, comunicaremos os titulares afetados e a Autoridade Nacional de Proteção de Dados (ANPD),
              conforme a LGPD.
            </p>
          </Secao>

          <Secao id="direitos">
            <p>Conforme o art. 18 da LGPD, você pode, a qualquer momento:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>confirmar se tratamos seus dados e acessá-los;</li>
              <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
              <li>pedir a portabilidade dos dados a outro fornecedor;</li>
              <li>pedir a eliminação dos dados tratados com base no seu consentimento;</li>
              <li>saber com quais entidades compartilhamos seus dados;</li>
              <li>ser informado sobre a possibilidade de não consentir e suas consequências;</li>
              <li>
                <strong>revogar o consentimento</strong>. A revogação não afeta o que foi feito antes dela, mas
                impede a continuidade da participação do hotel no plano de capacitação por meio deste cadastro;
              </li>
              <li>apresentar reclamação à ANPD.</li>
            </ul>
            <p>
              Para exercer seus direitos, escreva para <Email endereco="dpo@stormeducation.com.br" />. Poderemos pedir
              informações para confirmar sua identidade antes de atender ao pedido, para proteger seus próprios dados.
            </p>
          </Secao>

          <Secao id="cookies">
            <p>
              As páginas do plano de capacitação não usam cookies de publicidade nem ferramentas de rastreamento ou análise de
              terceiros. O navegador pode guardar preferências técnicas de exibição, que não identificam você.
            </p>
          </Secao>

          <Secao id="alteracoes">
            <p>
              Podemos atualizar esta Política para refletir mudanças no plano de capacitação ou na legislação. A data da última
              atualização fica no topo da página. Se a mudança for relevante, avisaremos pelo e-mail cadastrado e,
              quando a lei exigir, pediremos novo consentimento.
            </p>
          </Secao>

          <Secao id="contato">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Encarregado pelo tratamento de dados pessoais (DPO): <Email endereco="dpo@stormeducation.com.br" />
              </li>
              <li>
                Atendimento geral: <Email endereco="hello@stormeducation.com.br" />
              </li>
            </ul>
          </Secao>
        </div>

        <p className="mt-14 border-t pt-8">
          <Link
            href={ROTAS.landing}
            className="font-semibold text-abih-azul underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-abih-azul"
          >
            Voltar à página do plano de capacitação
          </Link>
        </p>
      </div>
    </article>
  )
}
