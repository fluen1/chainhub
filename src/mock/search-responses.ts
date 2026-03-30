import type { MockSearchResponse, MockRole } from './types'

// 8 predefined mock responses
const predefinedResponses: MockSearchResponse[] = [
  // === 1: SEARCH — find company ===
  {
    query: 'odense',
    queryType: 'search',
    directMatches: [
      { type: 'company', typeLabel: 'Selskab', id: 'company-odense', title: 'Odense Tandlægehus ApS', subtitle: 'CVR 38201745 · Kritisk — forsikring udløbet', href: '/proto/portfolio/company-odense' },
      { type: 'contract', typeLabel: 'Kontrakt', id: 'c-odense-3', title: 'Erhvervsforsikring 2025', subtitle: 'Odense Tandlægehus · Udløbet for 12 dage siden', href: '/proto/contracts/c-odense-3' },
      { type: 'document', typeLabel: 'Dokument', id: 'doc-review-1', title: 'Ejeraftale_Odense_2026_forny.pdf', subtitle: 'Klar til gennemgang · Uoverensstemmelse i ejerandel', href: '/proto/documents/doc-review-1' },
    ],
    aiAnswer: {
      text: 'Odense Tandlægehus ApS er i kritisk tilstand. Erhvervsforsikringen er udløbet for 12 dage siden og endnu ikke fornyet. EBITDA er faldet 23% fra 490K til 380K kr. Der er 2 åbne sager og en ny ejeraftale afventer gennemgang.',
      dataPoints: [
        { label: 'Sundhedsstatus', value: 'Kritisk', urgency: 'critical', href: '/proto/portfolio/company-odense' },
        { label: 'EBITDA 2025', value: '380.000 kr. (−23%)', urgency: 'critical', href: '/proto/portfolio/company-odense/finance' },
        { label: 'Forsikring', value: 'Udløbet for 12 dage siden', urgency: 'critical', href: '/proto/contracts/c-odense-3' },
        { label: 'Åbne sager', value: '2 sager', urgency: 'warning', href: '/proto/portfolio/company-odense/cases' },
      ],
    },
    suggestedFollowUps: [
      'Hvornår udløber Odenses lejekontrakt?',
      'Hvem er partner i Odense?',
      'Vis alle kritiske kontrakter',
    ],
  },

  // === 2: QUESTION — expiring contracts ===
  {
    query: 'hvilke kontrakter udløber snart',
    queryType: 'question',
    directMatches: [
      { type: 'contract', typeLabel: 'Kontrakt', id: 'c-odense-3', title: 'Erhvervsforsikring — Odense', subtitle: 'Udløbet for 12 dage siden', href: '/proto/contracts/c-odense-3' },
      { type: 'contract', typeLabel: 'Kontrakt', id: 'c-viborg-2', title: 'Lejekontrakt — Viborg', subtitle: 'Udløber om 28 dage', href: '/proto/contracts/c-viborg-2' },
      { type: 'contract', typeLabel: 'Kontrakt', id: 'c-kolding-3', title: 'Erhvervsforsikring — Kolding', subtitle: 'Udløber om 82 dage', href: '/proto/contracts/c-kolding-3' },
      { type: 'contract', typeLabel: 'Kontrakt', id: 'c-aalborg-4', title: 'Samarbejdsaftale — Aalborg', subtitle: 'Udløber om 68 dage', href: '/proto/contracts/c-aalborg-4' },
    ],
    aiAnswer: {
      text: 'Der er 4 kontrakter som udløber inden for de næste 90 dage. Mest kritisk er Odenses erhvervsforsikring (allerede udløbet) og Viborgs lejekontrakt (28 dage). Koldings forsikring og Aalborgss samarbejdsaftale udløber inden for 90 dage.',
      dataPoints: [
        { label: 'Udløbet', value: '1 kontrakt', urgency: 'critical' },
        { label: 'Udløber < 30 dage', value: '1 kontrakt', urgency: 'critical' },
        { label: 'Udløber 30-90 dage', value: '2 kontrakter', urgency: 'warning' },
        { label: 'Udløber > 90 dage', value: 'Ingen', urgency: 'normal' },
      ],
    },
    suggestedFollowUps: [
      'Opret fornyelsesopgave for Viborg lejekontrakt',
      'Hvilke selskaber mangler en forsikringskontrakt?',
      'Vis alle kontrakter for Kolding',
    ],
  },

  // === 3: QUESTION — Horsens status ===
  {
    query: 'horsens',
    queryType: 'search',
    directMatches: [
      { type: 'company', typeLabel: 'Selskab', id: 'company-horsens', title: 'Horsens Tandklinik ApS', subtitle: 'CVR 39145822 · Kritisk — ejeraftale mangler', href: '/proto/portfolio/company-horsens' },
      { type: 'contract', typeLabel: 'Kontrakt', id: 'c-horsens-1', title: 'Lejekontrakt Søndergade', subtitle: 'Horsens Tandklinik · Aktiv', href: '/proto/contracts/c-horsens-1' },
      { type: 'case', typeLabel: 'Sag', id: 'case-horsens-1', title: 'Sag om ejeraftale mangler', subtitle: 'Horsens Tandklinik · Åben', href: '/proto/portfolio/company-horsens/cases' },
    ],
    aiAnswer: {
      text: 'Horsens Tandklinik ApS er i kritisk tilstand pga. manglende ejeraftale — dette er 6 måneder efter stiftelse. Der er 3 åbne sager. Finansielt er selskabet sundt med 8,8% EBITDA-margin og positiv vækst.',
      dataPoints: [
        { label: 'Sundhedsstatus', value: 'Kritisk', urgency: 'critical', href: '/proto/portfolio/company-horsens' },
        { label: 'Ejeraftale', value: 'Mangler', urgency: 'critical', href: '/proto/portfolio/company-horsens/contracts' },
        { label: 'Åbne sager', value: '3 sager', urgency: 'warning', href: '/proto/portfolio/company-horsens/cases' },
        { label: 'EBITDA 2025', value: '365.000 kr. (+14%)', urgency: 'normal', href: '/proto/portfolio/company-horsens/finance' },
      ],
    },
    suggestedFollowUps: [
      'Hvem er partner i Horsens?',
      'Opret ejeraftale-opgave for Horsens',
      'Vis alle selskaber uden ejeraftale',
    ],
  },

  // === 4: QUESTION — EBITDA / økonomi ===
  {
    query: 'hvilke selskaber klarer sig dårligst økonomisk',
    queryType: 'question',
    directMatches: [
      { type: 'company', typeLabel: 'Selskab', id: 'company-odense', title: 'Odense Tandlægehus ApS', subtitle: 'EBITDA −23% · 380.000 kr.', href: '/proto/portfolio/company-odense/finance' },
      { type: 'company', typeLabel: 'Selskab', id: 'company-viborg', title: 'Viborg Tandlæge ApS', subtitle: 'Omsætning −8% · 3.450.000 kr.', href: '/proto/portfolio/company-viborg/finance' },
    ],
    aiAnswer: {
      text: 'To selskaber viser negativ økonomiudvikling i 2025: Odense Tandlægehus har det mest alvorlige fald med EBITDA ned 23% (fra 490K til 380K kr.). Viborg Tandlæge har omsætningsfald på 8%. Alle øvrige 20 selskaber viser positive tendenser.',
      dataPoints: [
        { label: 'Odense EBITDA', value: '380K kr. (−23%)', urgency: 'critical', href: '/proto/portfolio/company-odense/finance' },
        { label: 'Viborg omsætning', value: '3,45M kr. (−8%)', urgency: 'warning', href: '/proto/portfolio/company-viborg/finance' },
        { label: 'Portefølje total', value: '83,5M kr. (+6,8%)', urgency: 'normal', href: '/proto/portfolio?view=finance' },
        { label: 'Gns. EBITDA-margin', value: '10,3%', urgency: 'normal' },
      ],
    },
    suggestedFollowUps: [
      'Hvad er årsagen til Odenses EBITDA-fald?',
      'Vis Odense økonomi 2024 vs 2025',
      'Hvilke selskaber har højest EBITDA-margin?',
    ],
  },

  // === 5: ACTION — opret opgave ===
  {
    query: 'opret opgave for viborg lejekontrakt',
    queryType: 'action',
    directMatches: [
      { type: 'company', typeLabel: 'Selskab', id: 'company-viborg', title: 'Viborg Tandlæge ApS', subtitle: 'Lejekontrakt udløber om 28 dage', href: '/proto/portfolio/company-viborg' },
      { type: 'contract', typeLabel: 'Kontrakt', id: 'c-viborg-2', title: 'Lejekontrakt Sct. Mathias Gade', subtitle: 'Udløber 27. april 2026', href: '/proto/contracts/c-viborg-2' },
    ],
    aiAnswer: {
      text: 'Jeg kan oprette en opgave for fornyelse af Viborg-lejekontrakten. Kontrakten udløber om 28 dage (27. april 2026). Jeg foreslår en opgave med høj prioritet tildelt Maria Christensen.',
      dataPoints: [
        { label: 'Kontrakt', value: 'Lejekontrakt Sct. Mathias Gade', href: '/proto/contracts/c-viborg-2' },
        { label: 'Udløbsdato', value: '27. april 2026', urgency: 'critical' },
        { label: 'Anbefalet ansvarlig', value: 'Maria Christensen' },
        { label: 'Anbefalet prioritet', value: 'Høj' },
      ],
    },
    suggestedFollowUps: [
      'Tildel opgaven til Thomas i stedet',
      'Opret også opgave for Odense forsikring',
      'Vis alle opgaver for Viborg',
    ],
    actionPreview: {
      description: 'Opret opgave: "Forny lejekontrakt — Viborg Sct. Mathias Gade"',
      items: [
        { label: 'Selskab: Viborg Tandlæge ApS', checked: true },
        { label: 'Prioritet: Høj', checked: true },
        { label: 'Ansvarlig: Maria Christensen', checked: true },
        { label: 'Deadline: 20. april 2026 (7 dage før udløb)', checked: true },
        { label: 'Notificer partner Peter Holm', checked: false },
      ],
      confirmLabel: 'Opret opgave',
    },
  },

  // === 6: QUESTION — partner ownership ===
  {
    query: 'hvem er partner i aarhus',
    queryType: 'question',
    directMatches: [
      { type: 'company', typeLabel: 'Selskab', id: 'company-aarhus', title: 'Aarhus Tandklinik ApS', subtitle: 'CVR 33412685 · Aktiv · Sund', href: '/proto/portfolio/company-aarhus' },
      { type: 'person', typeLabel: 'Person', id: 'person-jens-thomsen', title: 'Jens Thomsen', subtitle: 'Partner · 40% ejerandel · Aarhus', href: '/proto/portfolio/company-aarhus/ownership' },
    ],
    aiAnswer: {
      text: 'Lokal partner i Aarhus Tandklinik ApS er Jens Thomsen med 40% ejerandel. Kædegruppen ejer de resterende 60%. Selskabet er i sund tilstand med EBITDA 790.000 kr. og omsætning 6,2M kr. i 2025.',
      dataPoints: [
        { label: 'Partner', value: 'Jens Thomsen (40%)', href: '/proto/portfolio/company-aarhus/ownership' },
        { label: 'Kædegruppe', value: '60%', href: '/proto/portfolio/company-aarhus/ownership' },
        { label: 'EBITDA 2025', value: '790.000 kr. (+10%)', urgency: 'normal', href: '/proto/portfolio/company-aarhus/finance' },
        { label: 'Status', value: 'Sund', urgency: 'normal' },
      ],
    },
    suggestedFollowUps: [
      'Vis ejeraftalen for Aarhus',
      'Hvad er udløsningsprisen for Aarhus-andelen?',
      'Sammenlign Aarhus og Odense økonomi',
    ],
  },

  // === 7: QUESTION — documents review ===
  {
    query: 'dokumenter der venter på gennemgang',
    queryType: 'question',
    directMatches: [
      { type: 'document', typeLabel: 'Dokument', id: 'doc-review-1', title: 'Ejeraftale_Odense_2026_forny.pdf', subtitle: 'Høj konfidence · 1 uoverensstemmelse', href: '/proto/documents/doc-review-1' },
      { type: 'document', typeLabel: 'Dokument', id: 'doc-review-2', title: 'Ejeraftale_Viborg_tillæg_2026.pdf', subtitle: 'Mellemkonfidence · Manglende klausul', href: '/proto/documents/doc-review-2' },
    ],
    aiAnswer: {
      text: 'Der er 2 dokumenter klar til gennemgang. Odense-ejeraftalen har en kritisk uoverensstemmelse: AI fandt ejerandel 60/40 men systemet viser 55/45. Viborg-tillægget mangler medsalgspligts-klausulen fra den originale ejeraftale.',
      dataPoints: [
        { label: 'Afventer gennemgang', value: '2 dokumenter', urgency: 'warning' },
        { label: 'Under behandling', value: '2 dokumenter', urgency: 'normal' },
        { label: 'Odense uoverensstemmelse', value: 'Ejerandel 60/40 vs 55/45', urgency: 'critical', href: '/proto/documents/doc-review-1' },
        { label: 'Viborg manglende klausul', value: 'Medsalgspligt', urgency: 'warning', href: '/proto/documents/doc-review-2' },
      ],
    },
    suggestedFollowUps: [
      'Vis Odense ejeraftale detaljer',
      'Hvad er medsalgspligt?',
      'Godkend Viborg-tillægget',
    ],
  },

  // === 8: ACTION — send rapport til alle partnere ===
  {
    query: 'send kvartalsrapport til alle partnere',
    queryType: 'action',
    directMatches: [],
    aiAnswer: {
      text: 'Jeg kan forberede en kvartalsrapport Q1 2026 til alle 22 lokale partnere. Rapporten inkluderer økonomi-nøgletal, kontraktstatus og relevante opdateringer for hvert selskab.',
      dataPoints: [
        { label: 'Modtagere', value: '22 partnere' },
        { label: 'Periode', value: 'Q1 2026' },
        { label: 'Indhold', value: 'Økonomi + kontrakter + opgaver' },
        { label: 'Format', value: 'PDF + email' },
      ],
    },
    suggestedFollowUps: [
      'Vis forhåndsvisning af rapporten',
      'Send kun til kritiske selskaber',
      'Planlæg automatisk kvartalsrapport',
    ],
    actionPreview: {
      description: 'Send kvartalsrapport Q1 2026 til partnere',
      items: [
        { label: '22 partnere modtager individuel rapport', checked: true },
        { label: 'Inkluder EBITDA og omsætning 2025', checked: true },
        { label: 'Inkluder kontraktstatus', checked: true },
        { label: 'Inkluder åbne opgaver', checked: true },
        { label: 'Inkluder åbne sager', checked: false },
      ],
      confirmLabel: 'Send rapporter',
    },
  },
]

