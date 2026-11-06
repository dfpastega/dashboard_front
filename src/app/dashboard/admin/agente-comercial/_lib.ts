/**
 * Tipos e helpers compartilhados pelas telas do Agente Comercial.
 *
 * Os tipos espelham o que `/api/agente-comercial/admin/*` responde. Ver a seção
 * "Agente Comercial" em `docs/API_REFERENCE.md` do backend.
 */

export interface Paginado<T> {
  total: number
  pagina: number
  porPagina: number
  items: T[]
}

export type StatusAchado = 'pending' | 'approved' | 'rejected' | 'sent' | 'send_failed'
export type StatusMonitoramento = 'monitored' | 'discovered' | 'ignored'

export interface Achado {
  id: string
  sourceSite: string
  sourceUrl: string
  excerpt: string
  excerptLanguage: string | null
  reviewDate: string | null
  status: StatusAchado
  rejectionReason: string | null
  reviewedAt: string | null
  createdAt: string
  runId: string
  establishmentId: string | null
  establishmentName: string | null
  establishmentCity: string | null
  establishmentState: string | null
  establishmentWebsite: string | null
  contactEmail: string | null
  contactName: string | null
  contactRole: string | null
  monitoringStatus: StatusMonitoramento | null
  lastEmailedAt: string | null
  emailId: string | null
  emailSubject: string | null
  emailBody: string | null
  emailStatus: 'draft' | 'sent' | 'failed' | null
}

export interface Estabelecimento {
  id: string
  name: string
  city: string | null
  state: string | null
  website: string | null
  contactEmail: string | null
  contactName: string | null
  contactRole: string | null
  contactPhone: string | null
  origin: 'manual' | 'discovered'
  monitoringStatus: StatusMonitoramento
  enrichmentStatus: 'none' | 'auto' | 'manual' | 'failed'
  lastEmailedAt: string | null
  notes: string | null
  createdAt: string
  totalAchados: number
}

export type ModoDigest = 'cada_execucao' | 'diario' | 'semanal'

/** Uma variável `{{nome}}` que o prompt pode usar, como o backend descreve. */
export interface VariavelPrompt {
  nome: string
  obrigatoria: boolean
  descricao: string
}

export interface Config {
  id: string
  isActive: boolean
  frequencyMinutes: number
  maxSearchesPerCycle: number
  maxFindingsPerCycle: number
  emailCooldownDays: number
  openaiModel: string
  lastRunAt: string | null
  forceRunRequestedAt: string | null
  nextRunAt: string | null
  /** Só diz se a chave existe no servidor — nunca o valor. */
  openaiConfigurada: boolean

  // ── Aviso de cada rodada ─────────────────────────────────────────────────
  /** Se false, nenhuma rodada manda aviso. */
  digestEnabled: boolean
  /** A lista configurada no painel; vazia significa "usar o fallback". */
  digestRecipients: string[]
  /**
   * Para quem o aviso vai DE FATO hoje, já resolvida a precedência, e de onde a lista
   * saiu. Vem pronto do servidor: é a mesma função que o job usa na hora de enviar,
   * então a tela e o e-mail não têm como discordar.
   */
  digestDestinatarios: string[]
  digestOrigem: 'painel' | 'EMAIL_RECIPIENTS' | 'desligado'
  /** Quando o aviso sai. */
  digestMode: ModoDigest
  /** 0 = domingo, como o extract(dow) do Postgres. Só vale no modo semanal. */
  digestWeekday: number
  /** Hora do resumo periódico, em America/Sao_Paulo. */
  digestHour: number
  digestLastSentAt: string | null

  // ── Prompts ──────────────────────────────────────────────────────────────
  // O backend manda o prompt já resolvido (personalizado ou padrão), o padrão e o
  // bloco fixo. O texto não é duplicado aqui de propósito: duas cópias divergiriam
  // na primeira alteração, e a tela passaria a mostrar um prompt que não é o que roda.
  /** O prompt em uso. */
  searchPrompt: string
  emailPrompt: string
  /** false quando o que está em uso é o padrão do código. */
  searchPromptPersonalizado: boolean
  emailPromptPersonalizado: boolean
  searchPromptPadrao: string
  emailPromptPadrao: string
  /** O que o código cola depois do prompt e a edição não alcança. */
  searchPromptFixo: string
  emailPromptFixo: string
  variaveisBusca: VariavelPrompt[]
  variaveisEmail: VariavelPrompt[]
}

export interface Busca {
  id: string
  label: string
  region: string
  searchPhrase: string
  isActive: boolean
  lastSearchedAt: string | null
  createdAt: string
}

export interface Execucao {
  id: string
  trigger: 'scheduled' | 'manual'
  status: 'running' | 'success' | 'partial' | 'failed'
  startedAt: string
  finishedAt: string | null
  searchesPlanned: number
  searchesDone: number
  findingsNew: number
  findingsDuplicate: number
  findingsUnverified: number
  inputTokens: string | number
  outputTokens: string | number
  estimatedCostUsd: string | null
  errorMessage: string | null
}

export interface DetalheBusca {
  tipo: 'descoberta' | 'dirigida'
  alvo: string
  brutos?: number
  novos?: number
  duplicados?: number
  naoVerificados?: number
  descartes?: Array<{ url: string; motivo: string }>
  erro?: string
}

export interface ExecucaoDetalhada extends Execucao {
  details: { buscas?: DetalheBusca[]; errors?: string[] }
}

