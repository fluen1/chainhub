import { Resend } from 'resend'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://chainhub.dk'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'advisering@chainhub.dk'

// ==================== TYPER ====================

interface ContractInfo {
  id: string
  displayName: string
  systemType: string
  expiryDate: Date | null
  companyName: string
  organizationName: string
}

interface Recipient {
  id: string
  email: string
  name: string
}

export interface SendContractReminderParams {
  contract: ContractInfo
  daysUntilExpiry: number | null
  reminderType: string
  recipients: Recipient[]
  noticePeriodDays?: number
  advanceDays?: number
}

export interface SendAutoRenewalWarningParams {
  contract: ContractInfo
  noticePeriodDays: number
  daysUntilExpiry: number
  recipients: Recipient[]
}

export interface SendDeadlineReminderParams {
  deadline: {
    id: string
    title: string
    dueDate: Date
    priority: string
    organizationName: string
  }
  daysUntilDue: number
  recipients: Recipient[]
}

// ==================== HJÆLPEFUNKTIONER ====================

function formatContractType(systemType: string): string {
  const typeNames: Record<string, string> = {
    EJERAFTALE: 'Ejeraftale',
    DIREKTOERKONTRAKT: 'Direktørkontrakt',
    OVERDRAGELSESAFTALE: 'Overdragelsesaftale',
    AKTIONERLAN: 'Aktionærlån',
    PANTSAETNING: 'Pantsætningsaftale',
    VEDTAEGTER: 'Vedtægter',
    ANSAETTELSE_FUNKTIONAER: 'Ansættelseskontrakt (funktionær)',
    ANSAETTELSE_IKKE_FUNKTIONAER: 'Ansættelseskontrakt (ikke-funktionær)',
    VIKARAFTALE: 'Vikaraftale',
    UDDANNELSESAFTALE: 'Uddannelsesaftale',
    FRATRAEDELSESAFTALE: 'Fratrædelsesaftale',
    KONKURRENCEKLAUSUL: 'Konkurrenceklausul',
    PERSONALEHÅNDBOG: 'Personalehåndbog',
    LEJEKONTRAKT_ERHVERV: 'Erhvervslejekontrakt',
    LEASINGAFTALE: 'Leasingaftale',
    LEVERANDOERKONTRAKT: 'Leverandørkontrakt',
    SAMARBEJDSAFTALE: 'Samarbejdsaftale',
    NDA: 'Fortrolighedsaftale (NDA)',
    IT_SYSTEMAFTALE: 'IT-systemaftale',
    DBA: 'Databehandleraftale',
    FORSIKRING: 'Forsikringsaftale',
    GF_REFERAT: 'Generalforsamlingsreferat',
    BESTYRELSESREFERAT: 'Bestyrelsesreferat',
    FORRETNINGSORDEN: 'Forretningsorden',
    DIREKTIONSINSTRUKS: 'Direktionsinstruks',
    VOA: 'Vurderingsoverenskomst',
    INTERN_SERVICEAFTALE: 'Intern serviceaftale',
    ROYALTY_LICENS: 'Royalty- og licensaftale',
    OPTIONSAFTALE: 'Optionsaftale',
    TILTRAEDELSESDOKUMENT: 'Tiltrædelsesdokument',
    KASSEKREDIT: 'Kassekreditaftale',
    CASH_POOL: 'Cash pool-aftale',
    INTERCOMPANY_LAN: 'Intercompany-lån',
    SELSKABSGARANTI: 'Selskabsgaranti',
  }

  return typeNames[systemType] ?? systemType
}

function formatDate(date: Date): string {
  return format(date, "d. MMMM yyyy", { locale: da })
}

function getUrgencyText(days: number | null): string {
  if (days === null) return 'Løbende kontrakt'
  if (days <= 7) return '⚠️ KRITISK — Meget kort tid tilbage'
  if (days <= 30) return '🔔 VIGTIGT — Handl snart'
  return '📅 PÅMINDELSE — Kommende udløb'
}

function getContractUrl(contractId: string): string {
  return `${APP_URL}/contracts/${contractId}`
}

