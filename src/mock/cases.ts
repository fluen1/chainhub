import type { DataScenario } from './types'

export type CaseType = 'TRANSAKTION' | 'TVIST' | 'COMPLIANCE' | 'KONTRAKT' | 'GOVERNANCE'
export type CaseStatus = 'NY' | 'AKTIV' | 'AFVENTER_EKSTERN' | 'AFVENTER_KLIENT' | 'LUKKET'

export interface MockCase {
  id: string
  caseNumber: string
  title: string
  type: CaseType
  typeLabel: string
  status: CaseStatus
  statusLabel: string
  companyId: string
  companyName: string
  openedDate: string
  updatedDate: string
  assignedTo: string
  description: string
}

// Dato-hjælper relativt til 2026-03-30
function dateOffset(days: number): string {
  const d = new Date('2026-03-30')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const mockCases: MockCase[] = [
  // ---- ODENSE: compliance (forsikring) ----
  {
    id: 'case-odense-1',
    caseNumber: '26-001',
    title: 'Erhvervsforsikring udløbet — manglende fornyelse',
    type: 'COMPLIANCE',
    typeLabel: 'Compliance',
    status: 'AKTIV',
    statusLabel: 'Aktiv',
    companyId: 'company-odense',
    companyName: 'Odense Tandlægehus ApS',
    openedDate: dateOffset(-14),
    updatedDate: dateOffset(-2),
    assignedTo: 'Maria Christensen',
    description: 'Erhvervsforsikringen udløb 18. marts 2026. Klinikken er ikke dækket. Ny police er rekvireret men endnu ikke underskrevet.',
  },
  // ---- ODENSE: kontraktsag ----
  {
    id: 'case-odense-2',
    caseNumber: '25-087',
    title: 'Uoverensstemmelse i ejeraftale — ejerandele',
    type: 'KONTRAKT',
    typeLabel: 'Kontrakt',
    status: 'AFVENTER_EKSTERN',
    statusLabel: 'Afventer ekstern',
    companyId: 'company-odense',
    companyName: 'Odense Tandlægehus ApS',
    openedDate: dateOffset(-95),
    updatedDate: dateOffset(-21),
    assignedTo: 'Maria Christensen',
    description: 'AI-analyse af ejeraftale viste ejerandel 60/40, men systemregistrering viser 55/45. Afventer bekræftelse fra advokatfirmaet Kromann Reumert.',
  },
  // ---- HORSENS: governance (manglende ejeraftale) ----
  {
    id: 'case-horsens-1',
    caseNumber: '26-002',
    title: 'Manglende ejeraftale — 6 måneder efter stiftelse',
    type: 'GOVERNANCE',
    typeLabel: 'Governance',
    status: 'AKTIV',
    statusLabel: 'Aktiv',
    companyId: 'company-horsens',
    companyName: 'Horsens Tandklinik ApS',
    openedDate: dateOffset(-30),
    updatedDate: dateOffset(-8),
    assignedTo: 'Maria Christensen',
    description: 'Selskabet blev stiftet i september 2025 og har endnu ikke fået udarbejdet en ejeraftale. Lokal partner Camilla Broe afventer udkast fra ChainGroups advokat.',
  },
  // ---- HORSENS: ekstra sag ----
  {
    id: 'case-horsens-2',
    caseNumber: '26-005',
    title: 'Partnerkonflikt — forventningsafstemning',
    type: 'TVIST',
    typeLabel: 'Tvist',
    status: 'AFVENTER_KLIENT',
    statusLabel: 'Afventer klient',
    companyId: 'company-horsens',
    companyName: 'Horsens Tandklinik ApS',
    openedDate: dateOffset(-20),
    updatedDate: dateOffset(-5),
    assignedTo: 'Philip Andersen',
    description: 'Uenighed om ansvarsfordeling ved patientklageprocedurer. Camilla Broe har endnu ikke besvaret det fremsendte notat.',
  },
  // ---- HORSENS: sag 3 ----
  {
    id: 'case-horsens-3',
    caseNumber: '25-099',
    title: 'Revision — manglende underskrift på årsrapport 2024',
    type: 'COMPLIANCE',
    typeLabel: 'Compliance',
    status: 'AFVENTER_KLIENT',
    statusLabel: 'Afventer klient',
    companyId: 'company-horsens',
    companyName: 'Horsens Tandklinik ApS',
    openedDate: dateOffset(-45),
    updatedDate: dateOffset(-10),
    assignedTo: 'Thomas Nielsen',
    description: 'Årsrapporten for 2024 mangler underskrift fra ekstern revisor. Revisor Grant Thornton afventer godkendelse fra partner.',
  },
  // ---- VIBORG: kontraktsag (lejekontraktfornyelse) ----
  {
    id: 'case-viborg-1',
    caseNumber: '26-003',
    title: 'Lejekontrakt udløber — forhandling om fornyelse',
    type: 'KONTRAKT',
    typeLabel: 'Kontrakt',
    status: 'AKTIV',
    statusLabel: 'Aktiv',
    companyId: 'company-viborg',
    companyName: 'Viborg Tandlæge ApS',
    openedDate: dateOffset(-21),
    updatedDate: dateOffset(-3),
    assignedTo: 'Maria Christensen',
    description: 'Lejekontrakten for Sct. Mathias Gade 22 udløber 27. april 2026. Udlejeren har fremsendt udkast med 18% huslejestigningStigningstakt. Forhandling pågår.',
  },
  // ---- RANDERS: gammel åben sag ----
  {
    id: 'case-randers-1',
    caseNumber: '25-041',
    title: 'Samarbejdstvist — klinikkens markedsretningslinjer',
    type: 'TVIST',
    typeLabel: 'Tvist',
    status: 'AFVENTER_EKSTERN',
    statusLabel: 'Afventer ekstern',
    companyId: 'company-randers',
    companyName: 'Randers Tandklinik ApS',
    openedDate: dateOffset(-112),
    updatedDate: dateOffset(-30),
    assignedTo: 'Philip Andersen',
    description: 'Mads Overgaard er uenig i fortolkningen af § 8 i samarbejdsaftalen om markedsføring via sociale medier. Sagen er sendt til mægling.',
  },
  // ---- RANDERS: sag 2 ----
  {
    id: 'case-randers-2',
    caseNumber: '26-009',
    title: 'GDPR-brud — utilsigtet fremsendelse af patientdata',
    type: 'COMPLIANCE',
    typeLabel: 'Compliance',
    status: 'NY',
    statusLabel: 'Ny',
    companyId: 'company-randers',
    companyName: 'Randers Tandklinik ApS',
    openedDate: dateOffset(-5),
    updatedDate: dateOffset(-5),
    assignedTo: 'Maria Christensen',
    description: 'En receptionist fremsendte ved en fejl journaldata til forkert modtager. Datatilsynet skal notificeres inden 72 timer.',
  },
  // ---- KOLDING: revisionsaflevering ----
  {
    id: 'case-kolding-1',
    caseNumber: '26-004',
    title: 'Forsinkelse af årsrapport 2025',
    type: 'COMPLIANCE',
    typeLabel: 'Compliance',
    status: 'AKTIV',
    statusLabel: 'Aktiv',
    companyId: 'company-kolding',
    companyName: 'Kolding Tandlæge ApS',
    openedDate: dateOffset(-18),
    updatedDate: dateOffset(-3),
    assignedTo: 'Thomas Nielsen',
    description: 'Årsrapport 2025 ikke indleveret til Erhvervsstyrelsen inden frist. Søren Damgaard oplyser tekniske problemer med revisor. Bøderisiko ved fortsat forsinkelse.',
  },
  // ---- AALBORG: samarbejdsaftale udløber ----
  {
    id: 'case-aalborg-1',
    caseNumber: '26-007',
    title: 'Samarbejdsaftale — forhandling om forlængelse',
    type: 'KONTRAKT',
    typeLabel: 'Kontrakt',
    status: 'NY',
    statusLabel: 'Ny',
    companyId: 'company-aalborg',
    companyName: 'Aalborg Tandlægehus ApS',
    openedDate: dateOffset(-7),
    updatedDate: dateOffset(-7),
    assignedTo: 'Philip Andersen',
    description: 'Samarbejdsaftalen med Region Nordjylland udløber om 68 dage. Ny aftale kræver opdaterede prislister og eventuel EBITDA-garanti fra partner.',
  },
  // ---- LUKKET SAG (historik) ----
  {
    id: 'case-vejle-1',
    caseNumber: '25-019',
    title: 'Overtagelse af partnerandel — gennemfoert',
    type: 'TRANSAKTION',
    typeLabel: 'Transaktion',
    status: 'LUKKET',
    statusLabel: 'Lukket',
    companyId: 'company-vejle',
    companyName: 'Vejle Tandlægehus ApS',
    openedDate: dateOffset(-180),
    updatedDate: dateOffset(-90),
    assignedTo: 'Maria Christensen',
    description: 'Birgitte Hald overtog 5% ekstra andel fra medpartner ifb. fratræden. Overdragelsesaftale underskrevet og registreret i Erhvervsstyrelsen.',
  },
]

export function getCases(scenario: DataScenario = 'normal'): MockCase[] {
  if (scenario === 'empty') return []
  return mockCases
}

export function getCasesByCompany(companyId: string): MockCase[] {
  return mockCases.filter((c) => c.companyId === companyId)
}

export function getCaseById(id: string): MockCase | undefined {
  return mockCases.find((c) => c.id === id)
}

export function getOpenCases(): MockCase[] {
  return mockCases.filter((c) => c.status !== 'LUKKET')
}
