/**
 * Configuração da landing do piloto de inglês para o trade de Goiás (Sebrae + ABIH,
 * powered by Storm). Tudo que depende de material externo fica aqui.
 */

export const ROTAS = {
  landing: '/piloto-ingles-goias',
  formulario: '/piloto-ingles-goias#cadastro',
  sobre: '/piloto-ingles-goias#sobre',
  /** Aviso "confirme seu e-mail", logo após o envio do formulário. */
  confirmeEmail: '/piloto-ingles-goias/confirme-seu-email',
  /** Destino do link enviado por e-mail: /confirmar?token=... */
  confirmar: '/piloto-ingles-goias/confirmar',
  agradecimento: '/piloto-ingles-goias/obrigado',
  politicaPrivacidade: '/piloto-ingles-goias/politica-de-privacidade',
} as const

export type Marca = {
  nome: string
  /** Arquivo oficial em /public. */
  src: string
  width: number
  height: number
  /**
   * Exibe sobre um selo branco. Usado nas marcas que só existem em versão colorida
   * para fundo claro (a ABIH não publica versão negativa), já que o cabeçalho é marinho.
   */
  selo: boolean
}

// Arquivos baixados dos sites oficiais em 09/10/2026, sem alteração de arte:
// - Sebrae: sebrae.com.br/content/dam/portal-sebrae/na/pt/imagens/logo/logo-sebrae.svg
// - ABIH: logo do cabeçalho de abih.com.br (PNG), recortado para só o símbolo (letras e faixa
//   azul), sem o texto "Associação Brasileira da Indústria de Hotéis – Nacional" embaixo.
// Se a coordenação do piloto enviar arquivos do manual de marca, basta substituí-los.
export const MARCAS: Record<'sebrae' | 'abih' | 'storm', Marca> = {
  sebrae: { nome: 'Sebrae', src: '/piloto-ingles-goias/logo-sebrae.svg', width: 75, height: 40, selo: true },
  abih: {
    nome: 'ABIH – Associação Brasileira da Indústria de Hotéis',
    src: '/piloto-ingles-goias/logo-abih-simbolo.png',
    width: 560,
    height: 225,
    selo: true,
  },
  storm: { nome: 'Storm', src: '/logo-storm.svg', width: 86, height: 26, selo: false },
}

/** Política de privacidade do cadastro. Interna; troque por uma URL externa se a política for publicada em outro lugar. */
export const POLITICA_PRIVACIDADE_URL: string = ROTAS.politicaPrivacidade

/**
 * Encerramento das inscrições.
 *
 * Com `encerradas: true`, a landing deixa de oferecer o formulário e passa a exibir o aviso.
 * A rota de confirmação (`/confirmar?token=…`) **continua funcionando**: quem já se cadastrou e
 * ainda não clicou no link do e-mail precisa conseguir concluir, senão o encerramento descarta
 * cadastros que já estavam no funil.
 *
 * Para reabrir, basta voltar `encerradas` para false.
 */
export const INSCRICOES = {
  encerradas: true,
  /** Data em que as inscrições foram encerradas, como o visitante deve ler. */
  encerradasEm: '28 de outubro de 2026',
  titulo: 'As inscrições foram encerradas',
  mensagem:
    'O prazo de cadastro para o plano de capacitação em inglês do trade de Goiás terminou em '
    + '28 de outubro de 2026. Os hotéis inscritos serão contatados pela coordenação do programa '
    + 'pelo e-mail informado no cadastro.',
  /** Quem já recebeu o e-mail e ainda não confirmou continua podendo concluir. */
  avisoConfirmacaoPendente:
    'Se você se cadastrou e ainda não confirmou seu e-mail, o link enviado continua válido até o '
    + 'prazo indicado na mensagem que você recebeu.',
} as const