function getPriorityEmoji(priority: string): string {
  const map: Record<string, string> = {
    KRITISK: '🚨',
    HOEJ: '⚠️',
    MELLEM: '🔔',
    LAV: '📋',
  }
  return map[priority] ?? '📋'
}

// ==================== EMAIL SKABELONER ====================

function buildContractReminderHtml(params: {
  recipientName: string
  contract: ContractInfo
  daysUntilExpiry: number | null
  reminderType: string
  noticePeriodDays?: number
  advanceDays?: number
}): string {
  const { recipientName, contract, daysUntilExpiry, reminderType, noticePeriodDays, advanceDays } = params
  const contractUrl = getContractUrl(contract.id)
  const contractTypeName = formatContractType(contract.systemType)

  let urgencySection = ''
  let actionSection = ''
  let timeSection = ''

  if (reminderType === 'ONGOING_NOTICE') {
    // Løbende kontrakt
    urgencySection = `
      <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #92400E; font-weight: 600;">📋 Løbende kontrakt — Opsigelsesvarsel</p>
        <p style="margin: 8px 0 0 0; color: #78350F;">
          Denne kontrakt er løbende og kan opsiges med <strong>${noticePeriodDays} dages varsel</strong>.
          Du modtager denne påmindelse ${advanceDays} dage i forvejen, så du har god tid til at vurdere kontrakten.
        </p>
      </div>
    `
    actionSection = `
      <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #14532D; font-weight: 600;">Hvad bør du gøre?</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #166534;">
          <li>Gennemgå kontrakten og vurdér om den stadig er fordelagtig</li>
          <li>Beslut om kontrakten skal fortsætte eller opsiges</li>
          <li>Hvis opsigelse ønskes: send opsigelse senest ${noticePeriodDays} dage inden ønsket slutdato</li>
        </ul>
      </div>
    `
    timeSection = `<p style="color: #6B7280;"><strong>Opsigelsesvarsel:</strong> ${noticePeriodDays} dage</p>`
  } else {
    // Fast kontrakt
    const isUrgent = daysUntilExpiry !== null && daysUntilExpiry <= 7
    const isWarning = daysUntilExpiry !== null && daysUntilExpiry <= 30
    const bgColor = isUrgent ? '#FEE2E2' : isWarning ? '#FEF3C7' : '#EFF6FF'
    const borderColor = isUrgent ? '#EF4444' : isWarning ? '#F59E0B' : '#3B82F6'
    const textColor = isUrgent ? '#7F1D1D' : isWarning ? '#92400E' : '#1E3A5F'
    const urgencyText = getUrgencyText(daysUntilExpiry)

    urgencySection = `
      <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: ${textColor}; font-weight: 600; font-size: 16px;">${urgencyText}</p>
        <p style="margin: 8px 0 0 0; color: ${textColor};">
          ${daysUntilExpiry !== null
            ? `Kontrakten udløber om <strong>${daysUntilExpiry} dag${daysUntilExpiry === 1 ? '' : 'e'}</strong> den ${formatDate(contract.expiryDate!)}.`
            : ''}
        </p>
      </div>
    `

    actionSection = `
      <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #14532D; font-weight: 600;">Hvad bør du gøre?</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #166534;">
          <li>Gennemgå kontraktens vilkår og vurdér om den skal fornyes</li>
          <li>Tag kontakt til modparten i god tid inden udløb</li>
          <li>Opdatér status i ChainHub når der er truffet en beslutning</li>
          ${daysUntilExpiry !== null && daysUntilExpiry <= 7 ? '<li><strong>Kontrakten udløber meget snart — handl nu!</strong></li>' : ''}
        </ul>
      </div>
    `

    timeSection = `
      <p style="color: #6B7280;"><strong>Udløbsdato:</strong> ${contract.expiryDate ? formatDate(contract.expiryDate) : 'Ikke angivet'}</p>
      <p style="color: #6B7280;"><strong>Dage til udløb:</strong> ${daysUntilExpiry ?? '—'}</p>
    `
  }

  return `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kontraktpåmindelse — ChainHub</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F9FAFB; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background-color: #1E3A5F; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 700;">ChainHub</h1>
      <p style="color: #93C5FD; margin: 4px 0 0 0; font-size: 14px;">Kontraktstyring</p>
    </div>

    <!-- Body -->
    <div style="background-color: #FFFFFF; padding: 32px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

      <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">Kære ${recipientName},</p>

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Du modtager denne påmindelse vedrørende en kontrakt hos <strong>${contract.organizationName}</strong>.
      </p>

      <!-- Kontrakt info -->
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; color: #1E3A5F; font-size: 18px;">${contract.displayName}</h2>
        <p style="color: #6B7280; margin: 0 0 8px 0;"><strong>Kontrakttype:</strong> ${contractTypeName}</p>
        <p style="color: #6B7280; margin: 0 0 8px 0;"><strong>Selskab:</strong> ${contract.companyName}</p>
        ${timeSection}
      </div>

      ${urgencySection}
      ${actionSection}

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${contractUrl}"
           style="display: inline-block; background-color: #1E3A5F; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
          Åbn kontrakt i ChainHub →
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">

      <p style="color: #9CA3AF; font-size: 13px; margin: 0;">
        Denne besked er sendt automatisk af ChainHub. Du modtager påmindelser fordi du er registreret som ansvarlig eller modtager for denne kontrakt.
        <br><br>
        Har du spørgsmål? Kontakt os på <a href="mailto:support@chainhub.dk" style="color: #3B82F6;">support@chainhub.dk</a>
      </p>
    </div>

    <!-- Footer -->
    <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 16px;">
      © ${new Date().getFullYear()} ChainHub · Alle rettigheder forbeholdes
    </p>
  </div>
</body>
</html>
  `.trim()
}

