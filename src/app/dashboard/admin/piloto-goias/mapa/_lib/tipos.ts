/** Resposta de GET /api/piloto-goias/admin/mapa. Sem dados de contato, de propósito. */
export type PontoMapa = {
  id: string
  hotelName: string
  city: string
  state: string
  employees: number
  latitude: number
  longitude: number
  /**
   * Quanto se confia na posição:
   *   'endereco'  — rua e número encontrados
   *   'rua'       — só a rua; o número não existe na base do OpenStreetMap
   *   'municipio' — nem a rua resolveu; o ponto é o centro da cidade
   */
  geoPrecision: 'endereco' | 'rua' | 'municipio'
}

export type RespostaMapa = {
  total: number
  /** Cadastros que ainda não têm coordenada e por isso não aparecem no mapa. */
  semCoordenada: number
  pontos: PontoMapa[]
}
