import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Videresend den faktiske pathname som header, så server-layouts
    // kan læse den pålideligt (x-invoke-path m.fl. er ikke garanteret).
    const res = NextResponse.next()
    res.headers.set('x-pathname', req.nextUrl.pathname)
    return res
  },
  {
    pages: {
      signIn: '/login',
    },
  }
)

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
