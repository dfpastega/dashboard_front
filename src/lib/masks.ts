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
