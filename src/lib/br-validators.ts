/**
 * Validações de documentos e contatos brasileiros.
 * Recebem o valor como digitado (com ou sem máscara) e normalizam internamente.
 */

/** Só caracteres que contam no documento (dígitos e, no CNPJ, letras maiúsculas). */
export function onlyDigits(v: string): string {
  return v.replace(/\D/g, '')
}

export function normalizeCnpj(v: string): string {
  return v.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

/**
 * CNPJ numérico ou alfanumérico (IN RFB 2.229/2024). Cada caractere vale seu código
 * ASCII menos 48 — para dígitos isso é o próprio dígito, então o cálculo é o mesmo
 * dos CNPJs antigos.
 */
export function isValidCnpj(v: string): boolean {
  const c = normalizeCnpj(v)
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c)) return false
  if (/^(.)\1{13}$/.test(c)) return false

  const valores = [...c].map((ch) => ch.charCodeAt(0) - 48)
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = pesos.reduce((acc, p, i) => acc + p * valores[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return dv(12) === valores[12] && dv(13) === valores[13]
}

export function isValidCep(v: string): boolean {
  return /^\d{8}$/.test(onlyDigits(v))
}

// DDDs em uso no Brasil (Anatel).
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

/** Celular: DDD válido + 9 dígitos começando por 9. */
export function isValidCelular(v: string): boolean {
  const d = onlyDigits(v)
  return d.length === 11 && DDDS.has(Number(d.slice(0, 2))) && d[2] === '9'
}

/** Mesmo critério prático do `type="email"` do navegador: algo@dominio.ext, sem espaços. */
export function isValidEmail(v: string): boolean {
  return /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(v.trim())
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const
