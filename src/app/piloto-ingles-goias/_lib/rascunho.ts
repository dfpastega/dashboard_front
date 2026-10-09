/**
 * Estado que atravessa as telas do fluxo sem ir para URL nem para storage do
 * navegador (mesma regra de PII do /ativar). Vive só em memória: sobrevive à
 * navegação entre rotas e some ao recarregar a página.
 */

import type { ValoresFormulario } from './validacao'

let rascunho: { valores: ValoresFormulario; consentimento: boolean } | null = null
let emailEnviado: string | null = null

export function guardarRascunho(valores: ValoresFormulario, consentimento: boolean) {
  rascunho = { valores, consentimento }
}

export function lerRascunho() {
  return rascunho
}

export function registrarEnvio(email: string) {
  emailEnviado = email
}

export function emailDoUltimoEnvio() {
  return emailEnviado
}

export function limparFluxo() {
  rascunho = null
  emailEnviado = null
}
