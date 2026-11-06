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

/**
 * Eixo separado do status: este diz se a CITAÇÃO foi conferida, o status diz onde o
 * achado está no fluxo comercial.
 */
export type StatusVerificacao = 'verified' | 'unverified' | 'confirmed'

export interface Achado {
  id: string
  sourceSite: string
  sourceUrl: string
  excerpt: string
  excerptLanguage: string | null
  reviewDate: string | null
  status: StatusAchado
  verificationStatus: StatusVerificacao
  /** Por que a conferência automática não passou: HTTP 403, trecho não encontrado… */
  verificationReason: string | null
  verifiedAt: string | null
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
  /** Só dígitos. Preenchido quando a ficha veio do Cadastur. */
  cnpj: string | null
  totalPessoas: number
  /** Quantas pessoas esperam alguém abrir a fonte. */
  pessoasNaoConfirmadas: number
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

  /** O terceiro prompt: a busca de pessoas-chave do estabelecimento. */
  peoplePrompt: string
  peoplePromptPersonalizado: boolean
  peoplePromptPadrao: string
  peoplePromptFixo: string
  variaveisPessoas: VariavelPrompt[]
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
  pessoas: {
    total: number
    /** Pessoas cuja fonte o agente não conseguiu ler; esperam conferência humana. */
    naoConfirmadas: number
    comEmail: number
  }
  achados: {
    /** Pendentes que o agente não conseguiu conferir e esperam alguém abrir a fonte. */
    naoConfirmados: number
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

export const ROTULO_VERIFICACAO: Record<StatusVerificacao, string> = {
  verified: 'conferido',
  unverified: 'não conferido',
  confirmed: 'confirmado por pessoa',
}

export const CLASSE_VERIFICACAO: Record<StatusVerificacao, string> = {
  verified: 'bg-emerald-500/15 text-emerald-600',
  unverified: 'bg-amber-500/15 text-amber-600',
  confirmed: 'bg-sky-500/15 text-sky-600',
}

/**
 * O que cada estado significa para quem revisa — não o detalhe técnico, que fica em
 * `verificationReason`, mas o que a pessoa precisa fazer.
 */
export const AJUDA_VERIFICACAO: Record<StatusVerificacao, string> = {
  verified: 'O agente abriu a página e achou este trecho, palavra por palavra.',
  unverified:
    'O agente não conseguiu ler a página — em geral o site bloqueia leitura automática. ' +
    'A reclamação pode existir: abra a fonte e confira antes de aprovar.',
  confirmed: 'Alguém do time abriu a fonte e confirmou que a reclamação está lá.',
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

// ---------------------------------------------------------------------------
// Cadastur — o universo de prospecção
// ---------------------------------------------------------------------------

/**
 * Uma ficha do Cadastur, o cadastro de meios de hospedagem do Ministério do Turismo.
 * Obrigatório por lei, publicado em dados abertos por trimestre: é a base mais completa
 * de CNPJ, e-mail e telefone de hotelaria no Brasil.
 */
export interface FichaCadastur {
  id: string
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  tipoHospedagem: string | null
  uf: string | null
  municipio: string | null
  telefone: string | null
  email: string | null
  website: string | null
  responsavelNome: string | null
  possuiEmpregado: boolean | null
  porte: string | null
  /**
   * Os idiomas que o próprio estabelecimento declara atender, texto cru do arquivo.
   * `null` significa "não declarou" — e isso é 43% da base, então a ausência de inglês
   * aqui é PRIORIDADE de prospecção, não prova de que a equipe não fala inglês.
   */
  idiomas: string | null
  declaraIngles: boolean
  unidadesHabitacionais: number | null
  leitos: number | null
  situacaoAtividade: string | null
  ativo: boolean
  /** O arquivo trimestral de onde a linha veio. */
  fonte: string
  /** Preenchido quando a ficha já foi promovida ao funil. */
  establishmentId: string | null
  monitoringStatus: StatusMonitoramento | null
  /**
   * Um estabelecimento do funil com o mesmo nome e cidade, mas sem CNPJ — em geral algo
   * que o bot descobriu por uma reclamação. Promover adota esse em vez de duplicar.
   */
  possivelEstabelecimentoId: string | null
}

export interface SincronizacaoCadastur {
  id: string
  status: 'running' | 'success' | 'skipped' | 'failed'
  trigger: 'scheduled' | 'manual'
  recurso: string | null
  lidas: number
  inseridas: number
  atualizadas: number
  desativadas: number
  estabelecimentosEnriquecidos: number
  erro: string | null
  startedAt: string
  finishedAt: string | null
}

export interface ResumoCadastur {
  total: number
  emOperacao: number
  semIngles: number
  /** Em operação, sem inglês declarado, 30+ UHs e com e-mail. */
  alvo: number
  noFunil: number
  ultimaSincronizacao: SincronizacaoCadastur | null
}

export interface OpcoesCadastur {
  ufs: Array<{ uf: string; total: number }>
  tipos: Array<{ tipo: string; total: number }>
}

export const FILTROS_INGLES = [
  { valor: 'todos', rotulo: 'Qualquer idioma' },
  { valor: 'sem', rotulo: 'Não declara inglês' },
  { valor: 'branco', rotulo: 'Não declarou idioma' },
  { valor: 'com', rotulo: 'Declara inglês' },
] as const

export const CLASSE_SYNC: Record<SincronizacaoCadastur['status'], string> = {
  running: 'bg-sky-500/15 text-sky-600',
  success: 'bg-emerald-500/15 text-emerald-600',
  skipped: 'bg-muted text-muted-foreground',
  failed: 'bg-red-500/15 text-red-600',
}

export const ROTULO_SYNC: Record<SincronizacaoCadastur['status'], string> = {
  running: 'em andamento',
  success: 'concluída',
  skipped: 'nada novo',
  failed: 'falhou',
}

// ---------------------------------------------------------------------------
// Pessoas-chave
// ---------------------------------------------------------------------------

export type GrupoCargo = 'dono' | 'gerencia' | 'rh' | 'outro'
export type OrigemPessoa = 'cadastur' | 'busca' | 'snovio' | 'manual'
export type StatusEmailPessoa = 'none' | 'found' | 'verified' | 'invalid'

/** Mesmo eixo dos achados, mais 'manual' para quem foi digitado por uma pessoa. */
export type VerificacaoPessoa = StatusVerificacao | 'manual'

export interface Pessoa {
  id: string
  fullName: string
  role: string | null
  roleGroup: GrupoCargo
  email: string | null
  emailStatus: StatusEmailPessoa
  phone: string | null
  linkedinUrl: string | null
  origin: OrigemPessoa
  sourceUrl: string | null
  /** O trecho literal que sustenta o cargo, conferido contra a página. */
  sourceExcerpt: string | null
  verificationStatus: VerificacaoPessoa
  verificationReason: string | null
  verifiedAt: string | null
  notes: string | null
  createdAt: string
}

export interface BuscaPessoas {
  id: string
  status: 'running' | 'success' | 'failed'
  instruction: string | null
  encontradas: number
  novas: number
  duplicadas: number
  naoVerificadas: number
  custoUsd: string | null
  erro: string | null
  startedAt: string
  finishedAt: string | null
}

export interface RespostaPessoas {
  items: Pessoa[]
  ultimaBusca: BuscaPessoas | null
}

export const GRUPOS_CARGO: Array<{ valor: GrupoCargo; rotulo: string }> = [
  { valor: 'dono', rotulo: 'Dono / sócio' },
  { valor: 'gerencia', rotulo: 'Gerência' },
  { valor: 'rh', rotulo: 'RH / treinamento' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const ROTULO_GRUPO: Record<GrupoCargo, string> = {
  dono: 'dono',
  gerencia: 'gerência',
  rh: 'RH',
  outro: 'outro',
}

export const CLASSE_GRUPO: Record<GrupoCargo, string> = {
  dono: 'bg-violet-500/15 text-violet-600',
  gerencia: 'bg-sky-500/15 text-sky-600',
  rh: 'bg-teal-500/15 text-teal-600',
  outro: 'bg-muted text-muted-foreground',
}

export const ROTULO_ORIGEM_PESSOA: Record<OrigemPessoa, string> = {
  cadastur: 'Cadastur',
  busca: 'busca do agente',
  snovio: 'Snov.io',
  manual: 'cadastro manual',
}

/**
 * O que cada estado do e-mail significa. A distinção entre "achado na fonte" e
 * "validado" é a que importa: endereço que aparece numa página pode estar velho, e o
 * agente nunca monta endereço a partir do nome.
 */
export const AJUDA_EMAIL_PESSOA: Record<StatusEmailPessoa, string> = {
  none: 'Sem e-mail.',
  found: 'Apareceu escrito na fonte citada. Não foi validado — pode estar desatualizado.',
  verified: 'Validado por um serviço de verificação de e-mail.',
  invalid: 'A validação reprovou este endereço. Não envie.',
}

export const ROTULO_VERIFICACAO_PESSOA: Record<VerificacaoPessoa, string> = {
  verified: 'conferido',
  unverified: 'não conferido',
  confirmed: 'confirmado por pessoa',
  manual: 'cadastro manual',
}

export const CLASSE_VERIFICACAO_PESSOA: Record<VerificacaoPessoa, string> = {
  verified: 'bg-emerald-500/15 text-emerald-600',
  unverified: 'bg-amber-500/15 text-amber-600',
  confirmed: 'bg-sky-500/15 text-sky-600',
  manual: 'bg-muted text-muted-foreground',
}

export const AJUDA_VERIFICACAO_PESSOA: Record<VerificacaoPessoa, string> = {
  verified: 'O agente abriu a página e achou o nome desta pessoa lá, palavra por palavra.',
  unverified:
    'O agente não conseguiu ler a página — em geral o site bloqueia leitura automática. ' +
    'A pessoa pode existir: abra a fonte e confira o nome e o cargo.',
  confirmed: 'Alguém do time abriu a fonte e confirmou o nome e o cargo.',
  manual: 'Digitado por alguém do time; não passou por conferência automática.',
}

/** CNPJ só com dígitos vindo do backend, formatado para leitura. */
export function formatarCnpj(cnpj: string | null): string {
  if (!cnpj) return '—'
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