function buildAutoRenewalHtml(params: {
  recipientName: string
  contract: ContractInfo
  noticePeriodDays: number
  daysUntilExpiry: number
}): string {
  const { recipientName, contract, noticePeriodDays, daysUntilExpiry } = params
  const contractUrl = getContractUrl(contract.id)
  const contractTypeName = formatContractType(contract.systemType)
  const deadlineDate = contract.expiryDate
    ? new Date(contract.expiryDate.getTime() - noticePeriodDays * 24 * 60 * 60 * 1000)
    : null

  return `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Automatisk fornyelse — ChainHub</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F9FAFB; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background-color: #1E3A5F; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 700;">ChainHub</h1>
      <p style="color: #93C5FD; margin: 4px 0 0 0; font-size: 14px;">Kontraktstyring</p>
    </div>

    <!-- Body -->
    <div style="background-color: #FFFFFF; padding: 32px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

      <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">Kære ${recipientName},</p>

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        En leverandørkontrakt hos <strong>${contract.organizationName}</strong> nærmer sig sin fornyelsesdato og vil automatisk blive fornyet medmindre du opsiger den.
      </p>

      <!-- Kontrakt info -->
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; color: #1E3A5F; font-size: 18px;">${contract.displayName}</h2>
        <p style="color: #6B7280; margin: 0 0 8px 0;"><strong>Kontrakttype:</strong> ${contractTypeName}</p>
        <p style="color: #6B7280; margin: 0 0 8px 0;"><strong>Selskab:</strong> ${contract.companyName}</p>
        <p style="color: #6B7280; margin: 0 0 8px 0;"><strong>Udløbsdato:</strong> ${contract.expiryDate ? formatDate(contract.expiryDate) : '—'}</p>
        <p style="color: #6B7280; margin: 0 0 8px 0;"><strong>Opsigelsesvarsel:</strong> ${noticePeriodDays} dage</p>
        <p style="color: #6B7280; margin: 0;"><strong>Dage til udløb:</strong> ${daysUntilExpiry}</p>
      </div>

      <!-- Advarsel -->
      <div style="background-color: #FFF7ED; border-left: 4px solid #F97316; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #7C2D12; font-weight: 600; font-size: 16px;">🔄 Automatisk fornyelse er aktiveret</p>
        <p style="margin: 8px 0 0 0; color: #9A3412;">
          Kontrakten fornyes automatisk ved udløb. Hvis du ønsker at opsige kontrakten,
          skal det ske <strong>senest ${deadlineDate ? formatDate(deadlineDate) : `om ${daysUntilExpiry - noticePeriodDays} dage`}</strong>
          for at overholde opsigelsesfristen på ${noticePeriodDays} dage.
        </p>
      </div>

      <!-- Handling -->
      <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #14532D; font-weight: 600;">Hvad bør du gøre?</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #166534;">
          <li>Gennemgå kontraktens vilkår og prissætning</li>
          <li>Vurdér om betingelserne stadig er acceptable</li>
          <li>Hvis <strong>fornyelse ønskes</strong>: ingen handling nødvendig — kontrakten fornyes automatisk</li>
          <li>Hvis <strong>opsigelse ønskes</strong>: send opsigelse til leverandøren senest ${deadlineDate ? formatDate(deadlineDate) : 'inden opsigelsesfristen'}</li>
          <li>Opdatér status i ChainHub til "Opsagt" hvis kontrakten opsiges</li>
        </ul>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${contractUrl}"
           style="display: inline-block; background-color: #1E3A5F; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
          Åbn kontrakt i ChainHub →
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">

      <p style="color: #9CA3AF; font-size: 13px; margin: 0;">
        Denne besked er sendt automatisk af ChainHub vedrørende automatisk kontraktfornyelse.
        <br><br>
        Har du spørgsmål? Kontakt os på <a href="mailto:support@chainhub.dk" style="color: #3B82F6;">support@chainhub.dk</a>
      </p>
    </div>

    <!-- Footer -->
    <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 16px;">
      © ${new Date().getFullYear()} ChainHub · Alle rettigheder forbeholdes
    </p>
  </div>
</body>
</html>
  `.trim()
}

