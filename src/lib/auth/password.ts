import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Adgangskoden skal være mindst 8 tegn')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Adgangskoden skal indeholde mindst ét stort bogstav')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Adgangskoden skal indeholde mindst ét lille bogstav')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Adgangskoden skal indeholde mindst ét tal')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}