export interface Resumo {
  achados: {
    pendentes: number
    aprovados: number
    recusados: number
    enviados: number
    falhas: number
  }
  ultimaExecucao: {
    id: string
    status: Execucao['status']
    startedAt: string
    finishedAt: string | null
    findingsNew: number
    findingsUnverified: number
    estimatedCostUsd: string | null
  } | null
  custoMesUsd: string
}

export const BASE = '/api/agente-comercial/admin'
export const PAGINA = '/dashboard/admin/agente-comercial'

export function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatarDataCurta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

/** Duração legível entre início e fim de uma execução. */
export function duracao(inicio: string, fim: string | null): string {
  if (!fim) return 'em andamento'
  const ms = new Date(fim).getTime() - new Date(inicio).getTime()
  if (ms < 1000) return '<1s'
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`
}

/** Dólares com duas casas; o backend manda string de NUMERIC. */
export function formatarUsd(valor: string | null): string {
  if (valor === null || valor === '') return '—'
  const n = Number(valor)
  return Number.isNaN(n) ? '—' : `US$ ${n.toFixed(2)}`
}

export const ROTULO_STATUS: Record<StatusAchado, string> = {
  pending: 'pendente',
  approved: 'aprovado',
  rejected: 'recusado',
  sent: 'enviado',
  send_failed: 'falha no envio',
}

export const CLASSE_STATUS: Record<StatusAchado, string> = {
  pending: 'bg-amber-500/15 text-amber-600',
  approved: 'bg-emerald-500/15 text-emerald-600',
  rejected: 'bg-muted text-muted-foreground',
  sent: 'bg-emerald-500/15 text-emerald-600',
  send_failed: 'bg-red-500/15 text-red-600',
}

export const ROTULO_MONITORAMENTO: Record<StatusMonitoramento, string> = {
  monitored: 'monitorado',
  discovered: 'descoberto',
  ignored: 'ignorado',
}

export const CLASSE_MONITORAMENTO: Record<StatusMonitoramento, string> = {
  monitored: 'bg-emerald-500/15 text-emerald-600',
  discovered: 'bg-sky-500/15 text-sky-600',
  ignored: 'bg-muted text-muted-foreground',
}

export const CLASSE_EXECUCAO: Record<Execucao['status'], string> = {
  running: 'bg-sky-500/15 text-sky-600',
  success: 'bg-emerald-500/15 text-emerald-600',
  partial: 'bg-amber-500/15 text-amber-600',
  failed: 'bg-red-500/15 text-red-600',
}

/** Mensagem de erro do backend, com fallback. */
export function mensagemErro(err: unknown, padrao: string): string {
  const resposta = (
    err as {
      response?: {
        status?: number
        data?: { error?: string; details?: Array<{ message?: string }> }
      }
    }
  )?.response

  if (resposta?.status === 403) return 'Esta tela é restrita a super administradores.'

  // Num 400 o backend responde `{ error: "Dados inválidos", details: [...] }`. Sem ler
  // `details`, a tela mostraria só "Dados inválidos" — inútil para quem acabou de
  // escrever um prompt de quarenta linhas e precisa saber qual linha está errada.
  const detalhes = resposta?.data?.details?.map((d) => d.message).filter(Boolean)
  if (detalhes?.length) return detalhes.slice(0, 2).join(' ')

  return resposta?.data?.error || padrao
}

/**
 * Quando o aviso sai. `cada_execucao` é o padrão e o comportamento histórico; os dois
 * periódicos juntam tudo desde o último aviso.
 */
export const MODOS_DIGEST: Array<{ valor: ModoDigest; rotulo: string; ajuda: string }> = [
  {
    valor: 'cada_execucao',
    rotulo: 'A cada execução do agente',
    ajuda: 'Toda rodada que encontrar algo novo manda um e-mail. Com o agente rodando várias vezes ao dia, vira muito e-mail.',
  },
  {
    valor: 'diario',
    rotulo: 'Um resumo por dia',
    ajuda: 'Um e-mail por dia, na hora escolhida, com tudo que foi encontrado desde o aviso anterior.',
  },
  {
    valor: 'semanal',
    rotulo: 'Um resumo por semana',
    ajuda: 'Um e-mail por semana, no dia e na hora escolhidos, com tudo que foi encontrado desde o aviso anterior.',
  },
]

/** 0 = domingo: a mesma convenção do `extract(dow)` do Postgres, dos dois lados. */
export const DIAS_SEMANA = [
  { valor: 1, rotulo: 'Segunda-feira' },
  { valor: 2, rotulo: 'Terça-feira' },
  { valor: 3, rotulo: 'Quarta-feira' },
  { valor: 4, rotulo: 'Quinta-feira' },
  { valor: 5, rotulo: 'Sexta-feira' },
  { valor: 6, rotulo: 'Sábado' },
  { valor: 0, rotulo: 'Domingo' },
] as const

/** Horas cheias. O agendador passa de 10 em 10 min, então o resumo sai no máximo 10 min depois. */
export const HORAS = Array.from({ length: 24 }, (_, h) => ({
  valor: h,
  rotulo: `${String(h).padStart(2, '0')}:00`,
}))

/** Opções de frequência oferecidas na tela, em minutos. */
export const FREQUENCIAS = [
  { valor: 360, rotulo: 'A cada 6 horas' },
  { valor: 720, rotulo: 'A cada 12 horas' },
  { valor: 1440, rotulo: 'Uma vez por dia' },
  { valor: 4320, rotulo: 'A cada 3 dias' },
  { valor: 10080, rotulo: 'Uma vez por semana' },
] as const
