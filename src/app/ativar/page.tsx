'use client'

/**
 * Landing pública de ativação por afinidade (Blueprint §8).
 * Três passos: verificação → WhatsApp+OTP → confirmação.
 * Regras: mensagens genéricas (anti-enumeração), sem PII em storage/URL,
 * Turnstile opcional (arma quando NEXT_PUBLIC_TURNSTILE_SITE_KEY existir).
 */

import { useState, useRef, useEffect } from 'react'
import Script from 'next/script'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''
const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

type Step = 'dados' | 'whatsapp' | 'codigo' | 'confirmar' | 'sucesso'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => void
    }
  }
}

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

function maskDate(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

async function post(path: string, body: object): Promise<{ ok: boolean; data: { status?: string } }> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  } catch {
    return { ok: false, data: {} }
  }
}

export default function AtivarPage() {
  const [step, setStep] = useState<Step>('dados')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [consent, setConsent] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  const captchaToken = useRef('')
  const captchaEl = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  function renderCaptcha() {
    if (TURNSTILE_KEY && captchaEl.current && window.turnstile) {
      window.turnstile.render(captchaEl.current, {
        sitekey: TURNSTILE_KEY,
        callback: (t) => { captchaToken.current = t },
      })
    }
  }

  const payloadBase = () => ({
    cpf: cpf.replace(/\D/g, ''),
    birthDate,
    captchaToken: captchaToken.current,
  })

  async function checkEligibility() {
    setError('')
    if (cpf.replace(/\D/g, '').length !== 11 || birthDate.replace(/\D/g, '').length !== 8) {
      setError('Preencha CPF e data de nascimento completos.')
      return
    }
    setLoading(true)
    const { data } = await post('/api/affinity/check', payloadBase())
    setLoading(false)
    if (data.status === 'eligible') {
      setStep('whatsapp')
    } else if (data.status === 'rate_limited') {
      setError('Muitas tentativas. Aguarde um minuto e tente de novo.')
    } else {
      setError('Não localizamos seu cadastro. Confira os dados ou fale com o RH da sua empresa.')
    }
  }

  async function sendOtp() {
    setError('')
    if (fullName.trim().split(' ').length < 2) {
      setError('Informe seu nome completo.')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Informe um email válido (usado no certificado e nota fiscal).')
      return
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Informe um número de WhatsApp válido com DDD.')
      return
    }
    setLoading(true)
    await post('/api/affinity/otp', { ...payloadBase(), phone: phone.replace(/\D/g, '') })
    setLoading(false)
    setResendIn(60)
    setStep('codigo')
  }

  async function activate() {
    setError('')
    if (otp.replace(/\D/g, '').length !== 6) {
      setError('Digite o código de 6 dígitos recebido no WhatsApp.')
      return
    }
    if (!consent) {
      setError('É preciso aceitar os termos para ativar.')
      return
    }
    setLoading(true)
    const { ok, data } = await post('/api/affinity/activate', {
      ...payloadBase(),
      phone: phone.replace(/\D/g, ''),
      otp: otp.replace(/\D/g, ''),
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
    })
    setLoading(false)
    if (data.status === 'processing') {
      setStep('sucesso')
    } else if (!ok && data.status === 'invalid_code') {
      setError('Código incorreto ou expirado. Confira no WhatsApp ou reenvie.')
    } else {
      setError('Não foi possível concluir agora. Tente novamente em instantes.')
    }
  }

  const stepIndex = { dados: 1, whatsapp: 2, codigo: 2, confirmar: 3, sucesso: 3 }[step]

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100">
      {TURNSTILE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          onLoad={renderCaptcha}
        />
      )}
      <div className="mx-auto w-full max-w-md">
        <header className="mb-8 text-center">
          <p className="text-3xl font-black tracking-tight">⚡ STORM</p>
          <h1 className="mt-2 text-xl font-semibold text-balance">
            Ative seu curso de inglês no WhatsApp
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Benefício oferecido pela sua empresa. Leva menos de 2 minutos.
          </p>
        </header>

        {/* progresso */}
        {step !== 'sucesso' && (
          <ol className="mb-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            {['Seus dados', 'WhatsApp', 'Confirmação'].map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    i + 1 <= stepIndex ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={i + 1 === stepIndex ? 'text-slate-200' : ''}>{label}</span>
                {i < 2 && <span className="h-px w-6 bg-slate-700" />}
              </li>
            ))}
          </ol>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          {step === 'dados' && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); checkEligibility() }}>
              <div>
                <label htmlFor="cpf" className="mb-1 block text-sm font-medium">CPF</label>
                <input
                  id="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                  value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label htmlFor="nasc" className="mb-1 block text-sm font-medium">Data de nascimento</label>
                <input
                  id="nasc" inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA"
                  value={birthDate} onChange={(e) => setBirthDate(maskDate(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-amber-400"
                />
              </div>
              <div ref={captchaEl} />
              <button
                type="submit" disabled={loading}
                className="w-full rounded-lg bg-amber-400 py-3 font-bold text-slate-900 transition hover:bg-amber-300 disabled:opacity-60"
              >
                {loading ? 'Verificando…' : 'Verificar meus dados'}
              </button>
            </form>
          )}

          {(step === 'whatsapp' || step === 'codigo') && (
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); step === 'whatsapp' ? sendOtp() : activate() }}
            >
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                ✓ Cadastro localizado! Agora informe o WhatsApp que receberá o curso.
              </p>
              <div>
                <label htmlFor="nome" className="mb-1 block text-sm font-medium">Nome completo</label>
                <input
                  id="nome" autoComplete="name" placeholder="Como no seu documento"
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  disabled={step === 'codigo'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-amber-400 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
                <input
                  id="email" type="email" autoComplete="email" placeholder="voce@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  disabled={step === 'codigo'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-amber-400 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="fone" className="mb-1 block text-sm font-medium">WhatsApp (com DDD)</label>
                <input
                  id="fone" inputMode="numeric" autoComplete="tel-national" placeholder="(11) 91234-5678"
                  value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))}
                  disabled={step === 'codigo'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-amber-400 disabled:opacity-60"
                />
              </div>

              {step === 'whatsapp' && (
                <button
                  type="submit" disabled={loading}
                  className="w-full rounded-lg bg-amber-400 py-3 font-bold text-slate-900 transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {loading ? 'Enviando…' : 'Receber código no WhatsApp'}
                </button>
              )}

              {step === 'codigo' && (
                <>
                  <div>
                    <label htmlFor="otp" className="mb-1 block text-sm font-medium">
                      Código de 6 dígitos (enviado no seu WhatsApp)
                    </label>
                    <input
                      id="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" maxLength={6}
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-center text-xl tracking-[0.5em] outline-none focus:border-amber-400"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 accent-amber-400"
                    />
                    <span>
                      Autorizo o uso dos meus dados (nome e WhatsApp) para ativação e envio do curso,
                      conforme a LGPD. O benefício é vinculado ao contrato da minha empresa.
                    </span>
                  </label>
                  <button
                    type="submit" disabled={loading}
                    className="w-full rounded-lg bg-amber-400 py-3 font-bold text-slate-900 transition hover:bg-amber-300 disabled:opacity-60"
                  >
                    {loading ? 'Ativando…' : 'Confirmar ativação'}
                  </button>
                  <button
                    type="button" disabled={resendIn > 0 || loading} onClick={sendOtp}
                    className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
                  >
                    {resendIn > 0 ? `Reenviar código em ${resendIn}s` : 'Reenviar código'}
                  </button>
                </>
              )}
            </form>
          )}

          {step === 'sucesso' && (
            <div className="space-y-4 text-center">
              <p className="text-5xl">🎉</p>
              <h2 className="text-lg font-semibold">Ativação confirmada!</h2>
              <p className="text-sm text-slate-300">
                A Storm vai te chamar no WhatsApp <span className="font-medium text-slate-100">{phone}</span> em
                instantes com a sua mensagem de boas-vindas. É só responder para começar. 🚀
              </p>
              <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
                Não recebeu em 10 minutos? Fale com o suporte da Storm ou com o RH da sua empresa.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
        </section>

        <footer className="mt-6 text-center text-xs text-slate-500">
          Storm Education · Seus dados são usados somente para a ativação (LGPD).
        </footer>
      </div>
    </main>
  )
}
