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
// - ABIH: logo do cabeçalho de abih.com.br (PNG), só com as margens brancas recortadas.
// Se a coordenação do piloto enviar arquivos do manual de marca, basta substituí-los.
export const MARCAS: Record<'sebrae' | 'abih' | 'storm', Marca> = {
  sebrae: { nome: 'Sebrae', src: '/piloto-ingles-goias/logo-sebrae.svg', width: 75, height: 40, selo: true },
  abih: {
    nome: 'ABIH – Associação Brasileira da Indústria de Hotéis',
    src: '/piloto-ingles-goias/logo-abih.png',
    width: 640,
    height: 288,
    selo: true,
  },
  storm: { nome: 'Storm', src: '/logo-storm.svg', width: 86, height: 26, selo: false },
}

/** Política de privacidade do cadastro. Interna; troque por uma URL externa se a política for publicada em outro lugar. */
export const POLITICA_PRIVACIDADE_URL: string = ROTAS.politicaPrivacidade
