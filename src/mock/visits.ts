import type { DataScenario } from './types'

export type VisitType = 'KVARTALSBESOEG' | 'OPFOELGNING' | 'AUDIT' | 'ONBOARDING'
export type VisitStatus = 'PLANLAGT' | 'GENNEMFOERT' | 'AFLYST'

export interface MockVisit {
  id: string
  companyId: string
  companyName: string
  type: VisitType
  typeLabel: string
  status: VisitStatus
  statusLabel: string
  date: string
  dateLabel: string
  responsiblePerson: string
  notes?: string
}

// Dato-hjælper relativt til 2026-03-30
function dateOffset(days: number): string {
  const d = new Date('2026-03-30')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
  return `${d.getUTCDate()}. ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function makeVisit(
  id: string,
  companyId: string,
  companyName: string,
  type: VisitType,
  typeLabel: string,
  status: VisitStatus,
  statusLabel: string,
  dayOffset: number,
  responsiblePerson: string,
  notes?: string
): MockVisit {
  const date = dateOffset(dayOffset)
  return { id, companyId, companyName, type, typeLabel, status, statusLabel, date, dateLabel: formatDate(date), responsiblePerson, notes }
}

const mockVisits: MockVisit[] = [
  // ---- KOMMENDE BESOEG (PLANLAGT) ----
  // Critical-selskaber skal have kommende besøg
  makeVisit('visit-odense-1', 'company-odense', 'Odense Tandlægehus ApS',
    'OPFOELGNING', 'Opfølgning', 'PLANLAGT', 'Planlagt',
    4, 'Sara Larsen',
    'Opfølgning på forsikringssag og EBITDA-udvikling. Møde med Henrik Munk.'),

  makeVisit('visit-horsens-1', 'company-horsens', 'Horsens Tandklinik ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'PLANLAGT', 'Planlagt',
    11, 'Philip Andersen',
    'Q1 kvartalsbesøg kombineret med opfølgning på manglende ejeraftale.'),

  makeVisit('visit-viborg-1', 'company-viborg', 'Viborg Tandlæge ApS',
    'OPFOELGNING', 'Opfølgning', 'PLANLAGT', 'Planlagt',
    7, 'Maria Christensen',
    'Hasteopfølgning pga. lejekontrakt der udløber om 28 dage. Møde med Peter Holm og udlejer.'),

  makeVisit('visit-aalborg-1', 'company-aalborg', 'Aalborg Tandlægehus ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'PLANLAGT', 'Planlagt',
    18, 'Philip Andersen',
    'Kvartalsbesøg Q1. Gennemgang af samarbejdsaftale og regionstilskud 2026.'),

  makeVisit('visit-randers-1', 'company-randers', 'Randers Tandklinik ApS',
    'OPFOELGNING', 'Opfølgning', 'PLANLAGT', 'Planlagt',
    14, 'Philip Andersen',
    'Opfølgning på GDPR-brud og mæglingsmøde for samarbejdstvist.'),

  makeVisit('visit-kolding-1', 'company-kolding', 'Kolding Tandlæge ApS',
    'AUDIT', 'Audit', 'PLANLAGT', 'Planlagt',
    21, 'Thomas Nielsen',
    'Finansiel audit pga. forsinkelse af årsrapport. Gennemgang af bogføringsdokumentation.'),

  makeVisit('visit-aarhus-1', 'company-aarhus', 'Aarhus Tandklinik ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'PLANLAGT', 'Planlagt',
    35, 'Philip Andersen',
    'Rutinemæssigt Q2-planlægningsmøde. Aarhus performer stærkt — mulig udvidelse diskuteres.'),

  makeVisit('visit-vejle-1', 'company-vejle', 'Vejle Tandlægehus ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'PLANLAGT', 'Planlagt',
    45, 'Sara Larsen',
    'Q2 kvartalsbesøg. Gennemgang af ny partner-onboarding efter andelsoverdragelse.'),

  // ---- GENNEMFOERTE BESOEG ----
  makeVisit('visit-odense-prev', 'company-odense', 'Odense Tandlægehus ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'GENNEMFOERT', 'Gennemført',
    -45, 'Maria Christensen',
    'Q4 kvartalsbesøg. EBITDA-udfordringer identificeret. Handlingsplan aftalt.'),

  makeVisit('visit-horsens-prev', 'company-horsens', 'Horsens Tandklinik ApS',
    'ONBOARDING', 'Onboarding', 'GENNEMFOERT', 'Gennemført',
    -60, 'Philip Andersen',
    'Velkomstbesøg for ny klinik. Systemoprettelse og onboarding-pakke gennemgået med Camilla Broe.'),

  makeVisit('visit-viborg-prev', 'company-viborg', 'Viborg Tandlæge ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'GENNEMFOERT', 'Gennemført',
    -90, 'Maria Christensen',
    'Q3 kvartalsbesøg. Lejekontrakt-situation identificeret som risiko. Opfølgning planlagt.'),

  makeVisit('visit-randers-prev', 'company-randers', 'Randers Tandklinik ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'GENNEMFOERT', 'Gennemført',
    -75, 'Philip Andersen',
    'Q3 besøg. Samarbejdstvist opstartet. Mægling anbefalet.'),

  makeVisit('visit-aarhus-prev', 'company-aarhus', 'Aarhus Tandklinik ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'GENNEMFOERT', 'Gennemført',
    -30, 'Philip Andersen',
    'Q1 besøg. Stærke tal. Ekspansionstanker drøftet. Se finansrapport.'),

  // ---- AFLYST BESOEG ----
  makeVisit('visit-silkeborg-afl', 'company-silkeborg', 'Silkeborg Tandhus ApS',
    'OPFOELGNING', 'Opfølgning', 'AFLYST', 'Aflyst',
    -20, 'Sara Larsen',
    'Aflyst pga. sygdom hos partner Anne Kjær. Ny dato afventer.'),

  makeVisit('visit-holstebro-plan', 'company-holstebro', 'Holstebro Tandklinik ApS',
    'KVARTALSBESOEG', 'Kvartalsbesøg', 'PLANLAGT', 'Planlagt',
    55, 'Sara Larsen',
    'Planlagt Q2-besøg. Ingen aktuelle bekymringer.'),
]

export function getVisits(scenario: DataScenario = 'normal'): MockVisit[] {
  if (scenario === 'empty') return []
  return mockVisits
}

export function getVisitsByCompany(companyId: string): MockVisit[] {
  return mockVisits.filter((v) => v.companyId === companyId)
}

export function getUpcomingVisits(): MockVisit[] {
  return mockVisits
    .filter((v) => v.status === 'PLANLAGT')
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getRecentVisits(days: number = 90): MockVisit[] {
  const cutoff = new Date('2026-03-30')
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return mockVisits
    .filter((v) => v.status === 'GENNEMFOERT' && v.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date))
}
