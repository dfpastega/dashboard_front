import {
  isValidCelular,
  isValidCep,
  isValidCnpj,
  isValidEmail,
  normalizeCnpj,
  onlyDigits,
  UFS,
} from '@/lib/br-validators'
import type { DadosCadastro } from './cadastro-service'

// Na ordem visual do formulário (o resumo de erros segue esta ordem).
export const CAMPOS = [
  'nomeHotel',
  'cnpj',
  'funcionarios',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'municipio',
  'uf',
  'nomeResponsavel',
  'cargo',
  'email',
  'celular',
] as const

export type Campo = (typeof CAMPOS)[number]
export type ValoresFormulario = Record<Campo, string>
export type ErrosFormulario = Partial<Record<Campo | 'consentimento', string>>

export const VALORES_INICIAIS: ValoresFormulario = Object.fromEntries(
  CAMPOS.map((c) => [c, '']),
) as ValoresFormulario

/** Nome legível de cada campo, usado no resumo de erros. */
export const ROTULOS: Record<Campo | 'consentimento', string> = {
  nomeHotel: 'Nome do hotel',
  cnpj: 'CNPJ',
  cep: 'CEP',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  municipio: 'Município',
  uf: 'Estado',
  funcionarios: 'Número de funcionários',
  nomeResponsavel: 'Nome completo',
  email: 'E-mail',
  celular: 'Telefone celular',
  cargo: 'Cargo no hotel',
  consentimento: 'Consentimento',
}

const vazio = (v: string) => v.trim() === ''

/** Retorna a mensagem de erro do campo, ou `undefined` se estiver ok. */
export function validarCampo(campo: Campo, valor: string): string | undefined {
  switch (campo) {
    case 'complemento':
      return undefined

    case 'nomeHotel':
      return vazio(valor) ? 'Informe o nome do hotel.' : undefined

    case 'cnpj': {
      const c = normalizeCnpj(valor)
      if (!c) return 'Informe o CNPJ do hotel.'
      if (c.length < 14) return 'O CNPJ está incompleto. Ele tem 14 caracteres.'
      return isValidCnpj(c) ? undefined : 'Este CNPJ não é válido. Confira os números digitados.'
    }

    case 'cep':
      if (!onlyDigits(valor)) return 'Informe o CEP do hotel.'
      return isValidCep(valor) ? undefined : 'O CEP deve ter 8 números, como 74000-000.'

    case 'logradouro':
      return vazio(valor) ? 'Informe a rua, avenida ou logradouro.' : undefined

    case 'numero':
      return vazio(valor) ? 'Informe o número. Se não houver, escreva S/N.' : undefined

    case 'bairro':
      return vazio(valor) ? 'Informe o bairro.' : undefined

    case 'municipio':
      return vazio(valor) ? 'Informe o município.' : undefined

    case 'uf':
      return (UFS as readonly string[]).includes(valor) ? undefined : 'Selecione o estado.'

    case 'funcionarios': {
      if (vazio(valor)) return 'Informe quantas pessoas trabalham no hotel.'
      if (!/^\d+$/.test(valor.trim()) || Number(valor) < 1)
        return 'Use um número inteiro maior que zero, como 25.'
      return undefined
    }

    case 'nomeResponsavel': {
      if (vazio(valor)) return 'Informe seu nome completo.'
      return valor.trim().split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : undefined
    }

    case 'email':
      if (vazio(valor)) return 'Informe seu e-mail.'
      return isValidEmail(valor) ? undefined : 'Este e-mail não parece válido. Exemplo: nome@hotel.com.br'

    case 'celular': {
      if (!onlyDigits(valor)) return 'Informe seu telefone celular com DDD.'
      return isValidCelular(valor)
        ? undefined
        : 'Informe um celular válido com DDD, como (62) 91234-5678.'
    }

    case 'cargo':
      return vazio(valor) ? 'Informe seu cargo no hotel.' : undefined
  }
}

export function validarTudo(valores: ValoresFormulario, consentimento: boolean): ErrosFormulario {
  const erros: ErrosFormulario = {}
  for (const campo of CAMPOS) {
    const erro = validarCampo(campo, valores[campo])
    if (erro) erros[campo] = erro
  }
  if (!consentimento) erros.consentimento = 'Para enviar, é preciso autorizar o tratamento dos dados.'
  return erros
}

export function montarPayload(v: ValoresFormulario, politicaUrl: string | null): DadosCadastro {
  return {
    hotel: {
      nome: v.nomeHotel.trim(),
      cnpj: normalizeCnpj(v.cnpj),
      endereco: {
        cep: onlyDigits(v.cep),
        logradouro: v.logradouro.trim(),
        numero: v.numero.trim(),
        complemento: v.complemento.trim() || null,
        bairro: v.bairro.trim(),
        municipio: v.municipio.trim(),
        uf: v.uf,
      },
      numeroFuncionarios: Number(v.funcionarios),
    },
    responsavel: {
      nome: v.nomeResponsavel.trim().replace(/\s+/g, ' '),
      email: v.email.trim().toLowerCase(),
      celular: onlyDigits(v.celular),
      cargo: v.cargo.trim(),
    },
    consentimento: { aceito: true, politicaUrl },
  }
}
