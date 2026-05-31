'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  MessageCircle,
  Loader2,
  Send,
  Download,
  User,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Image,
  Plus,
  Trash2,
  FileText,
  Sparkles,
  Phone,
  Link,
  CornerDownRight,
} from 'lucide-react'
import { api } from '@/lib/api'

// ─── Shared types ────────────────────────────────────────────────────────────

type Account = 'demo' | 'prod'
type SendMode = 'single' | 'bulk'
type Tab = 'send' | 'create'

interface TemplateComponent {
  type: string
  parameters?: Array<{ type: string; text?: string; example?: string[] }>
}

interface Template {
  name: string
  language: string
  status: string
  category: string
  components: TemplateComponent[]
  ID: string
  paramInfo: {
    totalParams: number
    byComponent: Array<{ type: string; count: number }>
  }
}

interface BulkResult {
  phone: string
  success: boolean
  messageId?: string
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'UTILITY',        label: 'Utilidade' },
  { value: 'MARKETING',      label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
]

const LANGUAGES = [
  { value: 'pt_BR', label: 'Português (Brasil)' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'es',    label: 'Español' },
  { value: 'es_MX', label: 'Español (México)' },
  { value: 'fr',    label: 'Français' },
]

const HEADER_FORMATS = [
  { value: 'NONE',     label: 'Nenhum' },
  { value: 'TEXT',     label: 'Texto' },
  { value: 'IMAGE',    label: 'Imagem' },
  { value: 'VIDEO',    label: 'Vídeo' },
  { value: 'DOCUMENT', label: 'Documento' },
]

type ButtonMode = 'NONE' | 'QUICK_REPLY' | 'CTA'
type CtaButtonType = 'PHONE_NUMBER' | 'URL'

interface QuickReplyButton { type: 'QUICK_REPLY'; text: string }
interface PhoneButton      { type: 'PHONE_NUMBER'; text: string; phone: string }
interface UrlButton        { type: 'URL'; text: string; url: string; urlExample: string }
type TemplateButton = QuickReplyButton | PhoneButton | UrlButton

// Limites da Meta
const QR_MAX = 3   // Quick Reply máximo
const CTA_MAX = 3  // CTA total máximo (1 phone + 2 url)

function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function extractMaxVar(text: string): number {
  const matches = text.match(/\{\{(\d+)\}\}/g) || []
  const nums = matches.map(m => parseInt(m.replace(/[{}]/g, '')))
  return nums.length > 0 ? Math.max(...nums) : 0
}

function fillVars(text: string, examples: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const val = examples[parseInt(n) - 1]
    return val?.trim() ? val : `{{${n}}}`
  })
}

// ─── WhatsApp bubble (shared by both tabs) ────────────────────────────────────

