/**
 * Consulta de CEP no ViaCEP (serviço público e gratuito, sem chave).
 * O projeto não tinha consulta de CEP antes desta; se o backend passar a expor
 * uma, basta trocar a URL aqui.
 */

export type Endereco = {
  logradouro: string
  bairro: string
  municipio: string
  uf: string
}

export type ResultadoCep =
  | { status: 'ok'; endereco: Endereco }
  | { status: 'nao-encontrado' }
  | { status: 'indisponivel' }

export async function buscarCep(cep: string, signal?: AbortSignal): Promise<ResultadoCep> {
  const d = cep.replace(/\D/g, '')
  if (d.length !== 8) return { status: 'nao-encontrado' }

  // Timeout manual em vez de AbortSignal.any/timeout: celulares com iOS < 17.4 não têm `any`.
  const controle = new AbortController()
  const cancelar = () => controle.abort()
  signal?.addEventListener('abort', cancelar)
  const timer = setTimeout(cancelar, 6000)

  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: controle.signal })
    if (res.status === 400) return { status: 'nao-encontrado' }
    if (!res.ok) return { status: 'indisponivel' }
    const data = await res.json()
    if (data?.erro) return { status: 'nao-encontrado' }
    return {
      status: 'ok',
      endereco: {
        logradouro: data.logradouro ?? '',
        bairro: data.bairro ?? '',
        municipio: data.localidade ?? '',
        uf: data.uf ?? '',
      },
    }
  } catch (err) {
    // Cancelamento explícito (CEP mudou) é repassado para quem chamou ignorar.
    if (signal?.aborted) throw err
    return { status: 'indisponivel' }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancelar)
  }
}
