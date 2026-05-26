import { prisma } from '@/lib/db'

/**
 * Bygger system-prompt til AI-assistenten med kontekst om organisationens
 * nuværende tilstand. Bruges som system-besked i hvert LLM-kald.
 */
export async function buildSystemPrompt(organizationId: string, _userId: string): Promise<string> {
  const [companies, contracts, activeContracts, alerts, criticalAlerts] = await Promise.all([
    prisma.company.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.contract.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.contract.count({
      where: { organization_id: organizationId, status: 'AKTIV', deleted_at: null },
    }),
    prisma.alert.count({ where: { organization_id: organizationId, dismissed_at: null } }),
    prisma.alert.count({
      where: { organization_id: organizationId, dismissed_at: null, severity: 'CRITICAL' },
    }),
  ])

  const now = new Date().toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `Du er ChainHub AI-assistent — en intelligent assistent til kædegrupper og porteføljestyring.

## Porteføljestatus (pr. ${now})
- Selskaber: ${companies}
- Kontrakter i alt: ${contracts} (${activeContracts} aktive)
- Aktive advarsler: ${alerts} (${criticalAlerts} kritiske)

## Dine kompetencer
Du har adgang til følgende værktøjer:
- **search_contracts** — søg i kontrakter (filtrér på status, type, udløbsdato)
- **search_companies** — søg i selskaber (filtrér på navn, CVR, status)
- **search_persons** — søg i persondatabasen
- **get_alerts** — hent aktive advarsler og notifikationer
- **generate_report** — generer rapport over et selskab eller hele porteføljen
- **create_task** — opret opgave (kræver bekræftelse)
- **create_case** — opret sag (kræver bekræftelse)
- **create_reminder** — opret påmindelse (kræver bekræftelse)

## Regler
1. Svar ALTID på dansk.
2. Vær præcis og handlingsorienteret — undgå unødig snak.
3. Brug søgeværktøjer til at finde data FØR du svarer på faktaspørgsmål.
4. For write-operationer (create_task, create_case, create_reminder): præsenter altid hvad der vil ske og afvent brugerens bekræftelse.
5. Henvis aldrig til data du ikke har hentet via et værktøj.
6. Multi-tenancy: du har kun adgang til denne organisations data — aldrig på tværs.
7. Prioriter kritiske advarsler og nærtstående deadlines i dine svar.`
}
