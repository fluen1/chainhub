import NextAuth, { type NextAuthOptions, type DefaultSession, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string
      organizationId: string
      email: string
      name: string
    } & DefaultSession['user']
  }
  interface User {
    organizationId: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    organizationId: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const normalizedEmail = credentials.email.trim().toLowerCase()

        // Defensive auth-guard:
        // Email er kun unik pr. organisation i schemaet, så vi må ikke logge ind på
        // "første match" hvis samme email findes i flere tenants. I så fald afvises
        // login deterministisk indtil email er gjort entydig i data.
        const matchingUsers = await prisma.user.findMany({
          where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            deleted_at: null,
            active: true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            password_hash: true,
            organization_id: true,
          },
          take: 2,
        })

        if (matchingUsers.length !== 1) {
          return null
        }

        const user = matchingUsers[0]
        if (!user.password_hash) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash)

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organization_id,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.organizationId = user.organizationId
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.organizationId = token.organizationId
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
}

export async function auth() {
  return getServerSession(authOptions)
}

export default NextAuth(authOptions)
