import { DeadlineInfo, formatDaysUntilDeadline } from '@/lib/contracts/deadline-calculator'
import { APP_URL } from '../resend'

interface ContractReminderEmailData {
  recipientName: string
  deadline: DeadlineInfo
  companyName: string
  organizationName: string
}

export function generateContractReminderSubject(deadline: DeadlineInfo): string {
  if (deadline.reminderType === 'NOTICE_PERIOD') {
    return `⚠️ Opsigelsesvarsel for ${deadline.contractName}`
  }
  
  const daysText = {
    'DAYS_90': '90 dage',
    'DAYS_30': '30 dage',
    'DAYS_7': '7 dage',
  }[deadline.reminderType]
  
  return `⏰ ${deadline.contractName} udløber om ${daysText}`
}

export function generateContractReminderHtml(data: ContractReminderEmailData): string {
  const { recipientName, deadline, companyName, organizationName } = data
  const contractUrl = `${APP_URL}/contracts/${deadline.contractId}`
  
  let actionText: string
  let urgencyColor: string
  let mainMessage: string
  
  if (deadline.reminderType === 'NOTICE_PERIOD') {
    actionText = 'Gennemgå og tag stilling til fornyelse'
    urgencyColor = '#f59e0b' // amber
    mainMessage = `
      <p>Kontrakten <strong>${deadline.contractName}</strong> for <strong>${companyName}</strong> 
      har en opsigelsesperiode på <strong>${deadline.noticePeriodDays} dage</strong>.</p>
      <p>For at undgå automatisk fornyelse skal du handle inden den seneste opsigelsesdato.</p>
      ${deadline.isAutoRenewal 
        ? '<p style="color: #f59e0b; font-weight: bold;">⚠️ Denne kontrakt fornyes automatisk hvis der ikke opsiges rettidigt.</p>'
        : ''
      }
    `
  } else {
    const daysUntil = {
      'DAYS_90': 90,
      'DAYS_30': 30,
      'DAYS_7': 7,
    }[deadline.reminderType]
    
    urgencyColor = daysUntil === 7 ? '#ef4444' : daysUntil === 30 ? '#f59e0b' : '#3b82f6'
    actionText = daysUntil === 7 
      ? 'Handling påkrævet nu' 
      : daysUntil === 30 
        ? 'Planlæg handling snart'
        : 'Forbered dig på udløb'
    
    mainMessage = `
      <p>Kontrakten <strong>${deadline.contractName}</strong> for <strong>${companyName}</strong> 
      udløber <strong>${formatDaysUntilDeadline(deadline.daysUntilDeadline)}</strong> 
      (${deadline.deadlineDate.toLocaleDateString('da-DK', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}).</p>
      ${deadline.isAutoRenewal 
        ? '<p style="color: #f59e0b;">⚠️ Denne kontrakt har automatisk fornyelse.</p>'
        : ''
      }
    `
  }
  
  return `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kontraktadvisering fra ChainHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">
                      ChainHub
                    </h1>
                  </td>
                  <td style="text-align: right;">
                    <span style="display: inline-block; padding: 4px 12px; background-color: ${urgencyColor}; color: white; border-radius: 9999px; font-size: 12px; font-weight: 500;">
                      ${actionText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #374151;">
                Hej ${recipientName},
              </p>
              
              <div style="margin: 24px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid ${urgencyColor};">
                ${mainMessage}
              </div>
              
              <!-- Contract Details -->
              <table role="presentation" style="width: 100%; margin: 24px 0; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Kontrakt</span><br>
                    <strong style="color: #111827;">${deadline.contractName}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Selskab</span><br>
                    <strong style="color: #111827;">${companyName}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Udløbsdato</span><br>
                    <strong style="color: #111827;">
                      ${deadline.deadlineDate.toLocaleDateString('da-DK', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </strong>
                  </td>
                </tr>
                ${deadline.noticePeriodDays ? `
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #6b7280; font-size: 14px;">Opsigelsesvarsel</span><br>
                    <strong style="color: #111827;">${deadline.noticePeriodDays} dage</strong>
                  </td>
                </tr>
                ` : ''}
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${contractUrl}" 
                       style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                      Se kontrakt i ChainHub →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
                Du modtager denne email fordi du er sat op som modtager af adviseringer for denne kontrakt.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                ${organizationName} • Sendt via <a href="${APP_URL}" style="color: #2563eb; text-decoration: none;">ChainHub</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function generateContractReminderText(data: ContractReminderEmailData): string {
  const { recipientName, deadline, companyName, organizationName } = data
  const contractUrl = `${APP_URL}/contracts/${deadline.contractId}`
  
  let mainMessage: string
  
  if (deadline.reminderType === 'NOTICE_PERIOD') {
    mainMessage = `
Kontrakten "${deadline.contractName}" for ${companyName} har en opsigelsesperiode på ${deadline.noticePeriodDays} dage.

For at undgå automatisk fornyelse skal du handle inden den seneste opsigelsesdato.
${deadline.isAutoRenewal ? '\n⚠️ Denne kontrakt fornyes automatisk hvis der ikke opsiges rettidigt.\n' : ''}
`
  } else {
    mainMessage = `
Kontrakten "${deadline.contractName}" for ${companyName} udløber ${formatDaysUntilDeadline(deadline.daysUntilDeadline)} (${deadline.deadlineDate.toLocaleDateString('da-DK')}).
${deadline.isAutoRenewal ? '\n⚠️ Denne kontrakt har automatisk fornyelse.\n' : ''}
`
  }
  
  return `
Hej ${recipientName},

${mainMessage}

Kontraktdetaljer:
- Kontrakt: ${deadline.contractName}
- Selskab: ${companyName}
- Udløbsdato: ${deadline.deadlineDate.toLocaleDateString('da-DK')}
${deadline.noticePeriodDays ? `- Opsigelsesvarsel: ${deadline.noticePeriodDays} dage` : ''}

Se kontrakten i ChainHub: ${contractUrl}

---
${organizationName}
Sendt via ChainHub
`
}