function buildDeadlineReminderHtml(params: {
  recipientName: string
  deadline: {
    id: string
    title: string
    dueDate: Date
    priority: string
    organizationName: string
  }
  daysUntilDue: number
}): string {
  const { recipientName, deadline, daysUntilDue } = params
  const priorityEmoji = getPriorityEmoji(deadline.priority)
  const isUrgent = daysUntilDue <= 1
  const bgColor = isUrgent ? '#FEE2E2' : '#FEF3C7'
  const borderColor = isUrgent ? '#EF4444' : '#F59E0B'
  const textColor = isUrgent ? '#7F1D1D' : '#92400E'

  const deadlineUrl = `${APP_URL}/deadlines/${deadline.id}`

  return `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fristpåmindelse — ChainHub</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F9FAFB; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background-color: #1E3A5F; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 700;">ChainHub</h1>
      <p style="color: #93C5FD; margin: 4px 0 0 0; font-size: 14px;">Juridiske frister</p>
    </div>

    <!-- Body -->
    <div style="background-color: #FFFFFF; padding: 32px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

      <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">Kære ${recipientName},</p>

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        En juridisk frist hos <strong>${deadline.organizationName}</strong> nærmer sig.
      </p>

      <!-- Frist info -->
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; color: #1E3A5F; font-size: 18px;">${deadline.title}</h2>
        <p style="color: #6B7280; margin: 0 0 8px 0;"><strong>Forfaldsdato:</strong> ${formatDate(deadline.dueDate)}</p>
        <p style="color: #6B7280; margin: 0;"><strong>Prioritet:</strong> ${priorityEmoji} ${deadline.priority}</p>
      </div>

      <!-- Urgency -->
      <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: ${textColor}; font-weight: 600;">
          ${daysUntilDue === 0 ? '🚨 Fristen udløber I DAG!' : `Fristen udløber om ${daysUntilDue} dag${daysUntilDue === 1 ? '' : 'e'}`}
        </p>
        <p style="margin: 8px 0 0 0; color: ${textColor};">
          Sørg for at den nødvendige handling er udført inden fristens udløb.
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${deadlineUrl}"
           style="display: inline-block; background-color: #1E3A5F; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
          Se frist i ChainHub →
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">

      <p style="color: #9CA3AF; font-size: 13px; margin: 0;">
        Denne besked er sendt automatisk af ChainHub.
        Kontakt os på <a href="mailto:support@chainhub.dk" style="color: #3B82F6;">support@chainhub.dk</a> ved spørgsmål.
      </p>
    </div>

    <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 16px;">
      © ${new Date().getFullYear()} ChainHub · Alle rettigheder forbeholdes
    </p>
  </div>
</body>
</html>
  `.trim()
}

