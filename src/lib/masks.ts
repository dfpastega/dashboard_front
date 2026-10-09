/**
 * Máscaras de entrada BR.
 *
 * Vivem aqui porque a landing pública (`/ativar`) e o painel de beneficiários pedem
 * exatamente os mesmos dados — CPF e data de nascimento — e alimentam a mesma
 * canonicalização no backend. Duas cópias divergiriam na primeira correção.
 *
 * O backend (`canonicalize`) aceita a data tanto em DD/MM/AAAA quanto em AAAA-MM-DD,
 * então o valor mascarado pode ser enviado como está.
 */

export function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function maskDate(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

/**
 * CNPJ no formato 00.000.000/0000-00. Aceita letras porque, desde julho de 2026, a
 * Receita emite CNPJ alfanumérico (as 12 primeiras posições podem ter A–Z; os dois
 * dígitos verificadores continuam numéricos). Números antigos seguem iguais.
 */
export function maskCnpj(v: string): string {
  const c = v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14)
  const partes = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12, 14)]
  let out = partes[0]
  if (partes[1]) out += `.${partes[1]}`
  if (partes[2]) out += `.${partes[2]}`
  if (partes[3]) out += `/${partes[3]}`
  if (partes[4]) out += `-${partes[4]}`
  return out
}

export function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/(\d{5})(\d)/, '$1-$2')
}
