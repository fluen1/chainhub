'use server'

import { prisma } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email/resend'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const requestResetSchema = z.object({
  email: z.string().email('Ugyldig e-mail-adresse'),
})

const resetPasswordSchema = z.object({
  token: z.string().uuid('Ugyldigt token-format'),
  newPassword: z.string().min(8, 'Adgangskoden skal være mindst 8 tegn'),
})

const NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

/**
 * requestPasswordReset — sender reset-link til alle brugere med denne email (på tværs af org).
 * Returnerer altid success for ikke at lække om email eksisterer.
 */
export async function requestPasswordReset(email: string): Promise<ActionResult<true>> {
  const parsed = requestResetSchema.safeParse({ email })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ugyldig e-mail-adresse' }
  }

  try {
    // Find alle brugere med denne email på tværs af organisationer
    const users = await prisma.user.findMany({
      where: {
        email: email.toLowerCase().trim(),
        deleted_at: null,
        active: true,
      },
      select: { id: true, name: true, email: true },
    })

    // Send email for hver matching bruger (security: vi afslører ikke om email eksisterer)
    if (users.length > 0) {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 time

      for (const user of users) {
        const token = await prisma.passwordResetToken.create({
          data: {
            token: crypto.randomUUID(),
            user_id: user.id,
            expires_at: expiresAt,
          },
        })

        const resetUrl = `${NEXTAUTH_URL}/login/reset?token=${token.token}`
        await sendPasswordResetEmail(user.email, resetUrl, user.name)
      }
    }

    return { data: true }
  } catch (err) {
    captureError(err, { namespace: 'action:requestPasswordReset' })
    // Returner altid success — ingen information-leakage
    return { data: true }
  }
}

/**
 * resetPassword — validerer token og opdaterer password_hash.
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ActionResult<true>> {
  const parsed = resetPasswordSchema.safeParse({ token, newPassword })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ugyldig input' }
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, deleted_at: true, active: true } } },
    })

    if (!resetToken) {
      return { error: 'Ugyldigt eller udløbet link — anmod om et nyt nulstillingslink' }
    }

    if (resetToken.used_at !== null) {
      return { error: 'Linket er allerede brugt — anmod om et nyt nulstillingslink' }
    }

    if (resetToken.expires_at < new Date()) {
      return { error: 'Linket er udløbet — anmod om et nyt nulstillingslink' }
    }

    if (!resetToken.user.active || resetToken.user.deleted_at !== null) {
      return { error: 'Ugyldigt eller udløbet link — anmod om et nyt nulstillingslink' }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.user_id },
        data: { password_hash: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used_at: new Date() },
      }),
    ])

    return { data: true }
  } catch (err) {
    captureError(err, { namespace: 'action:resetPassword' })
    return { error: 'Der opstod en fejl — prøv igen eller anmod om et nyt link' }
  }
}