// ==================== EKSPORTEREDE FUNKTIONER ====================

export async function sendContractReminder(
  params: SendContractReminderParams
): Promise<void> {
  const { contract, daysUntilExpiry, reminderType, recipients, noticePeriodDays, advanceDays } =
    params

  // Bestem emnelinjen
  let subject: string
  if (reminderType === 'ONGOING_NOTICE') {
    subject = `📋 Påmindelse: Løbende kontrakt — ${contract.displayName}`
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 7) {
    subject = `🚨 KRITISK: Kontrakt udløber om ${daysUntilExpiry} dag${daysUntilExpiry === 1 ? '' : 'e'} — ${contract.displayName}`
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 30) {
    subject = `⚠️ Kontrakt udløber om ${daysUntilExpiry} dage — ${contract.displayName}`
  } else {
    subject = `📅 Påmindelse: Kontrakt udløber om ${daysUntilExpiry} dage — ${contract.displayName}`
  }

  // Send til hver modtager
  const emailPromises = recipients.map(async (recipient) => {
    const html = buildContractReminderHtml({
      recipientName: recipient.name,
      contract,
      daysUntilExpiry,
      reminderType,
      noticePeriodDays,
      advanceDays,
    })

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient.email,
      subject,
      html,
    })

    if (error) {
      throw new Error(
        `Resend fejl for ${recipient.email}: ${error.message ?? JSON.stringify(error)}`
      )
    }
  })

  // Kast fejl hvis nogen mails fejlede
  const results = await Promise.allSettled(emailPromises)
  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    const firstFailure = failures[0] as PromiseRejectedResult
    throw new Error(firstFailure.reason instanceof Error ? firstFailure.reason.message : 'Email-afsendelse fejlede')
  }
}

export async function sendAutoRenewalWarning(
  params: SendAutoRenewalWarningParams
): Promise<void> {
  const { contract, noticePeriodDays, daysUntilExpiry, recipients } = params

  const subject = `🔄 Automatisk fornyelse: ${contract.displayName} — Handl inden ${noticePeriodDays} dage`

  const emailPromises = recipients.map(async (recipient) => {
    const html = buildAutoRenewalHtml({
      recipientName: recipient.name,
      contract,
      noticePeriodDays,
      daysUntilExpiry,
    })

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient.email,
      subject,
      html,
    })

    if (error) {
      throw new Error(
        `Resend fejl for ${recipient.email}: ${error.message ?? JSON.stringify(error)}`
      )
    }
  })

  const results = await Promise.allSettled(emailPromises)
  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    const firstFailure = failures[0] as PromiseRejectedResult
    throw new Error(firstFailure.reason instanceof Error ? firstFailure.reason.message : 'Email-afsendelse fejlede')
  }
}

export async function sendDeadlineReminder(
  params: SendDeadlineReminderParams
): Promise<void> {
  const { deadline, daysUntilDue, recipients } = params

  const subject =
    daysUntilDue === 0
      ? `🚨 FRIST I DAG: ${deadline.title}`
      : `⏰ Frist om ${daysUntilDue} dag${daysUntilDue === 1 ? '' : 'e'}: ${deadline.title}`

  const emailPromises = recipients.map(async (recipient) => {
    const html = buildDeadlineReminderHtml({
      recipientName: recipient.name,
      deadline,
      daysUntilDue,
    })

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient.email,
      subject,
      html,
    })

    if (error) {
      throw new Error(
        `Resend fejl for ${recipient.email}: ${error.message ?? JSON.stringify(error)}`
      )
    }
  })

  const results = await Promise.allSettled(emailPromises)
  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    const firstFailure = failures[0] as PromiseRejectedResult
    throw new Error(firstFailure.reason instanceof Error ? firstFailure.reason.message : 'Email-afsendelse fejlede')
  }
}