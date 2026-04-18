import type { ExpiringContract, OverdueTask, UpcomingTask } from '@/lib/notifications/deadlines'

interface DigestData {
  userName: string
  overdueTasks: OverdueTask[]
  upcomingTasks: UpcomingTask[]
  expiringContracts: Record<number, ExpiringContract[]>
  newCasesCount: number
  appUrl: string
}

export function buildDigestHtml(data: DigestData): string {
  const { userName, overdueTasks, upcomingTasks, expiringContracts, newCasesCount, appUrl } = data

  const sections: string[] = []

  // Header
  sections.push(`<h2>Godmorgen, ${userName.split(' ')[0]}</h2>`)
  sections.push(`<p>Her er dit daglige overblik fra ChainHub.</p>`)

  // Forfaldne opgaver
  if (overdueTasks.length > 0) {
    sections.push(`<h3 style="color: #dc2626;">Forfaldne opgaver (${overdueTasks.length})</h3>`)
    sections.push('<ul>')
    for (const t of overdueTasks) {
      sections.push(
        `<li><strong>${t.title}</strong> — ${t.daysOverdue} dag${t.daysOverdue !== 1 ? 'e' : ''} forfalden${t.caseTitle ? ` (${t.caseTitle})` : ''}</li>`
      )
    }
    sections.push('</ul>')
  }

  // Kommende opgaver
  if (upcomingTasks.length > 0) {
    sections.push(`<h3>Opgaver de n\u00e6ste 7 dage (${upcomingTasks.length})</h3>`)
    sections.push('<ul>')
    for (const t of upcomingTasks) {
      sections.push(
        `<li><strong>${t.title}</strong> — om ${t.daysUntilDue} dag${t.daysUntilDue !== 1 ? 'e' : ''}${t.caseTitle ? ` (${t.caseTitle})` : ''}</li>`
      )
    }
    sections.push('</ul>')
  }

  // Udl\u00f8bende kontrakter efter hastighed
  for (const days of [7, 30, 90]) {
    const contracts = expiringContracts[days] ?? []
    if (contracts.length > 0) {
      const color = days <= 7 ? '#dc2626' : days <= 30 ? '#ea580c' : '#ca8a04'
      sections.push(
        `<h3 style="color: ${color};">Kontrakter der udl\u00f8ber inden ${days} dage (${contracts.length})</h3>`
      )
      sections.push('<ul>')
      for (const c of contracts) {
        sections.push(
          `<li><strong>${c.displayName}</strong> — ${c.companyName} (${c.daysUntilExpiry} dage)</li>`
        )
      }
      sections.push('</ul>')
    }
  }

  // Nye sager
  if (newCasesCount > 0) {
    sections.push(
      `<p>${newCasesCount} ny${newCasesCount !== 1 ? 'e' : ''} sag${newCasesCount !== 1 ? 'er' : ''} oprettet siden i g\u00e5r.</p>`
    )
  }

  // Ingen advarsler
  if (
    overdueTasks.length === 0 &&
    upcomingTasks.length === 0 &&
    Object.values(expiringContracts).every((v) => v.length === 0) &&
    newCasesCount === 0
  ) {
    sections.push(`<p>Ingen aktuelle advarsler — alt ser godt ud!</p>`)
  }

  // Footer
  sections.push(`<hr>`)
  sections.push(`<p><a href="${appUrl}/dashboard">\u00c5bn ChainHub</a></p>`)
  sections.push(
    `<p style="color: #9ca3af; font-size: 12px;">Denne email sendes automatisk fra ChainHub. Du kan ikke svare p\u00e5 den.</p>`
  )

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">${sections.join('\n')}</body></html>`
}

export function buildDigestSubject(overdueTasks: OverdueTask[]): string {
  if (overdueTasks.length > 0) {
    return `ChainHub: ${overdueTasks.length} forfaldn${overdueTasks.length !== 1 ? 'e' : ''} opgave${overdueTasks.length !== 1 ? 'r' : ''} kr\u00e6ver din opm\u00e6rksomhed`
  }
  return 'ChainHub: Dit daglige overblik'
}
