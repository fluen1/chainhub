/**
 * Microsoft Graph BCC-integration — Email Sync Placeholder
 *
 * Denne fil er en placeholder for Microsoft Graph BCC-integration.
 * Når MICROSOFT_CLIENT_ID er konfigureret, kan emails der er BCC'et til
 * en sag-specifik adresse automatisk synkroniseres til sagen.
 *
 * KONFIGURATIONSVEJLEDNING:
 * ─────────────────────────
 * 1. Gå til Azure Active Directory → App registrations → New registration
 * 2. Navngiv appen "ChainHub Email Sync"
 * 3. Under "Supported account types": vælg "Accounts in this organizational directory only"
 * 4. Kopier "Application (client) ID" → sæt som MICROSOFT_CLIENT_ID
 * 5. Gå til "Certificates & secrets" → New client secret → kopier → MICROSOFT_CLIENT_SECRET
 * 6. Gå til "API permissions" → Add permission → Microsoft Graph → Application permissions:
 *    - Mail.Read
 *    - Mail.ReadWrite
 *    - User.Read.All
 * 7. Klik "Grant admin consent"
 * 8. Sæt MICROSOFT_TENANT_ID til jeres Azure AD tenant ID
 *
 * BCC-FLOW:
 * ─────────
 * Hver sag får en unik BCC-adresse: case-{caseId}@mail.chainhub.dk
 * Brugere BCC'er denne adresse på relevante emails.
 * Microsoft Graph webhook notificerer ChainHub ved nye emails.
 * Emailen knyttes automatisk til sagen.
 */

export interface MicrosoftGraphConfig {
  clientId: string
  clientSecret: string
  tenantId: string
  mailDomain: string
}

export interface EmailMessage {
  id: string
  subject: string
  from: string
  receivedAt: Date
  bodyPreview: string
  body: string
  hasAttachments: boolean
}

/**
 * Tjekker om Microsoft Graph integration er konfigureret
 */
export function isMicrosoftGraphConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_TENANT_ID
  )
}

/**
 * Returnerer konfigurationsvejledning hvis integration ikke er opsat
 */
export function getMicrosoftGraphConfigurationGuide(): string {
  const missing: string[] = []

  if (!process.env.MICROSOFT_CLIENT_ID) missing.push('MICROSOFT_CLIENT_ID')
  if (!process.env.MICROSOFT_CLIENT_SECRET) missing.push('MICROSOFT_CLIENT_SECRET')
  if (!process.env.MICROSOFT_TENANT_ID) missing.push('MICROSOFT_TENANT_ID')

  if (missing.length === 0) return ''

  return (
    `Email-synkronisering kræver Microsoft Graph konfiguration. ` +
    `Manglende miljøvariabler: ${missing.join(', ')}. ` +
    `Se konfigurationsvejledningen i src/lib/email/microsoft-graph.ts.`
  )
}

/**
 * Genererer en unik BCC-email-adresse for en sag
 */
export function getCaseBccAddress(caseId: string): string {
  const mailDomain = process.env.MAIL_DOMAIN ?? 'mail.chainhub.dk'
  return `case-${caseId}@${mailDomain}`
}

/**
 * Henter emails tilknyttet en sag via Microsoft Graph
 *
 * PLACEHOLDER — kræver fuld Microsoft Graph implementation
 */
export async function getCaseEmails(
  _caseId: string,
  _config: MicrosoftGraphConfig
): Promise<EmailMessage[]> {
  if (!isMicrosoftGraphConfigured()) {
    throw new Error(getMicrosoftGraphConfigurationGuide())
  }

  // TODO: Implementér Microsoft Graph API kald
  // 1. Hent access token via client credentials flow
  // 2. Søg i mailbox efter emails med case BCC-adresse
  // 3. Returnér formaterede emails

  console.warn('Microsoft Graph email sync er ikke fuldt implementeret endnu')
  return []
}

/**
 * Registrerer en Microsoft Graph webhook for email-notifikationer
 *
 * PLACEHOLDER — kræver fuld Microsoft Graph implementation
 */
export async function registerEmailWebhook(
  _caseId: string,
  _callbackUrl: string,
  _config: MicrosoftGraphConfig
): Promise<{ subscriptionId: string; expiresAt: Date }> {
  if (!isMicrosoftGraphConfigured()) {
    throw new Error(getMicrosoftGraphConfigurationGuide())
  }

  // TODO: Implementér Microsoft Graph webhook registration
  // POST https://graph.microsoft.com/v1.0/subscriptions
  // {
  //   changeType: "created",
  //   notificationUrl: callbackUrl,
  //   resource: "me/mailFolders('Inbox')/messages",
  //   expirationDateTime: <48 timer fra nu>,
  //   clientState: <secret>
  // }

  throw new Error('Microsoft Graph webhook registration er ikke implementeret endnu')
}

/**
 * Email sync status for en sag
 */
export interface EmailSyncStatus {
  configured: boolean
  bccAddress: string | null
  configurationGuide: string
  lastSyncAt: Date | null
  emailCount: number
}

export function getEmailSyncStatus(caseId: string): EmailSyncStatus {
  const configured = isMicrosoftGraphConfigured()

  return {
    configured,
    bccAddress: configured ? getCaseBccAddress(caseId) : null,
    configurationGuide: configured ? '' : getMicrosoftGraphConfigurationGuide(),
    lastSyncAt: null, // TODO: Hent fra database
    emailCount: 0, // TODO: Hent fra database
  }
}