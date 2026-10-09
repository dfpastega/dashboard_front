/**
 * Integração do cadastro de hotéis com o backend (repositório `dashboard`,
 * rotas em src/routes/pilotoGoias.routes.ts).
 *
 *   1. enviarCadastro()  → POST /api/piloto-goias/cadastros
 *                          o backend guarda o envio como PENDENTE e manda o e-mail com
 *                          o link ROTAS.confirmar#token=... (token no fragmento, que não
 *                          vai para servidor nem Referer).
 *   2. confirmarEmail()  → POST /api/piloto-goias/cadastros/confirmar
 *                          consome o token (uso único) e só então grava o cadastro.
 *   3. a tela redireciona para ROTAS.agradecimento.
 *
 * Pré-visualização: fora de produção, `?simular=sucesso` ou `?simular=erro` na URL
 * percorre as telas sem chamar a API. As páginas exibem uma faixa avisando que é
 * simulação e que nenhum dado foi enviado.
 */

import type { Campo } from './validacao'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

export type DadosCadastro = {
  hotel: {
    nome: string
    /** Só caracteres significativos, sem máscara (pode ter letras: CNPJ alfanumérico). */
    cnpj: string
    endereco: {
      cep: string
      logradouro: string
      numero: string
      complemento: string | null
      bairro: string
      municipio: string
      uf: string
    }
    numeroFuncionarios: number
  }
  responsavel: {
    nome: string
    email: string
    /** 11 dígitos, sem máscara. */
    celular: string
    cargo: string
  }
  consentimento: {
    aceito: true
    /** Informativo: o backend grava a versão da Política que ele conhece (POLICY_VERSION). */
    politicaUrl: string | null
  }
}

export type ErrosServidor = Partial<Record<Campo | 'consentimento', string>>

export type ResultadoEnvio =
  | { status: 'confirmacao-pendente' }
  /** `erros` vem por campo quando o backend recusou algo que o front deixou passar. */
  | { status: 'dados-invalidos'; mensagem: string; erros: ErrosServidor }
  | { status: 'limite'; mensagem: string }
  | { status: 'indisponivel' }

export type ResultadoConfirmacao =
  | { status: 'confirmado' }
  /** E-mail confirmado, mas o CNPJ já tinha cadastro: os dados novos não foram guardados. */
  | { status: 'ja-cadastrado' }
  | { status: 'link-invalido' }
  | { status: 'indisponivel' }

export type ModoSimulacao = 'sucesso' | 'erro' | null

/** Só lê `?simular=` fora de produção; em produção é sempre `null`. */
export function modoSimulacao(): ModoSimulacao {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('simular')
  return v === 'sucesso' || v === 'erro' ? v : null
}

/** Mantém `?simular=` ao navegar entre as telas durante a pré-visualização. */
export function comSimulacao(rota: string, modo: ModoSimulacao): string {
  if (!modo) return rota
  const [caminho, hash] = rota.split('#')
  return `${caminho}?simular=${modo}${hash ? `#${hash}` : ''}`
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Caminho do erro no backend (Zod) → campo do formulário.
const CAMPO_DO_SERVIDOR: Record<string, Campo | 'consentimento'> = {
  'hotel.nome': 'nomeHotel',
  'hotel.cnpj': 'cnpj',
  'hotel.endereco.cep': 'cep',
  'hotel.endereco.logradouro': 'logradouro',
  'hotel.endereco.numero': 'numero',
  'hotel.endereco.complemento': 'complemento',
  'hotel.endereco.bairro': 'bairro',
  'hotel.endereco.municipio': 'municipio',
  'hotel.endereco.uf': 'uf',
  'hotel.numeroFuncionarios': 'funcionarios',
  'responsavel.nome': 'nomeResponsavel',
  'responsavel.email': 'email',
  'responsavel.celular': 'celular',
  'responsavel.cargo': 'cargo',
  'consentimento.aceito': 'consentimento',
}

async function postJson(caminho: string, corpo: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  // Sem credentials: a rota é pública e não precisa do cookie de sessão do painel.
  const res = await fetch(`${API}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

export async function enviarCadastro(dados: DadosCadastro, captchaToken?: string): Promise<ResultadoEnvio> {
  const simulacao = modoSimulacao()
  if (simulacao) {
    await esperar(900)
    return simulacao === 'sucesso' ? { status: 'confirmacao-pendente' } : { status: 'indisponivel' }
  }

  let resposta
  try {
    resposta = await postJson('/api/piloto-goias/cadastros', { ...dados, ...(captchaToken ? { captchaToken } : {}) })
  } catch {
    return { status: 'indisponivel' }
  }
  const { status, data } = resposta

  if (status === 202) return { status: 'confirmacao-pendente' }
  if (status === 429) {
    return { status: 'limite', mensagem: String(data.error ?? 'Muitas tentativas. Aguarde alguns minutos.') }
  }
  if (status === 400 && data.status === 'captcha-falhou') {
    return {
      status: 'dados-invalidos',
      mensagem: 'Não foi possível concluir a verificação de segurança. Recarregue a página e tente de novo.',
      erros: {},
    }
  }
  if (status === 400) {
    const erros: ErrosServidor = {}
    const detalhes = Array.isArray(data.details) ? (data.details as { field?: string; message?: string }[]) : []
    for (const d of detalhes) {
      const campo = d.field ? CAMPO_DO_SERVIDOR[d.field] : undefined
      if (campo && !erros[campo]) erros[campo] = d.message ?? 'Confira este campo.'
    }
    return { status: 'dados-invalidos', mensagem: 'Confira os campos indicados e tente de novo.', erros }
  }
  return { status: 'indisponivel' }
}

export async function confirmarEmail(token: string): Promise<ResultadoConfirmacao> {
  const simulacao = modoSimulacao()
  if (simulacao) {
    await esperar(900)
    return simulacao === 'sucesso' ? { status: 'confirmado' } : { status: 'link-invalido' }
  }

  try {
    const { status, data } = await postJson('/api/piloto-goias/cadastros/confirmar', { token })
    if (status === 200 && data.status === 'confirmado') return { status: 'confirmado' }
    if (status === 200 && data.status === 'ja-cadastrado') return { status: 'ja-cadastrado' }
    if (status === 404) return { status: 'link-invalido' }
    return { status: 'indisponivel' }
  } catch {
    return { status: 'indisponivel' }
  }
}