// Fuzzy matching — normalisér og sammenlign
function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'oe')
    .replace(/[å]/g, 'aa')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

function matchScore(query: string, candidate: string): number {
  const q = normalizeQuery(query)
  const c = normalizeQuery(candidate)
  if (c === q) return 1.0
  if (c.includes(q) || q.includes(c)) return 0.8
  const words = q.split(' ')
  const matches = words.filter((w) => c.includes(w) && w.length > 2)
  return matches.length / Math.max(words.length, 1)
}

const defaultFallback: MockSearchResponse = {
  query: '',
  queryType: 'search',
  directMatches: [],
  aiAnswer: {
    text: 'Jeg fandt ingen direkte match for din søgning. Prøv at søge på et selskabsnavn, en by, en kontrakttype eller en person.',
    dataPoints: [
      { label: 'Selskaber', value: '22 aktive', href: '/proto/portfolio' },
      { label: 'Kontrakter', value: 'Se oversigt', href: '/proto/contracts' },
      { label: 'Opgaver', value: 'Se oversigt', href: '/proto/tasks' },
      { label: 'Dokumenter', value: 'Se oversigt', href: '/proto/documents' },
    ],
  },
  suggestedFollowUps: [
    'Vis alle kritiske selskaber',
    'Hvilke kontrakter udløber snart?',
    'Vis mine opgaver',
  ],
}

