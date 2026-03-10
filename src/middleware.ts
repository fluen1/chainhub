import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: ['/dashboard/:path*', '/companies/:path*', '/contracts/:path*', '/cases/:path*', '/tasks/:path*', '/persons/:path*', '/documents/:path*', '/settings/:path*'],
}
