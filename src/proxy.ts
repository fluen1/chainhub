// Next.js 16+ bruger proxy.ts i stedet for middleware.ts til route-beskyttelse.
// authMiddleware har den fulde NextAuth-overload inkl. middleware-signaturen.
import { authMiddleware } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const proxy = authMiddleware((req) => {
  // Videresend den faktiske pathname som header, så server-layouts
  // kan læse den pålideligt (x-invoke-path m.fl. er ikke garanteret).
  const res = NextResponse.next()
  res.headers.set('x-pathname', req.nextUrl.pathname)
  return res
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/companies/:path*',
    '/contracts/:path*',
    '/cases/:path*',
    '/tasks/:path*',
    '/persons/:path*',
    '/documents/:path*',
    '/settings/:path*',
    '/billing/:path*',
    '/calendar/:path*',
    '/search/:path*',
    '/visits/:path*',
  ],
}