// Rollebaserede foreslåede søgninger
const suggestedQueriesByRole: Record<MockRole, Record<string, string[]>> = {
  GROUP_OWNER: {
    dashboard: ['Vis alle kritiske sager', 'Hvilke selskaber klarer sig dårligst?', 'Send kvartalsrapport til partnere'],
    portfolio: ['Odense status', 'Horsens ejeraftale', 'Sammenlign Aarhus og Vejle'],
    contracts: ['Hvilke kontrakter udløber snart?', 'Horsens manglende kontrakter', 'Odense forsikring'],
    tasks: ['Vis mine opgaver', 'Forfaldne opgaver', 'Opgaver for Viborg'],
    documents: ['Dokumenter klar til gennemgang', 'Odense ejeraftale', 'Vis Viborg tillæg'],
  },
  GROUP_LEGAL: {
    dashboard: ['Manglende ejeraftaler', 'Dokumenter klar til gennemgang', 'Horsens kontrakter'],
    portfolio: ['Selskaber uden ejeraftale', 'Kontraktdækning oversigt', 'Viborg juridisk status'],
    contracts: ['Manglende standardkontrakter', 'Udløbende juridiske aftaler', 'NDA-oversigt'],
    tasks: ['Mine juridiske opgaver', 'Horsens ejeraftale opgave', 'Forfaldne juridiske opgaver'],
    documents: ['Dokumenter med uoverensstemmelser', 'Odense ejeraftale 2026', 'Afventende gennemgang'],
  },
  GROUP_FINANCE: {
    dashboard: ['EBITDA-oversigt 2025', 'Selskaber med negativ trend', 'Portefølje totaler'],
    portfolio: ['Vis økonomi alle selskaber', 'Odense EBITDA', 'Sammenlign omsætning'],
    contracts: ['Forsikringskontrakter', 'Udløbende forsikringer', 'Inventarleasing oversigt'],
    tasks: ['Mine økonomi-opgaver', 'Revision oversigt', 'Budgetopgaver'],
    documents: ['Årsrapporter 2023', 'Finansielle dokumenter', 'Forsikringspolicer'],
  },
  GROUP_ADMIN: {
    dashboard: ['Forfaldne opgaver', 'Viborg tilsynsbesøg', 'Vis alle åbne opgaver'],
    portfolio: ['Alle selskaber status', 'Kritiske selskaber', 'Selskaber med åbne sager'],
    contracts: ['Udløbende kontrakter', 'Kontraktoversigt Horsens', 'Manglende kontrakter'],
    tasks: ['Alle forfaldne opgaver', 'Opgaver denne uge', 'Afventende opgaver'],
    documents: ['Dokumenter under behandling', 'Upload nyt dokument', 'Arkiv'],
  },
  COMPANY_MANAGER: {
    dashboard: ['Mine klinikker status', 'Odense åbne sager', 'Mine opgaver'],
    portfolio: ['Odense kontrakter', 'Svendborg status', 'Nyborg økonomi'],
    contracts: ['Odense kontraktoversigt', 'Forsikring Odense', 'Lejekontrakter'],
    tasks: ['Mine opgaver', 'Forfaldne opgaver', 'Opgaver for Odense'],
    documents: ['Odense dokumenter', 'Upload dokument', 'Gennemgå Odense ejeraftale'],
  },
}

export function searchMock(query: string): MockSearchResponse {
  if (!query.trim()) {
    return { ...defaultFallback, query }
  }

  let bestMatch: MockSearchResponse | undefined
  let bestScore = 0

  for (const response of predefinedResponses) {
    const score = matchScore(query, response.query)
    if (score > bestScore) {
      bestScore = score
      bestMatch = response
    }
  }

  if (bestMatch && bestScore >= 0.4) {
    return { ...bestMatch, query }
  }

  return { ...defaultFallback, query }
}

export function getSuggestedQueries(role: MockRole, page: string): string[] {
  const roleQueries = suggestedQueriesByRole[role]
  return roleQueries[page] ?? roleQueries['dashboard'] ?? []
}
