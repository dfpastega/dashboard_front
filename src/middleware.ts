// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard'] // adicione outras rotas protegidas aqui
const HOME = '/'
const DASHBOARD = '/dashboard'

function isProtected(pathname: string) {
  return PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Ignora assets, arquivos estáticos e API routes
  // - _next/*: assets do Next
  // - .*: qualquer arquivo (ex: .ico, .png, .js, .css)
  // - api/*: API Routes do Next (se você tiver)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname.match(/\.[^/]+$/) || // tem extensão
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get('token')?.value

  // Se tentar acessar rota protegida sem token → vai para login (/)
  if (isProtected(pathname) && !token) {
    const url = req.nextUrl.clone()
    url.pathname = HOME
    const res = NextResponse.redirect(url)
    res.headers.set('x-auth-debug', 'no-token->login')
    return res
  }

  // Se já estiver logado e for para a home, manda pro dashboard (opcional)
  if (pathname === HOME && token) {
    const url = req.nextUrl.clone()
    url.pathname = DASHBOARD
    const res = NextResponse.redirect(url)
    res.headers.set('x-auth-debug', 'has-token->dashboard')
    return res
  }

  // Deixa passar
  const res = NextResponse.next()
  res.headers.set('x-auth-debug', token ? 'has-token' : 'no-token')
  return res
}

// Limita o escopo do middleware para tudo que não seja estático/api:
export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
}
