'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Loader2, MessagesSquare, Phone, User as UserIcon, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

// ─── Tipos ────────────────────────────────────────────────────────────────

interface SearchResult {
  whatsappId: string
  studentName: string | null
  sessionCount: number
  lastActivity: string | null
}

interface Message {
  messageId: number
  sessionId: number | null
  incoming: boolean
  content: string
  type: number
  source: string | null
  timestamp: string
  fileUrl: string | null
  sender: string | null
  receiver: string | null
}

interface ConversationResponse {
  whatsappId: string
  studentName: string | null
  messages: Message[]
  hasMore: boolean
  nextCursor: number | null
}

const PAGE_SIZE = 30

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length >= 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
    if (rest.length === 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  }
  return raw
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function dayKey(ts: string): string {
  return new Date(ts).toDateString()
}

function formatDayLabel(ts: string): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function initials(name: string | null, phone: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-2) || '#'
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i
const AUDIO_RE = /\.(ogg|mp3|opus|m4a|wav|aac)(\?|$)/i

// ─── Bolha de mensagem ──────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const outgoing = !msg.incoming // enviada pelo bot/Storm → direita (verde)
  return (
    <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'} px-2`}>
      <div
        className={[
          'relative max-w-[75%] rounded-lg px-3 py-1.5 text-sm shadow-sm',
          outgoing
            ? 'bg-[#d9fdd3] text-neutral-900 dark:bg-[#005c4b] dark:text-neutral-50 rounded-tr-none'
            : 'bg-white text-neutral-900 dark:bg-[#202c33] dark:text-neutral-50 rounded-tl-none',
        ].join(' ')}
      >
        {msg.fileUrl && IMAGE_RE.test(msg.fileUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={msg.fileUrl}
            alt="anexo"
            className="mb-1 max-h-64 rounded-md object-contain"
          />
        )}
        {msg.fileUrl && AUDIO_RE.test(msg.fileUrl) && (
          <audio controls src={msg.fileUrl} className="mb-1 max-w-full" />
        )}
        {msg.fileUrl && !IMAGE_RE.test(msg.fileUrl) && !AUDIO_RE.test(msg.fileUrl) && (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-1 block text-xs font-medium underline underline-offset-2 opacity-90"
          >
            📎 Abrir anexo
          </a>
        )}
        {msg.content && (
          <p className="whitespace-pre-wrap break-words leading-snug">{msg.content}</p>
        )}
        <span className="mt-0.5 block text-right text-[10px] leading-none text-neutral-500 dark:text-neutral-400">
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function ConversasAdminPage() {
  // Busca / autocomplete
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)

  // Conversa selecionada
  const [selected, setSelected] = useState<{ whatsappId: string; studentName: string | null } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Controla o ajuste de scroll após atualizar as mensagens.
  const pendingScrollRef = useRef<{ type: 'bottom' | 'anchor'; prevHeight: number } | null>(null)

  // ── Autocomplete (debounced) ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = query.trim()
    if (term.length < 2) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get<SearchResult[]>('/api/admin/conversations/search', {
          params: { q: term },
        })
        setSuggestions(data ?? [])
        setShowSuggestions(true)
      } catch (err) {
        console.error('Erro na busca de conversas:', err)
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // ── Ajuste de scroll após render das mensagens ──
  useLayoutEffect(() => {
    const el = scrollRef.current
    const pending = pendingScrollRef.current
    if (!el || !pending) return
    if (pending.type === 'bottom') {
      el.scrollTop = el.scrollHeight
    } else {
      // ancoragem: mantém a posição visual ao prepender mensagens antigas
      el.scrollTop = el.scrollHeight - pending.prevHeight
    }
    pendingScrollRef.current = null
  }, [messages])

  // ── Carrega a conversa (página mais recente) ──
  const loadConversation = useCallback(async (whatsappId: string, studentName: string | null) => {
    const id = whatsappId.trim()
    if (!id) return
    setShowSuggestions(false)
    setError(null)
    setSelected({ whatsappId: id, studentName })
    setMessages([])
    setCursor(null)
    setHasMore(false)
    setLoadingInitial(true)
    try {
      const { data } = await api.get<ConversationResponse>(
        `/api/admin/conversations/${encodeURIComponent(id)}/messages`,
        { params: { limit: PAGE_SIZE } }
      )
      pendingScrollRef.current = { type: 'bottom', prevHeight: 0 }
      setMessages(data.messages ?? [])
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
      setSelected({ whatsappId: id, studentName: data.studentName ?? studentName })
    } catch (err) {
      console.error('Erro ao carregar conversa:', err)
      setError('Não foi possível carregar a conversa. Verifique o número e tente novamente.')
    } finally {
      setLoadingInitial(false)
    }
  }, [])

  // ── Carrega página mais antiga (scroll p/ cima) ──
  const loadOlder = useCallback(async () => {
    if (!selected || !hasMore || loadingOlder || cursor === null) return
    const el = scrollRef.current
    setLoadingOlder(true)
    try {
      const { data } = await api.get<ConversationResponse>(
        `/api/admin/conversations/${encodeURIComponent(selected.whatsappId)}/messages`,
        { params: { limit: PAGE_SIZE, before: cursor } }
      )
      if (data.messages && data.messages.length > 0) {
        pendingScrollRef.current = { type: 'anchor', prevHeight: el ? el.scrollHeight : 0 }
        setMessages((prev) => [...data.messages, ...prev])
      }
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (err) {
      console.error('Erro ao carregar mensagens antigas:', err)
    } finally {
      setLoadingOlder(false)
    }
  }, [selected, hasMore, loadingOlder, cursor])

  // ── Detecta scroll no topo p/ paginar ──
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop <= 48 && hasMore && !loadingOlder && !loadingInitial) {
      loadOlder()
    }
  }, [hasMore, loadingOlder, loadingInitial, loadOlder])

  const handleSelectSuggestion = (s: SearchResult) => {
    setQuery(s.whatsappId)
    setSuggestions([])
    loadConversation(s.whatsappId, s.studentName)
  }

  const handleLoadClick = () => {
    if (!query.trim()) return
    const match = suggestions.find((s) => s.whatsappId === query.trim())
    loadConversation(query.trim(), match?.studentName ?? null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MessagesSquare className="h-6 w-6" />
          Conversas
        </h1>
        <p className="text-sm text-muted-foreground">
          Consulte o histórico de mensagens do StormBot por número de telefone.
        </p>
      </div>

      {/* Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar conversa</CardTitle>
          <CardDescription>
            Digite o número (ou nome do aluno) e selecione uma sugestão, ou clique em Carregar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleLoadClick()
                  }
                }}
                placeholder="Ex: 5511999998888 ou nome do aluno"
                className="pl-9"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}

              {/* Dropdown de sugestões */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {suggestions.map((s) => (
                      <li key={s.whatsappId}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectSuggestion(s)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-xs">
                              {initials(s.studentName, s.whatsappId)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {s.studentName || 'Sem nome'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatPhone(s.whatsappId)}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {s.sessionCount} {s.sessionCount === 1 ? 'sessão' : 'sessões'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Button onClick={handleLoadClick} disabled={!query.trim() || loadingInitial}>
              {loadingInitial ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Carregar conversa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Painel da conversa */}
      {(selected || loadingInitial) && (
        <Card className="overflow-hidden p-0">
          {/* Cabeçalho estilo WhatsApp */}
          <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10">
                {selected ? initials(selected.studentName, selected.whatsappId) : <UserIcon className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {selected?.studentName || 'Aluno sem nome'}
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {selected ? formatPhone(selected.whatsappId) : ''}
              </p>
            </div>
          </div>

          {/* Área de mensagens */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="h-[60vh] space-y-1.5 overflow-y-auto bg-[#efeae2] py-3 dark:bg-[#0b141a]"
          >
            {loadingOlder && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!hasMore && !loadingInitial && messages.length > 0 && (
              <p className="py-1 text-center text-[11px] text-muted-foreground">
                Início da conversa
              </p>
            )}

            {loadingInitial ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <AlertCircle className="h-6 w-6" />
                <p className="text-sm">{error}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada para este número.</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const prev = messages[i - 1]
                const showDay = !prev || dayKey(prev.timestamp) !== dayKey(msg.timestamp)
                return (
                  <div key={msg.messageId} className="space-y-1.5">
                    {showDay && (
                      <div className="flex justify-center py-1">
                        <span className="rounded-md bg-black/10 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-white/10 dark:text-neutral-200">
                          {formatDayLabel(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <MessageBubble msg={msg} />
                  </div>
                )
              })
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
