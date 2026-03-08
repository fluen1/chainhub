import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl

    // Tillad altid API auth routes
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next()
    }

    // Tjek om bruger er autentificeret for beskyttede routes
    const token = req.nextauth.token

    if (!token) {
      const signInUrl = new URL('/login', req.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Tillad altid auth-relaterede API routes
        if (pathname.startsWith('/api/auth')) {
          return true
        }

        // Kræv token for alle andre beskyttede routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    // Beskyt dashboard og alle undersider
    '/dashboard/:path*',
    '/companies/:path*',
    '/contracts/:path*',
    '/cases/:path*',
    '/tasks/:path*',
    '/persons/:path*',
    '/documents/:path*',
    '/settings/:path*',
    // Beskyt API routes undtagen auth
    '/api/((?!auth).)*',
  ],
}