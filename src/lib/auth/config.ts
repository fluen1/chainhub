import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import AzureADProvider from 'next-auth/providers/azure-ad'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      organizationId: string
      avatarUrl?: string | null
    }
  }

  interface User {
    id: string
    email: string
    name: string
    organizationId: string
    avatarUrl?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    organizationId: string
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'database',
    maxAge: 24 * 60 * 60, // 24 timer absolut
    updateAge: 8 * 60 * 60, // Opdater session ved aktivitet efter 8 timer
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email og adgangskode',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Adgangskode', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email og adgangskode er påkrævet')
        }

        // Find bruger med password fra auth_credentials tabel
        const authCredential = await prisma.authCredential.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: {
            user: {
              include: {
                organization: true,
              },
            },
          },
        })

        if (!authCredential || !authCredential.user) {
          throw new Error('Ugyldig email eller adgangskode')
        }

        if (authCredential.user.deletedAt) {
          throw new Error('Denne konto er deaktiveret')
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          authCredential.passwordHash
        )

        if (!isValidPassword) {
          throw new Error('Ugyldig email eller adgangskode')
        }

        return {
          id: authCredential.user.id,
          email: authCredential.user.email,
          name: authCredential.user.name,
          organizationId: authCredential.user.organizationId,
          avatarUrl: authCredential.user.avatarUrl,
        }
      },
    }),
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      authorization: {
        params: {
          scope: 'openid profile email User.Read',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'azure-ad') {
        // Find eller opret bruger baseret på Microsoft ID
        const microsoftId = profile?.sub || (profile as any)?.oid
        const email = (profile?.email || user.email)?.toLowerCase()

        if (!email) {
          return false
        }

        // Tjek om bruger allerede eksisterer med denne Microsoft ID
        let existingUser = await prisma.user.findFirst({
          where: {
            microsoftId: microsoftId,
            deletedAt: null,
          },
        })

        // Hvis ikke, tjek om email matcher en eksisterende bruger
        if (!existingUser) {
          existingUser = await prisma.user.findFirst({
            where: {
              email: email,
              deletedAt: null,
            },
          })

          // Link Microsoft ID til eksisterende bruger
          if (existingUser) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { microsoftId: microsoftId },
            })
          }
        }

        if (!existingUser) {
          // Ny bruger via Microsoft - skal inviteres først
          // Return false for at forhindre automatisk oprettelse
          return '/login?error=NoAccount'
        }

        // Opdater user objekt med korrekte data
        user.id = existingUser.id
        user.organizationId = existingUser.organizationId
        user.name = existingUser.name
        user.email = existingUser.email
      }

      return true
    },
    async session({ session, user }) {
      // Hent bruger fra database for at få organizationId
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          organizationId: true,
          avatarUrl: true,
        },
      })

      if (!dbUser) {
        throw new Error('Bruger ikke fundet')
      }

      session.user = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        organizationId: dbUser.organizationId,
        avatarUrl: dbUser.avatarUrl,
      }

      return session
    },
  },
  events: {
    async signIn({ user }) {
      // Log successful login
      console.log(`User ${user.email} signed in`)
    },
    async signOut({ token }) {
      // Log signout
      console.log(`User signed out`)
    },
  },
}