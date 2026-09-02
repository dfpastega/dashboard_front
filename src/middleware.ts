import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const HOME = '/'
const DASHBOARD = '/dashboard'

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl

  // ignore estáticos/api
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname.startsWith('/api/') ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get('token')?.value

  // Só melhora UX: se logado e na home, manda pro dashboard.
  // Exceção: `?expired=1` — o cliente chegou aqui porque o JWT expirou (401);
  // o cookie pode ainda existir no browser, mas já não vale. Sem essa exceção
  // entraria em loop: / -> /dashboard -> /auth/me 401 -> / -> ...
  if (pathname === HOME && token && !searchParams.has('expired')) {
    const url = req.nextUrl.clone()
    url.pathname = DASHBOARD
    return NextResponse.redirect(url)
  }

  // Não bloqueia /dashboard aqui. Deixa a página se proteger.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
}
