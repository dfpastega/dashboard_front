// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('token')

  const isAuth = !!token
  const isLoginPage = req.nextUrl.pathname === '/'

  if (!isAuth && !isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/'] // protege essas rotas
}