function WaBubble({
  headerFormat,
  headerText,
  headerExamples,
  bodyText,
  bodyExamples,
  footerText,
  buttons = [],
}: {
  headerFormat?: string
  headerText?: string
  headerExamples?: string[]
  bodyText?: string
  bodyExamples?: string[]
  footerText?: string
  buttons?: TemplateButton[]
}) {
  const renderedHeader = headerFormat === 'TEXT' && headerText
    ? fillVars(headerText, headerExamples ?? [])
    : null

  const renderedBody = bodyText
    ? fillVars(bodyText, bodyExamples ?? [])
    : null

  const showImagePlaceholder = headerFormat && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)
  const hasButtons = buttons.length > 0

  return (
    <div className="rounded-xl p-4 min-h-[180px] flex flex-col justify-end" style={{ backgroundColor: '#e5ddd5' }}>
      <div className="ml-auto max-w-[85%] space-y-1">
        {/* Message bubble */}
        <div className="rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm space-y-1.5 relative" style={{ backgroundColor: '#dcf8c6' }}>
          {showImagePlaceholder && (
            <div className="w-full rounded-lg flex items-center justify-center gap-2 text-gray-400 text-xs" style={{ backgroundColor: '#c8e6c9', height: '72px' }}>
              {headerFormat === 'IMAGE' && <Image className="h-4 w-4" />}
              {headerFormat === 'VIDEO' && <span className="text-sm">▶</span>}
              {headerFormat === 'DOCUMENT' && <FileText className="h-4 w-4" />}
              <span>{HEADER_FORMATS.find(f => f.value === headerFormat)?.label}</span>
            </div>
          )}
          {renderedHeader && (
            <p className="font-semibold text-sm text-gray-900 whitespace-pre-wrap">{renderedHeader}</p>
          )}
          {renderedBody ? (
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{renderedBody}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Corpo da mensagem...</p>
          )}
          {footerText && (
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{footerText}</p>
          )}
          <p className="text-[10px] text-gray-500 text-right leading-none">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {!hasButtons && (
            <div className="absolute bottom-0 right-[-8px] w-0 h-0" style={{ borderTop: '8px solid #dcf8c6', borderLeft: '8px solid transparent' }} />
          )}
        </div>

        {/* Buttons */}
        {hasButtons && (
          <div className="space-y-1">
            {buttons.map((btn, i) => (
              <div
                key={i}
                className="rounded-xl px-3 py-2 shadow-sm flex items-center justify-center gap-1.5 text-sm font-medium"
                style={{ backgroundColor: '#dcf8c6', color: '#075e54' }}
              >
                {btn.type === 'QUICK_REPLY' && <CornerDownRight className="h-3.5 w-3.5 flex-shrink-0" />}
                {btn.type === 'PHONE_NUMBER' && <Phone className="h-3.5 w-3.5 flex-shrink-0" />}
                {btn.type === 'URL' && <Link className="h-3.5 w-3.5 flex-shrink-0" />}
                <span className="truncate">{btn.text || <span className="italic text-gray-400 font-normal">Texto do botão</span>}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Variable example inputs ─────────────────────────────────────────────────

function VarExamples({
  label,
  count,
  examples,
  onChange,
}: {
  label: string
  count: number
  examples: string[]
  onChange: (idx: number, val: string) => void
}) {
  if (count === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{`{{${i + 1}}}`}</span>
          <Input
            placeholder={`Exemplo do parâmetro ${i + 1}`}
            value={examples[i] ?? ''}
            onChange={e => onChange(i, e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      ))}
    </div>
  )
}

// ─── BUTTONS CARD ────────────────────────────────────────────────────────────

function ButtonsCard({
  mode,
  buttons,
  onModeChange,
  onButtonsChange,
}: {
  mode: ButtonMode
  buttons: TemplateButton[]
  onModeChange: (m: ButtonMode) => void
  onButtonsChange: (b: TemplateButton[]) => void
}) {
  const phoneCount = buttons.filter(b => b.type === 'PHONE_NUMBER').length
  const urlCount   = buttons.filter(b => b.type === 'URL').length

  function canAddQR()    { return mode === 'QUICK_REPLY' && buttons.length < QR_MAX }
  function canAddPhone() { return mode === 'CTA' && phoneCount < 1 && buttons.length < CTA_MAX }
  function canAddUrl()   { return mode === 'CTA' && urlCount < 2 && buttons.length < CTA_MAX }

  function addButton(type: CtaButtonType | 'QUICK_REPLY') {
    if (type === 'QUICK_REPLY') {
      onButtonsChange([...buttons, { type: 'QUICK_REPLY', text: '' }])
    } else if (type === 'PHONE_NUMBER') {
      onButtonsChange([...buttons, { type: 'PHONE_NUMBER', text: '', phone: '' }])
    } else {
      onButtonsChange([...buttons, { type: 'URL', text: '', url: '', urlExample: '' }])
    }
  }

  function removeButton(idx: number) {
    onButtonsChange(buttons.filter((_, i) => i !== idx))
  }

  function updateButton(idx: number, patch: Partial<TemplateButton>) {
    onButtonsChange(buttons.map((b, i) => i === idx ? { ...b, ...patch } as TemplateButton : b))
  }

  function handleModeChange(newMode: ButtonMode) {
    onModeChange(newMode)
    onButtonsChange([])
  }

  const hasUrlVar = (btn: TemplateButton) =>
    btn.type === 'URL' && /\{\{1\}\}/.test(btn.url)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Botões <Badge variant="outline" className="ml-2 text-xs font-normal">opcional</Badge></span>
          {buttons.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">{buttons.length}/{mode === 'QUICK_REPLY' ? QR_MAX : CTA_MAX}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode selector */}
        <div className="space-y-1.5">
          <Label>Tipo de botão</Label>
          <Select value={mode} onValueChange={v => handleModeChange(v as ButtonMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Nenhum</SelectItem>
              <SelectItem value="QUICK_REPLY">Resposta rápida</SelectItem>
              <SelectItem value="CTA">Call to Action (URL / Telefone)</SelectItem>
            </SelectContent>
          </Select>
          {mode === 'QUICK_REPLY' && (
            <p className="text-xs text-muted-foreground">Até {QR_MAX} botões de texto rápido. Não podem ser misturados com CTA.</p>
          )}
          {mode === 'CTA' && (
            <p className="text-xs text-muted-foreground">Até 1 telefone + 2 URLs (máx. {CTA_MAX} total).</p>
          )}
        </div>

        {/* Button list */}
        {buttons.length > 0 && (
          <div className="space-y-3">
            {buttons.map((btn, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {btn.type === 'QUICK_REPLY'   && <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                  {btn.type === 'PHONE_NUMBER'  && <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                  {btn.type === 'URL'           && <Link className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                  <span className="text-xs font-medium text-muted-foreground flex-1">
                    {btn.type === 'QUICK_REPLY'  && 'Resposta rápida'}
                    {btn.type === 'PHONE_NUMBER' && 'Número de telefone'}
                    {btn.type === 'URL'          && 'URL'}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeButton(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>

                {/* Texto do botão */}
                <div>
                  <Input
                    placeholder="Texto do botão (máx. 25 chars)"
                    value={btn.text}
                    maxLength={25}
                    onChange={e => updateButton(i, { text: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{btn.text.length}/25</p>
                </div>

                {/* Campos específicos por tipo */}
                {btn.type === 'PHONE_NUMBER' && (
                  <Input
                    placeholder="+5541999999999"
                    value={btn.phone}
                    onChange={e => updateButton(i, { phone: e.target.value })}
                    className="h-8 text-sm font-mono"
                  />
                )}
                {btn.type === 'URL' && (
                  <div className="space-y-1.5">
                    <Input
                      placeholder="https://exemplo.com/pagina/{{1}}"
                      value={btn.url}
                      onChange={e => updateButton(i, { url: e.target.value })}
                      className="h-8 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Use {`{{1}}`} para um parâmetro dinâmico na URL</p>
                    {hasUrlVar(btn) && (
                      <Input
                        placeholder="Exemplo da URL completa"
                        value={btn.urlExample}
                        onChange={e => updateButton(i, { urlExample: e.target.value })}
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add buttons */}
        {mode === 'QUICK_REPLY' && canAddQR() && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => addButton('QUICK_REPLY')}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar resposta rápida
          </Button>
        )}
        {mode === 'CTA' && (
          <div className="flex gap-2">
            {canAddPhone() && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => addButton('PHONE_NUMBER')}>
                <Phone className="h-3.5 w-3.5 mr-1.5" />Telefone
              </Button>
            )}
            {canAddUrl() && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => addButton('URL')}>
                <Link className="h-3.5 w-3.5 mr-1.5" />URL
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── CREATE TEMPLATE TAB ─────────────────────────────────────────────────────

function CreateTab() {
  const [account, setAccount] = useState<Account>('demo')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('UTILITY')
  const [language, setLanguage] = useState('pt_BR')
  const [headerFormat, setHeaderFormat] = useState('NONE')
  const [headerText, setHeaderText] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [headerExamples, setHeaderExamples] = useState<string[]>([])
  const [bodyExamples, setBodyExamples] = useState<string[]>([])
  const [buttonMode, setButtonMode] = useState<ButtonMode>('NONE')
  const [buttons, setButtons] = useState<TemplateButton[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    id?: string
    status?: string
    validationErrors?: Array<{ error: string; message: string }>
  } | null>(null)

  const headerVarCount = headerFormat === 'TEXT' ? extractMaxVar(headerText) : 0
  const bodyVarCount = extractMaxVar(bodyText)

  // Resize example arrays when var count changes
  useEffect(() => {
    setHeaderExamples(prev => {
      const next = [...prev]
      next.length = headerVarCount
      return next.fill('', prev.length)
    })
  }, [headerVarCount])

  useEffect(() => {
    setBodyExamples(prev => {
      const next = [...prev]
      next.length = bodyVarCount
      return next.fill('', prev.length)
    })
  }, [bodyVarCount])

  function setHeaderExample(idx: number, val: string) {
    setHeaderExamples(prev => { const n = [...prev]; n[idx] = val; return n })
  }

  function setBodyExample(idx: number, val: string) {
    setBodyExamples(prev => { const n = [...prev]; n[idx] = val; return n })
  }

  function buildComponents() {
    const comps: object[] = []

    if (headerFormat !== 'NONE') {
      if (headerFormat === 'TEXT') {
        comps.push({
          type: 'HEADER',
          format: 'TEXT',
          text: headerText,
          ...(headerVarCount > 0 ? { example: { header_text: headerExamples.slice(0, headerVarCount) } } : {}),
        })
      } else {
        comps.push({ type: 'HEADER', format: headerFormat })
      }
    }

    if (bodyText.trim()) {
      comps.push({
        type: 'BODY',
        text: bodyText,
        ...(bodyVarCount > 0 ? { example: { body_text: [bodyExamples.slice(0, bodyVarCount)] } } : {}),
      })
    }

    if (footerText.trim()) {
      comps.push({ type: 'FOOTER', text: footerText })
    }

    if (buttons.length > 0) {
      comps.push({
        type: 'BUTTONS',
        buttons: buttons.map(btn => {
          if (btn.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: btn.text }
          if (btn.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone }
          // URL
          const hasVar = /\{\{1\}\}/.test(btn.url)
          return {
            type: 'URL',
            text: btn.text,
            url: btn.url,
            ...(hasVar && btn.urlExample ? { example: [btn.urlExample] } : {}),
          }
        }),
      })
    }

    return comps
  }

  async function handleSubmit() {
    if (!name.trim()) { alert('Informe o nome do template.'); return }
    if (!bodyText.trim()) { alert('O corpo da mensagem é obrigatório.'); return }
    if (bodyVarCount > 0 && bodyExamples.slice(0, bodyVarCount).some(e => !e?.trim())) {
      alert('Preencha os exemplos de todas as variáveis do corpo.'); return
    }
    if (headerVarCount > 0 && headerExamples.slice(0, headerVarCount).some(e => !e?.trim())) {
      alert('Preencha os exemplos de todas as variáveis do cabeçalho.'); return
    }

    setSubmitting(true)
    setResult(null)
    try {
      const { data } = await api.post('/api/whatsapp/templates/create', {
        account,
        name: slugify(name),
        category,
        language,
        components: buildComponents(),
      })
      setResult({
        success: true,
        message: data.message,
        id: data.templateId,
        status: data.status,
        validationErrors: data.validationErrors ?? [],
      })
    } catch (err: any) {
      const errData = err.response?.data
      const errMsg = errData?.error || errData?.message || 'Erro ao criar template.'
      setResult({ success: false, message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setName(''); setCategory('UTILITY'); setLanguage('pt_BR')
    setHeaderFormat('NONE'); setHeaderText(''); setBodyText('')
    setFooterText(''); setHeaderExamples([]); setBodyExamples([])
    setButtonMode('NONE'); setButtons([])
    setResult(null)
  }

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações básicas</CardTitle>
          <CardDescription>Defina o nome, categoria e idioma do template</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Nome do template</Label>
              <Input
                placeholder="ex: boas_vindas_aluno"
                value={name}
                onChange={e => setName(slugify(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Minúsculas, sem espaços, apenas letras e _</p>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Select value={account} onValueChange={v => setAccount(v as Account)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="prod">Produção</SelectItem>
                </SelectContent>
              </Select>
              {account === 'prod' && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />Enviará para Meta real
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left — components builder */}
        <div className="space-y-4">
          {/* HEADER */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cabeçalho <Badge variant="outline" className="ml-2 text-xs font-normal">opcional</Badge></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Formato</Label>
                <Select value={headerFormat} onValueChange={v => { setHeaderFormat(v); setHeaderText(''); setHeaderExamples([]) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HEADER_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {headerFormat === 'TEXT' && (
                <div className="space-y-1.5">
                  <Label>Texto do cabeçalho</Label>
                  <Input
                    placeholder="Ex: Seu curso {{1}} começa amanhã!"
                    value={headerText}
                    onChange={e => setHeaderText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Use {`{{1}}`}, {`{{2}}`} para variáveis dinâmicas</p>
                  <VarExamples label="Exemplos do cabeçalho" count={headerVarCount} examples={headerExamples} onChange={setHeaderExample} />
                </div>
              )}
              {headerFormat !== 'NONE' && headerFormat !== 'TEXT' && (
                <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                  A URL da mídia será fornecida no momento do envio.
                </p>
              )}
            </CardContent>
          </Card>

          {/* BODY */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Corpo <Badge variant="secondary" className="ml-2 text-xs font-normal">obrigatório</Badge></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Texto da mensagem</Label>
                <Textarea
                  placeholder={"Olá {{1}}, seu acesso ao curso {{2}} foi liberado!\n\nClique no link para começar."}
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  rows={5}
                  className="resize-none font-mono text-sm"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Use {`{{1}}`}, {`{{2}}`} para variáveis dinâmicas</p>
                  <div className="flex gap-1">
                    {bodyVarCount > 0 && Array.from({ length: bodyVarCount }, (_, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-mono">{`{{${i + 1}}}`}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <VarExamples label="Exemplos das variáveis" count={bodyVarCount} examples={bodyExamples} onChange={setBodyExample} />
            </CardContent>
          </Card>

          {/* FOOTER */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rodapé <Badge variant="outline" className="ml-2 text-xs font-normal">opcional</Badge></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label>Texto do rodapé</Label>
                <Input
                  placeholder="Ex: Não responda esta mensagem"
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">{footerText.length}/60 caracteres · Não suporta variáveis</p>
              </div>
            </CardContent>
          </Card>

          {/* BUTTONS */}
          <ButtonsCard
            mode={buttonMode}
            buttons={buttons}
            onModeChange={setButtonMode}
            onButtonsChange={setButtons}
          />

          {/* Actions */}
          <div className="flex gap-3">
            <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {submitting ? 'Enviando para aprovação...' : 'Criar template'}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={submitting}>
              Limpar
            </Button>
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-lg border p-3 space-y-2 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2">
                {result.success
                  ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  : <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />}
                <div className="space-y-0.5 flex-1">
                  <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? 'Template criado!' : 'Erro ao criar template'}
                  </p>
                  <p className={`text-xs ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                    {result.message}
                  </p>
                  {result.id && (
                    <p className="text-xs text-green-600 font-mono">ID: {result.id}</p>
                  )}
                  {result.status && (
                    <p className="text-xs text-green-600">
                      Status: <strong>{result.status}</strong>
                    </p>
                  )}
                </div>
              </div>
              {/* Erros de validação retornados pelo Smarters */}
              {result.validationErrors && result.validationErrors.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 space-y-1">
                  <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Avisos de validação ({result.validationErrors.length})
                  </p>
                  {result.validationErrors.map((e, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      <span className="font-mono">{e.error}</span> — {e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — live preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4 text-green-500" />
                Prévia em tempo real
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap text-xs">
                <Badge variant="outline">{CATEGORIES.find(c => c.value === category)?.label}</Badge>
                <Badge variant="outline">{LANGUAGES.find(l => l.value === language)?.label}</Badge>
                {name && <Badge variant="secondary" className="font-mono">{name}</Badge>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WaBubble
                headerFormat={headerFormat}
                headerText={headerText}
                headerExamples={headerExamples}
                bodyText={bodyText}
                bodyExamples={bodyExamples}
                footerText={footerText}
                buttons={buttons}
              />
            </CardContent>
          </Card>

          {/* Structure summary */}
          {(headerFormat !== 'NONE' || bodyText || footerText || buttons.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Estrutura do template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {headerFormat !== 'NONE' && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">HEADER</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{HEADER_FORMATS.find(f => f.value === headerFormat)?.label}</Badge>
                      {headerVarCount > 0 && <span className="text-xs text-muted-foreground">{headerVarCount} var(s)</span>}
                    </div>
                  </div>
                )}
                {bodyText && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">BODY</span>
                    {bodyVarCount > 0 && <span className="text-xs text-muted-foreground">{bodyVarCount} variável(is)</span>}
                  </div>
                )}
                {footerText && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">FOOTER</span>
                    <span className="text-xs text-muted-foreground">Texto fixo</span>
                  </div>
                )}
                {buttons.length > 0 && (
                  <div className="flex items-start justify-between">
                    <span className="font-medium">BUTTONS</span>
                    <div className="space-y-0.5 text-right">
                      {buttons.map((b, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {b.type === 'QUICK_REPLY'  && `↩ ${b.text || 'Resposta rápida'}`}
                          {b.type === 'PHONE_NUMBER' && `☎ ${b.text || 'Telefone'}`}
                          {b.type === 'URL'          && `🔗 ${b.text || 'URL'}`}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          <Card className="bg-muted/40">
            <CardContent className="pt-4 space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-sm">Dicas para aprovação</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Templates de <strong>Marketing</strong> devem incluir opt-out (ex: rodapé)</li>
                <li>Exemplos de variáveis são obrigatórios pela Meta</li>
                <li>Nomes de template: minúsculas, sem espaços, apenas letras e _</li>
                <li>Aprovação pode levar de minutos a 24h</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── SEND TAB (existing functionality) ───────────────────────────────────────

function SendTab() {
  const [account, setAccount] = useState<Account>('demo')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [sendMode, setSendMode] = useState<SendMode>('single')
  const [phone, setPhone] = useState('')
  const [params, setParams] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null)
  const [singleResult, setSingleResult] = useState<{ success: boolean; messageId?: string; error?: string } | null>(null)

  useEffect(() => { fetchTemplates() }, [account])

  async function fetchTemplates() {
    setLoadingTemplates(true)
    setSelectedTemplate(null); setParams([]); setSingleResult(null); setBulkResults(null)
    try {
      const { data } = await api.get(`/api/whatsapp/templates?account=${account}`)
      setTemplates((data.templates || []).filter((t: Template) => t.status === 'APPROVED'))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao carregar templates')
      setTemplates([])
    } finally {
      setLoadingTemplates(false)
    }
  }

  function handleSelectTemplate(name: string) {
    const t = templates.find(t => t.name === name) || null
    setSelectedTemplate(t); setParams(t ? Array(t.paramInfo.totalParams).fill('') : [])
    setImageUrl(''); setSingleResult(null); setBulkResults(null)
  }

  function handleAccountChange(value: Account) {
    setAccount(value); setSelectedTemplate(null); setParams([]); setImageUrl('')
    setSingleResult(null); setBulkResults(null)
  }

  function getHeaderType(): 'text' | 'image' | 'none' {
    const header = selectedTemplate?.components.find(c => c.type === 'HEADER')
    if (!header) return 'none'
    const p = header.parameters?.[0]
    if (!p) return 'none'
    return p.type === 'image' ? 'image' : p.type === 'text' ? 'text' : 'none'
  }

  function headerCount(): number {
    return selectedTemplate?.paramInfo.byComponent.find(c => c.type === 'HEADER')?.count || 0
  }

  function renderComponentText(component: TemplateComponent): string {
    const raw = component.parameters?.[0]?.text
    if (!raw) return ''
    const offset = component.type === 'BODY' ? headerCount() : 0
    return raw.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const idx = offset + parseInt(n) - 1
      return params[idx] || `{{${n}}}`
    })
  }

  function buildComponents(): any[] {
    if (!selectedTemplate) return []
    const hType = getHeaderType(); const hCount = headerCount()
    const bodyCount = selectedTemplate.paramInfo.byComponent.find(c => c.type === 'BODY')?.count || 0
    const result: any[] = []
    if (hType === 'image') result.push({ type: 'HEADER', parameters: [{ type: 'image', image: { link: imageUrl.trim() } }] })
    else if (hType === 'text' && hCount > 0) result.push({ type: 'HEADER', parameters: params.slice(0, hCount).map(text => ({ type: 'text', text })) })
    if (bodyCount > 0) result.push({ type: 'BODY', parameters: params.slice(hCount, hCount + bodyCount).map(text => ({ type: 'text', text })) })
    return result
  }

  function getParamLabel(index: number): string {
    const hCount = headerCount()
    return index < hCount ? `Cabeçalho — param ${index + 1}` : `Corpo — param ${index - hCount + 1}`
  }

  function downloadCsvTemplate() {
    if (!selectedTemplate) return
    const total = selectedTemplate.paramInfo.totalParams
    const headers = ['phone', ...Array.from({ length: total }, (_, i) => `param_${i + 1}`)]
    const example = ['5541999999999', ...Array.from({ length: total }, (_, i) => `valor_${i + 1}`)]
    const csv = [headers.join(','), example.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${selectedTemplate.name}_modelo.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSend() {
    if (!selectedTemplate) return
    setSending(true); setSingleResult(null); setBulkResults(null)
    try {
      if (sendMode === 'single') {
        if (!phone.trim()) { alert('Informe o número de telefone.'); setSending(false); return }
        if (getHeaderType() === 'image' && !imageUrl.trim()) { alert('Informe a URL da imagem.'); setSending(false); return }
        const { data } = await api.post('/api/whatsapp/send', { phone: phone.trim(), account, templateName: selectedTemplate.name, locale: selectedTemplate.language, components: buildComponents() })
        setSingleResult({ success: true, messageId: data.messageId })
      } else {
        if (!csvFile) { alert('Selecione um arquivo CSV.'); setSending(false); return }
        const formData = new FormData()
        formData.append('account', account); formData.append('templateName', selectedTemplate.name)
        formData.append('locale', selectedTemplate.language); formData.append('file', csvFile)
        const { data } = await api.post('/api/whatsapp/send/bulk', formData, { headers: { 'Content-Type': undefined as any } })
        setBulkResults(data.results)
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao enviar mensagem'
      if (sendMode === 'single') setSingleResult({ success: false, error: msg })
      else alert(msg)
    } finally {
      setSending(false)
    }
  }

  const csvColumns = selectedTemplate
    ? ['phone', ...Array.from({ length: selectedTemplate.paramInfo.totalParams }, (_, i) => `param_${i + 1}`)].join(', ')
    : ''
  const bulkSuccess = bulkResults?.filter(r => r.success).length ?? 0
  const bulkFailed = bulkResults?.filter(r => !r.success).length ?? 0

  return (
    <div className="space-y-6">
      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>Selecione a conta e o template a ser enviado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta (chave)</Label>
              <Select value={account} onValueChange={handleAccountChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="prod">Produção</SelectItem>
                </SelectContent>
              </Select>
              {account === 'prod' && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />Mensagens serão enviadas de verdade
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</div>
              ) : (
                <Select value={selectedTemplate?.name || ''} onValueChange={handleSelectTemplate} disabled={templates.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={templates.length === 0 ? 'Nenhum template aprovado' : 'Selecione um template'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTemplate && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-green-500" />Prévia</CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                <span>{selectedTemplate.category}</span><span>·</span>
                <span>{selectedTemplate.language}</span><span>·</span>
                <Badge variant="outline" className="text-xs">{selectedTemplate.status}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl p-4 min-h-[180px] flex flex-col justify-end" style={{ backgroundColor: '#e5ddd5' }}>
                <div className="ml-auto max-w-[85%]">
                  <div className="rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm space-y-1.5 relative" style={{ backgroundColor: '#dcf8c6' }}>
                    {selectedTemplate.components.map((component, i) => {
                      if (component.type === 'HEADER') {
                        const hType = getHeaderType()
                        if (hType === 'image') return imageUrl
                          ? <img key={i} src={imageUrl} alt="Header" className="w-full rounded-lg object-cover max-h-40" />
                          : <div key={i} className="w-full rounded-lg flex items-center justify-center gap-2 text-gray-400 text-xs" style={{ backgroundColor: '#c8e6c9', height: '80px' }}><Image className="h-4 w-4" />Imagem</div>
                        const text = renderComponentText(component)
                        if (!text) return null
                        return <p key={i} className="font-semibold text-sm text-gray-900 whitespace-pre-wrap">{text}</p>
                      }
                      if (component.type === 'BODY') {
                        const text = renderComponentText(component)
                        if (!text) return null
                        return <p key={i} className="text-sm text-gray-900 whitespace-pre-wrap">{text}</p>
                      }
                      if (component.type === 'FOOTER') {
                        const text = component.parameters?.[0]?.text
                        if (!text) return null
                        return <p key={i} className="text-xs text-gray-500 whitespace-pre-wrap">{text}</p>
                      }
                      return null
                    })}
                    <p className="text-[10px] text-gray-500 text-right leading-none">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="absolute bottom-0 right-[-8px] w-0 h-0" style={{ borderTop: '8px solid #dcf8c6', borderLeft: '8px solid transparent' }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Send form */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Envio</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button variant={sendMode === 'single' ? 'default' : 'outline'} className="flex-1" onClick={() => { setSendMode('single'); setSingleResult(null); setBulkResults(null) }}><User className="h-4 w-4 mr-2" />Número único</Button>
                  <Button variant={sendMode === 'bulk' ? 'default' : 'outline'} className="flex-1" onClick={() => { setSendMode('bulk'); setSingleResult(null); setBulkResults(null) }}><Users className="h-4 w-4 mr-2" />Lote (CSV)</Button>
                </div>

                {sendMode === 'single' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input placeholder="5541999999999" value={phone} onChange={e => setPhone(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Com código do país, sem espaços</p>
                    </div>
                    {getHeaderType() === 'image' && (
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5"><Image className="h-3.5 w-3.5" />URL da imagem</Label>
                        <Input placeholder="https://exemplo.com/imagem.jpg" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
                      </div>
                    )}
                    {selectedTemplate.paramInfo.totalParams > 0 && (
                      <div className="space-y-3">
                        <Label>Parâmetros</Label>
                        {params.map((value, i) => (
                          <div key={i} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{getParamLabel(i)}</p>
                            <Input placeholder={`Valor do parâmetro ${i + 1}`} value={value} onChange={e => { const next = [...params]; next[i] = e.target.value; setParams(next) }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sendMode === 'bulk' && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-muted px-3 py-2.5 space-y-1.5">
                      <p className="text-sm font-medium">Formato CSV</p>
                      <p className="text-xs font-mono text-muted-foreground break-all">{csvColumns}</p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={downloadCsvTemplate}><Download className="h-3 w-3 mr-1" />Baixar modelo</Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Arquivo CSV</Label>
                      <Input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                      {csvFile && <p className="text-xs text-muted-foreground">{csvFile.name}</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button className="w-full" onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {sending ? 'Enviando...' : sendMode === 'single' ? 'Enviar mensagem' : 'Enviar lote'}
            </Button>

            {singleResult && (
              <div className={`rounded-lg border p-3 flex items-start gap-2 ${singleResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {singleResult.success
                  ? <><CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-green-800">Mensagem enviada!</p>{singleResult.messageId && <p className="text-xs text-green-700 font-mono mt-0.5 break-all">{singleResult.messageId}</p>}</div></>
                  : <><XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-red-800">Falha no envio</p><p className="text-xs text-red-700 mt-0.5">{singleResult.error}</p></div></>}
              </div>
            )}
          </div>
        </div>
      )}

      {bulkResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 flex-wrap">
              Resultado do lote
              <Badge variant="secondary">{bulkResults.length} registros</Badge>
              <Badge variant="outline" className="text-green-700 border-green-300">{bulkSuccess} enviados</Badge>
              {bulkFailed > 0 && <Badge variant="destructive">{bulkFailed} falhas</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Telefone</TableHead><TableHead>Status</TableHead><TableHead>ID / Erro</TableHead></TableRow></TableHeader>
              <TableBody>
                {bulkResults.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                    <TableCell><Badge variant={r.success ? 'default' : 'destructive'}>{r.success ? 'Enviado' : 'Falhou'}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono max-w-[300px] truncate">{r.success ? r.messageId : r.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── PAGE ROOT ────────────────────────────────────────────────────────────────

export default function WhatsappTemplatesPage() {
  const [tab, setTab] = useState<Tab>('send')

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Templates WhatsApp</h1>
          <p className="text-muted-foreground text-sm">Gerencie e envie templates de WhatsApp via Smarters</p>
        </div>
        {/* Tab navigation */}
        <div className="flex items-center bg-muted rounded-lg p-1 gap-1 flex-shrink-0">
          <Button
            variant={tab === 'send' ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => setTab('send')}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Envio
          </Button>
          <Button
            variant={tab === 'create' ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => setTab('create')}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Criar Template
          </Button>
        </div>
      </div>

      {tab === 'send' && <SendTab />}
      {tab === 'create' && <CreateTab />}
    </div>
  )
}
