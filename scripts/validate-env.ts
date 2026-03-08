#!/usr/bin/env npx tsx
/**
 * validate-env.ts
 * 
 * Validates that all required environment variables are set.
 * Run at: npm run dev, npm run build
 * 
 * KRITISK: Stripe webhook URL SKAL have www-prefix (https://www.chainhub.dk/...)
 */

import * as fs from 'fs'
import * as path from 'path'

interface EnvVar {
  name: string
  required: boolean
  minLength?: number
  pattern?: RegExp
  patternMessage?: string
}

// Environment variables from .env.example with validation rules
const ENV_VARS: EnvVar[] = [
  { name: 'DATABASE_URL', required: true },
  { name: 'NEXTAUTH_URL', required: true },
  { 
    name: 'NEXTAUTH_SECRET', 
    required: true, 
    minLength: 32 
  },
  { name: 'MICROSOFT_CLIENT_ID', required: true },
  { name: 'MICROSOFT_CLIENT_SECRET', required: true },
  { name: 'MICROSOFT_TENANT_ID', required: true },
  { name: 'NEXT_PUBLIC_APP_URL', required: true },
  // Stripe vars - optional in dev, required in prod
  { 
    name: 'STRIPE_SECRET_KEY', 
    required: process.env.NODE_ENV === 'production' 
  },
  { 
    name: 'STRIPE_WEBHOOK_SECRET', 
    required: process.env.NODE_ENV === 'production' 
  },
]

// Special validation for production Stripe webhook URL
const STRIPE_WEBHOOK_URL_VAR = 'STRIPE_WEBHOOK_URL'
const WWW_PREFIX_PATTERN = /^https:\/\/www\./

function trimEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  // Trim whitespace and newlines - trailing newlines cause silent failures
  return value.trim()
}

function parseEnvExample(): string[] {
  const envExamplePath = path.join(process.cwd(), '.env.example')
  
  if (!fs.existsSync(envExamplePath)) {
    console.error('❌ .env.example not found')
    process.exit(1)
  }

  const content = fs.readFileSync(envExamplePath, 'utf-8')
  const vars: string[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue
    // Extract variable name
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=/)
    if (match) {
      vars.push(match[1])
    }
  }

  return vars
}

function validateEnv(): void {
  const isCI = process.argv.includes('--ci') || process.env.CI === 'true'
  const isProd = process.env.NODE_ENV === 'production'
  
  console.log('🔍 Validating environment variables...\n')

  const errors: string[] = []
  const warnings: string[] = []

  // Parse .env.example to get all expected variables
  const expectedVars = parseEnvExample()
  
  // Check all expected variables exist
  for (const varName of expectedVars) {
    const value = trimEnvValue(process.env[varName])
    
    // In CI mode, we only check that .env.example is parseable
    if (isCI) continue
    
    if (!value) {
      // Find if this var has special rules
      const varConfig = ENV_VARS.find(v => v.name === varName)
      if (varConfig?.required) {
        errors.push(`❌ ${varName} is required but not set`)
      } else {
        warnings.push(`⚠️  ${varName} is not set (optional)`)
      }
    }
  }

  // Validate specific variables with rules
  for (const varConfig of ENV_VARS) {
    const value = trimEnvValue(process.env[varConfig.name])
    
    if (isCI) continue
    
    if (value) {
      // Check minimum length
      if (varConfig.minLength && value.length < varConfig.minLength) {
        if (varConfig.name === 'NEXTAUTH_SECRET') {
          warnings.push(
            `⚠️  ${varConfig.name} is ${value.length} characters, ` +
            `recommended minimum is ${varConfig.minLength} characters for security`
          )
        } else {
          errors.push(
            `❌ ${varConfig.name} must be at least ${varConfig.minLength} characters`
          )
        }
      }

      // Check pattern
      if (varConfig.pattern && !varConfig.pattern.test(value)) {
        errors.push(
          `❌ ${varConfig.name}: ${varConfig.patternMessage || 'invalid format'}`
        )
      }
    }
  }

  // CRITICAL: Stripe webhook URL must have www prefix in production
  const stripeWebhookUrl = trimEnvValue(process.env[STRIPE_WEBHOOK_URL_VAR])
  if (stripeWebhookUrl && isProd) {
    if (!WWW_PREFIX_PATTERN.test(stripeWebhookUrl)) {
      errors.push(
        `❌ ${STRIPE_WEBHOOK_URL_VAR} MUST have www prefix in production!\n` +
        `   Current: ${stripeWebhookUrl}\n` +
        `   Required: https://www.chainhub.dk/api/webhooks/stripe\n` +
        `   ⚠️  Stripe webhooks will FAIL without www prefix!`
      )
    }
  }

  // Output results
  if (warnings.length > 0) {
    console.log('Warnings:')
    warnings.forEach(w => console.log(`  ${w}`))
    console.log('')
  }

  if (errors.length > 0) {
    console.log('Errors:')
    errors.forEach(e => console.log(`  ${e}`))
    console.log('')
    console.log(`\n❌ Environment validation failed with ${errors.length} error(s)`)
    console.log('   Please check your .env file against .env.example\n')
    process.exit(1)
  }

  if (isCI) {
    console.log('✅ .env.example parsed successfully (CI mode)\n')
  } else {
    console.log('✅ All required environment variables are set\n')
  }
}

// Run validation
validateEnv()