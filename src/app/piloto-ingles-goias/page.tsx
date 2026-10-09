import Link from 'next/link'
import { Building2, ClipboardList, GraduationCap, MailCheck, PhoneCall } from 'lucide-react'
import { ROTAS } from './_lib/config'
import { FormularioCadastro } from './_components/formulario-cadastro'

const SOBRE = [
  {
    icone: Building2,
    titulo: 'Para quem é',
    texto: 'Hotéis associados à ABIH-GO interessados em participar do plano de capacitação em inglês.',
  },
  {
    icone: GraduationCap,
    titulo: 'Metodologia',
    texto: 'A capacitação das equipes vai seguir a metodologia exclusiva da Storm Education, 100% via WhatsApp.',
  },
]

// Fluxo do cadastro — é o que o produto faz de fato, sem detalhes do programa que ainda não foram definidos.
const PASSOS = [
  { icone: ClipboardList, titulo: 'Preencha o cadastro', texto: 'Informe os dados do hotel e da pessoa responsável.' },
  { icone: MailCheck, titulo: 'Confirme seu e-mail', texto: 'Clique no link que enviaremos para concluir o cadastro.' },
  { icone: PhoneCall, titulo: 'Aguarde o contato', texto: 'A equipe do plano de capacitação entrará em contato com o hotel.' },
]

export default function PilotoInglesGoiasPage() {
  return (
    <>
      {/* Seção principal */}
      <section aria-labelledby="titulo-principal" className="bg-abih-marinho text-white">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
          <p className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 font-display text-base font-bold uppercase tracking-wider text-white sm:px-5 sm:py-2 sm:text-lg">
            Sebrae + ABIH
          </p>
          <h1
            id="titulo-principal"
            className="mt-5 max-w-3xl font-display text-3xl font-extrabold leading-tight text-balance sm:text-5xl"
          >
            Seu hotel pode participar gratuitamente do plano de capacitação em inglês para o trade turístico de Goiás
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/85">
            Este cadastro é destinado a hotéis de Goiás interessados em participar do plano de capacitação
            em inglês para o trade de turismo e hospitalidade.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={ROTAS.formulario}
              className="inline-flex h-12 items-center justify-center rounded-full bg-abih-azul px-8 text-base font-semibold text-white transition-colors hover:bg-abih-azul-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Cadastrar meu hotel
            </Link>
            <Link
              href={ROTAS.sobre}
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-8 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Saber mais
            </Link>
          </div>
        </div>
      </section>

      {/* Sobre o plano de capacitação */}
      <section id="sobre" aria-labelledby="titulo-sobre" className="scroll-mt-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="titulo-sobre" className="font-display text-2xl font-bold text-abih-marinho sm:text-3xl">
            Sobre o plano de capacitação
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Uma iniciativa de capacitação em inglês para o setor de turismo e hospitalidade em Goiás,
            realizada pelo Sebrae e pela ABIH com a metodologia de ensino Storm Education.
          </p>
          <ul className="mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
            {SOBRE.map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="rounded-2xl border bg-card p-6 shadow-sm">
                <span aria-hidden className="flex size-11 items-center justify-center rounded-xl bg-accent text-abih-azul">
                  <Icone className="size-6" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-abih-marinho">{titulo}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{texto}</p>
              </li>
            ))}
          </ul>

          <h3 className="mt-16 font-display text-xl font-bold text-abih-marinho">Como funciona o cadastro</h3>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {PASSOS.map(({ icone: Icone, titulo, texto }, i) => (
              <li key={titulo} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-abih-marinho font-display font-bold text-white"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="flex items-center gap-2 font-semibold text-foreground">
                    <Icone aria-hidden className="size-4 text-abih-azul" />
                    <span>
                      <span className="sr-only">Passo {i + 1}: </span>
                      {titulo}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Formulário */}
      <section
        id="cadastro"
        aria-labelledby="titulo-cadastro"
        className="scroll-mt-4 bg-muted px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="mx-auto max-w-3xl">
          <h2 id="titulo-cadastro" className="font-display text-2xl font-bold text-abih-marinho sm:text-3xl">
            Cadastro do hotel
          </h2>
          <p className="mt-3 text-muted-foreground">
            Preencha os dados abaixo para registrar o interesse do seu hotel em participar do plano de capacitação.
          </p>
          <div className="mt-8 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
            <FormularioCadastro />
          </div>
        </div>
      </section>
    </>
  )
}
