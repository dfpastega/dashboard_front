/**
 * Escala visual do mapa de hotéis.
 *
 * O tamanho sai da RAIZ QUADRADA do valor, e não do valor direto, porque o olho lê
 * área: usar o raio cru faria um hotel de 100 pessoas parecer 100 vezes maior que um
 * de 1, quando é 100 vezes em pessoas e 10.000 em área.
 *
 * ⚠️ Não é proporcionalidade estrita. A raiz é interpolada entre um raio mínimo e um
 * máximo fixos (6 e 26 px), o que COMPRIME a escala: no conjunto atual (1 a 180
 * funcionários) o maior marcador tem ~19x a área do menor, não 180x. Proporcional de
 * verdade exigiria um círculo de ~160 px de diâmetro para o maior, que cobriria boa
 * parte do mapa e esconderia os vizinhos.
 *
 * A compressão é prática corrente em mapas de símbolos proporcionais com amplitude
 * grande, mas tem um custo: o leitor NÃO deve estimar quantidades comparando áreas.
 * Por isso o número exato aparece no popup de cada ponto, e a legenda mostra quatro
 * tamanhos de referência com seus valores — é dela que se calibra a leitura.
 *
 * A cor repete a mesma informação em faixas. É redundante de propósito: diferença de
 * tamanho entre dois círculos distantes um do outro no mapa é difícil de julgar, e a
 * faixa de cor resolve na leitura rápida.
 */

/** Raio em pixels, do menor ao maior marcador. Mínimo 6 para continuar clicável. */
const RAIO_MIN = 6
const RAIO_MAX = 26

export type Faixa = {
  rotulo: string
  /** Limite superior da faixa, inclusive. Infinity na última. */
  ate: number
  cor: string
  corEscura: string
}

/**
 * O mapa usa tiles claros no tema claro e escuros no tema escuro, e cada rampa foi
 * escolhida contra o SEU fundo — invertê-las jogaria azul claro sobre fundo claro.
 * Contraste do passo mais fraco: 2,18:1 no claro e 4,78:1 no escuro; os demais
 * passam de 3:1. Ambas monotônicas, que é o critério de uma rampa sequencial.
 *
 * Faixas de porte. Os cortes saem da distribuição real dos 36 cadastros
 * (mediana 26, quartis próximos de 10, 25 e 50), o que deixa ~9 hotéis em cada —
 * faixas de tamanho parecido comunicam melhor que cortes redondos arbitrários.
 *
 * Cores: rampa sequencial azul, claro -> escuro. Uma só matiz, porque a variável é
 * uma magnitude contínua; matizes diferentes sugeririam categorias sem ordem.
 */
export const FAIXAS: Faixa[] = [
  { rotulo: 'até 10',      ate: 10,       cor: '#6da7ec', corEscura: '#cde2fb' },
  { rotulo: '11 a 25',     ate: 25,       cor: '#3987e5', corEscura: '#9ec5f4' },
  { rotulo: '26 a 50',     ate: 50,       cor: '#256abf', corEscura: '#6da7ec' },
  { rotulo: 'acima de 50', ate: Infinity, cor: '#104281', corEscura: '#3987e5' },
]

export function faixaDe(funcionarios: number): Faixa {
  return FAIXAS.find((f) => funcionarios <= f.ate) ?? FAIXAS[FAIXAS.length - 1]
}

/**
 * Raio do marcador. `minimo` e `maximo` são os extremos do conjunto exibido, para a
 * escala usar toda a faixa disponível em vez de depender de valores fixos.
 */
export function raioDe(funcionarios: number, minimo: number, maximo: number): number {
  if (maximo <= minimo) return (RAIO_MIN + RAIO_MAX) / 2
  const r = Math.sqrt(Math.max(funcionarios, 0))
  const rMin = Math.sqrt(Math.max(minimo, 0))
  const rMax = Math.sqrt(Math.max(maximo, 0))
  const t = (r - rMin) / (rMax - rMin)
  return RAIO_MIN + (RAIO_MAX - RAIO_MIN) * t
}

/** Raios de exemplo para a legenda de tamanho, nos mesmos termos do mapa. */
export function raiosDaLegenda(minimo: number, maximo: number): Array<{ valor: number; raio: number }> {
  const marcos = [minimo, Math.round((minimo + maximo) / 4), Math.round(maximo / 2), maximo]
  const unicos = [...new Set(marcos.filter((v) => v > 0))].sort((a, b) => a - b)
  return unicos.map((valor) => ({ valor, raio: raioDe(valor, minimo, maximo) }))
}
