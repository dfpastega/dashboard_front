'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { api } from '@/lib/api'

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

type Account = 'demo' | 'prod'
type SendMode = 'single' | 'bulk'

export default function WhatsappTemplatesPage() {
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
  const [singleResult, setSingleResult] = useState<{
    success: boolean
    messageId?: string
    error?: string
  } | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [account])

  async function fetchTemplates() {
    setLoadingTemplates(true)
    setSelectedTemplate(null)
    setParams([])
    setSingleResult(null)
    setBulkResults(null)
    try {
      const { data } = await api.get(`/api/whatsapp/templates?account=${account}`)
      const approved = (data.templates || []).filter((t: Template) => t.status === 'APPROVED')
      setTemplates(approved)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao carregar templates')
      setTemplates([])
    } finally {
      setLoadingTemplates(false)
    }
  }

  function handleSelectTemplate(name: string) {
    const t = templates.find((t) => t.name === name) || null
    setSelectedTemplate(t)
    setParams(t ? Array(t.paramInfo.totalParams).fill('') : [])
    setImageUrl('')
    setSingleResult(null)
    setBulkResults(null)
  }

  function handleAccountChange(value: Account) {
    setAccount(value)
    setSelectedTemplate(null)
    setParams([])
    setImageUrl('')
    setSingleResult(null)
    setBulkResults(null)
  }

  function getHeaderType(): 'text' | 'image' | 'none' {
    const header = selectedTemplate?.components.find((c) => c.type === 'HEADER')
    if (!header) return 'none'
    const firstParam = header.parameters?.[0]
    if (!firstParam) return 'none'
    if (firstParam.type === 'image') return 'image'
    if (firstParam.type === 'text') return 'text'
    return 'none'
  }

  function headerCount(): number {
    return selectedTemplate?.paramInfo.byComponent.find((c) => c.type === 'HEADER')?.count || 0
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

  function buildComponents() {
    if (!selectedTemplate) return []
    const hType = getHeaderType()
    const hCount = headerCount()
    const bodyCount = selectedTemplate.paramInfo.byComponent.find((c) => c.type === 'BODY')?.count || 0
    const result: any[] = []

    if (hType === 'image') {
      result.push({
        type: 'HEADER',
        parameters: [{ type: 'image', image: { link: imageUrl.trim() } }],
      })
    } else if (hType === 'text' && hCount > 0) {
      result.push({
        type: 'HEADER',
        parameters: params.slice(0, hCount).map((text) => ({ type: 'text', text })),
      })
    }

    if (bodyCount > 0) {
      result.push({
        type: 'BODY',
        parameters: params.slice(hCount, hCount + bodyCount).map((text) => ({ type: 'text', text })),
      })
    }
    return result
  }

  function getParamLabel(index: number): string {
    const hCount = headerCount()
    if (index < hCount) return `Cabeçalho — param ${index + 1}`
    return `Corpo — param ${index - hCount + 1}`
  }

  function downloadCsvTemplate() {
    if (!selectedTemplate) return
    const total = selectedTemplate.paramInfo.totalParams
    const headers = ['phone', ...Array.from({ length: total }, (_, i) => `param_${i + 1}`)]
    const example = ['5541999999999', ...Array.from({ length: total }, (_, i) => `valor_${i + 1}`)]
    const csv = [headers.join(','), example.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedTemplate.name}_modelo.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSend() {
    if (!selectedTemplate) return
    setSending(true)
    setSingleResult(null)
    setBulkResults(null)
    try {
      if (sendMode === 'single') {
        if (!phone.trim()) {
          alert('Informe o número de telefone.')
          setSending(false)
          return
        }
        if (getHeaderType() === 'image' && !imageUrl.trim()) {
          alert('Informe a URL da imagem do cabeçalho.')
          setSending(false)
          return
        }
        const { data } = await api.post('/api/whatsapp/send', {
          phone: phone.trim(),
          account,
          templateName: selectedTemplate.name,
          locale: selectedTemplate.language,
          components: buildComponents(),
        })
        setSingleResult({ success: true, messageId: data.messageId })
      } else {
        if (!csvFile) {
          alert('Selecione um arquivo CSV.')
          setSending(false)
          return
        }
        const formData = new FormData()
        formData.append('account', account)
        formData.append('templateName', selectedTemplate.name)
        formData.append('locale', selectedTemplate.language)
        formData.append('file', csvFile)
        const { data } = await api.post('/api/whatsapp/send/bulk', formData, {
          headers: { 'Content-Type': undefined as any },
        })
        setBulkResults(data.results)
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Erro ao enviar mensagem'
      if (sendMode === 'single') {
        setSingleResult({ success: false, error: msg })
      } else {
        alert(msg)
      }
    } finally {
      setSending(false)
    }
  }

  const csvColumns = selectedTemplate
    ? ['phone', ...Array.from({ length: selectedTemplate.paramInfo.totalParams }, (_, i) => `param_${i + 1}`)].join(', ')
    : ''

  const bulkSuccess = bulkResults?.filter((r) => r.success).length ?? 0
  const bulkFailed = bulkResults?.filter((r) => !r.success).length ?? 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Envio de Templates</h1>
        <p className="text-muted-foreground text-sm">
          Envie templates de WhatsApp para um ou múltiplos destinatários
        </p>
      </div>

      {/* Config card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>Selecione a conta e o template a ser enviado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta (chave)</Label>
              <Select value={account} onValueChange={handleAccountChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="prod">Produção</SelectItem>
                </SelectContent>
              </Select>
              {account === 'prod' && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Atenção: mensagens serão enviadas de verdade
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando templates...
                </div>
              ) : (
                <Select
                  value={selectedTemplate?.name || ''}
                  onValueChange={handleSelectTemplate}
                  disabled={templates.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        templates.length === 0 ? 'Nenhum template aprovado' : 'Selecione um template'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTemplate && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* WhatsApp preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-500" />
                Prévia
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                <span>{selectedTemplate.category}</span>
                <span>·</span>
                <span>{selectedTemplate.language}</span>
                <span>·</span>
                <Badge variant="outline" className="text-xs">
                  {selectedTemplate.status}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Chat background */}
              <div
                className="rounded-xl p-4 min-h-[180px] flex flex-col justify-end"
                style={{ backgroundColor: '#e5ddd5' }}
              >
                <div className="ml-auto max-w-[85%]">
                  {/* Bubble */}
                  <div
                    className="rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm space-y-1.5 relative"
                    style={{ backgroundColor: '#dcf8c6' }}
                  >
                    {selectedTemplate.components.map((component, i) => {
                      if (component.type === 'HEADER') {
                        const hType = getHeaderType()
                        if (hType === 'image') {
                          return imageUrl ? (
                            <img
                              key={i}
                              src={imageUrl}
                              alt="Header"
                              className="w-full rounded-lg object-cover max-h-40"
                            />
                          ) : (
                            <div
                              key={i}
                              className="w-full rounded-lg flex items-center justify-center gap-2 text-gray-400 text-xs"
                              style={{ backgroundColor: '#c8e6c9', height: '80px' }}
                            >
                              <Image className="h-4 w-4" />
                              Imagem do cabeçalho
                            </div>
                          )
                        }
                        const text = renderComponentText(component)
                        if (!text) return null
                        return (
                          <p key={i} className="font-semibold text-sm text-gray-900 whitespace-pre-wrap">
                            {text}
                          </p>
                        )
                      }
                      if (component.type === 'BODY') {
                        const text = renderComponentText(component)
                        if (!text) return null
                        return (
                          <p key={i} className="text-sm text-gray-900 whitespace-pre-wrap">
                            {text}
                          </p>
                        )
                      }
                      if (component.type === 'FOOTER') {
                        const text = component.parameters?.[0]?.text
                        if (!text) return null
                        return (
                          <p key={i} className="text-xs text-gray-500 whitespace-pre-wrap">
                            {text}
                          </p>
                        )
                      }
                      return null
                    })}
                    <p className="text-[10px] text-gray-500 text-right leading-none">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {/* Bubble tail */}
                    <div
                      className="absolute bottom-0 right-[-8px] w-0 h-0"
                      style={{
                        borderTop: '8px solid #dcf8c6',
                        borderLeft: '8px solid transparent',
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Send form */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Envio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mode toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={sendMode === 'single' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => { setSendMode('single'); setSingleResult(null); setBulkResults(null) }}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Número único
                  </Button>
                  <Button
                    variant={sendMode === 'bulk' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => { setSendMode('bulk'); setSingleResult(null); setBulkResults(null) }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Lote (CSV)
                  </Button>
                </div>

                {/* Single mode */}
                {sendMode === 'single' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input
                        placeholder="5541999999999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Com código do país, sem espaços ou símbolos
                      </p>
                    </div>

                    {getHeaderType() === 'image' && (
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5">
                          <Image className="h-3.5 w-3.5" />
                          URL da imagem (cabeçalho)
                        </Label>
                        <Input
                          placeholder="https://exemplo.com/imagem.jpg"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          URL pública da imagem a ser enviada no cabeçalho
                        </p>
                      </div>
                    )}

                    {selectedTemplate.paramInfo.totalParams > 0 && (
                      <div className="space-y-3">
                        <Label>Parâmetros</Label>
                        {params.map((value, i) => (
                          <div key={i} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{getParamLabel(i)}</p>
                            <Input
                              placeholder={`Valor do parâmetro ${i + 1}`}
                              value={value}
                              onChange={(e) => {
                                const next = [...params]
                                next[i] = e.target.value
                                setParams(next)
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bulk mode */}
                {sendMode === 'bulk' && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-muted px-3 py-2.5 space-y-1.5">
                      <p className="text-sm font-medium">Formato esperado do CSV</p>
                      <p className="text-xs font-mono text-muted-foreground break-all">{csvColumns}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={downloadCsvTemplate}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Baixar modelo
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Arquivo CSV</Label>
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      />
                      {csvFile && (
                        <p className="text-xs text-muted-foreground">{csvFile.name}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button className="w-full" onClick={handleSend} disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sending
                ? 'Enviando...'
                : sendMode === 'single'
                ? 'Enviar mensagem'
                : 'Enviar lote'}
            </Button>

            {/* Single result */}
            {singleResult && (
              <div
                className={`rounded-lg border p-3 flex items-start gap-2 ${
                  singleResult.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {singleResult.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Mensagem enviada!</p>
                      {singleResult.messageId && (
                        <p className="text-xs text-green-700 font-mono mt-0.5 break-all">
                          {singleResult.messageId}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Falha no envio</p>
                      <p className="text-xs text-red-700 mt-0.5">{singleResult.error}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk results table */}
      {bulkResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 flex-wrap">
              Resultado do lote
              <Badge variant="secondary">{bulkResults.length} registros</Badge>
              <Badge variant="outline" className="text-green-700 border-green-300">
                {bulkSuccess} enviados
              </Badge>
              {bulkFailed > 0 && (
                <Badge variant="destructive">{bulkFailed} falhas</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ID / Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkResults.map((result, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{result.phone}</TableCell>
                    <TableCell>
                      <Badge variant={result.success ? 'default' : 'destructive'}>
                        {result.success ? 'Enviado' : 'Falhou'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono max-w-[300px] truncate">
                      {result.success ? result.messageId : result.error}
                    </TableCell>
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
