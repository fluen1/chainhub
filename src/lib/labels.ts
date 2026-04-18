/**
 * labels.ts — Global enum-til-dansk mapping utility
 *
 * REGEL: Ingen rå enum-værdi må vises til brugeren.
 * Alle komponenter SKAL bruge dette modul — aldrig inline labels.
 *
 * BA-04 | Sprint 7
 */

// ─── Selskabsform ─────────────────────────────────────────────────────────────

export const COMPANY_TYPE_OPTIONS = [
  { value: 'ApS', label: 'ApS' },
  { value: 'A/S', label: 'A/S' },
  { value: 'I/S', label: 'I/S' },
  { value: 'Holding ApS', label: 'Holding ApS' },
  { value: 'Andet', label: 'Andet' },
] as const

// ─── Selskabsstatus ───────────────────────────────────────────────────────────

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  aktiv: 'Aktiv',
  under_stiftelse: 'Under stiftelse',
  under_afvikling: 'Under afvikling',
  solgt: 'Solgt',
  oploest: 'Opløst',
  inaktiv: 'Inaktiv',
}

export const COMPANY_STATUS_STYLES: Record<string, string> = {
  aktiv: 'bg-green-50 text-green-700 ring-1 ring-green-600/20',
  under_stiftelse: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20',
  under_afvikling: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20',
  solgt: 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/20',
  oploest: 'bg-gray-100 text-gray-500 ring-1 ring-gray-400/20',
  inaktiv: 'bg-gray-50 text-gray-500 ring-1 ring-gray-400/20',
}

export function getCompanyStatusLabel(status: string): string {
  return COMPANY_STATUS_LABELS[status] ?? status
}

export function getCompanyStatusStyle(status: string): string {
  return COMPANY_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
}

// ─── Kontraktstatus ───────────────────────────────────────────────────────────

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  UDKAST: 'Kladde',
  TIL_REVIEW: 'Til review',
  TIL_UNDERSKRIFT: 'Til underskrift',
  AKTIV: 'Aktiv',
  UDLOEBET: 'Udløbet',
  OPSAGT: 'Opsagt',
  FORNYET: 'Fornyet',
  ARKIVERET: 'Arkiveret',
}

export const CONTRACT_STATUS_STYLES: Record<string, string> = {
  UDKAST: 'bg-gray-100 text-gray-700',
  TIL_REVIEW: 'bg-yellow-50 text-yellow-700',
  TIL_UNDERSKRIFT: 'bg-blue-50 text-blue-700',
  AKTIV: 'bg-green-50 text-green-700',
  UDLOEBET: 'bg-red-50 text-red-700',
  OPSAGT: 'bg-red-100 text-red-800',
  FORNYET: 'bg-green-100 text-green-800',
  ARKIVERET: 'bg-gray-50 text-gray-500',
}

export function getContractStatusLabel(status: string): string {
  return CONTRACT_STATUS_LABELS[status] ?? status
}

export function getContractStatusStyle(status: string): string {
  return CONTRACT_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'
}

// ─── Kontrakttype ─────────────────────────────────────────────────────────────

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  // Lag 1 — Universelle
  EJERAFTALE: 'Ejeraftale',
  DIREKTOERKONTRAKT: 'Direktørkontrakt',
  OVERDRAGELSESAFTALE: 'Overdragelsesaftale',
  AKTINONAERLAAN: 'Aktionærlåneaftale',
  PANTSAETNING: 'Pantsætningsaftale',
  VEDTAEGTER: 'Vedtægter',
  ANSAETTELSE_FUNKTIONAER: 'Ansættelseskontrakt (funktionær)',
  ANSAETTELSE_IKKE_FUNKTIONAER: 'Ansættelseskontrakt (ikke-funktionær)',
  VIKARAFTALE: 'Vikaraftale',
  UDDANNELSESAFTALE: 'Uddannelsesaftale',
  FRATROEDELSESAFTALE: 'Fratrædelsesaftale',
  KONKURRENCEKLAUSUL: 'Konkurrenceklausulaftale',
  PERSONALEHAANDBOG: 'Personalehåndbog',
  LEJEKONTRAKT_ERHVERV: 'Lejekontrakt (erhverv)',
  LEASINGAFTALE: 'Leasingaftale',
  LEVERANDOERKONTRAKT: 'Leverandørkontrakt',
  SAMARBEJDSAFTALE: 'Samarbejdsaftale',
  NDA: 'Fortrolighedsaftale (NDA)',
  IT_SYSTEMAFTALE: 'IT-/Systemaftale',
  DBA: 'Databehandleraftale (DBA)',
  FORSIKRING: 'Forsikringsaftale',
  GF_REFERAT: 'Generalforsamlingsreferat',
  BESTYRELSESREFERAT: 'Bestyrelsesreferat',
  FORRETNINGSORDEN: 'Forretningsorden',
  DIREKTIONSINSTRUKS: 'Direktionsinstruks',
  VOA: 'Virksomhedsoverdragelsesaftale (VOA)',
  // Lag 2 — Strukturtyper
  INTERN_SERVICEAFTALE: 'Intern serviceaftale',
  ROYALTY_LICENS: 'Royalty-/Licensaftale',
  OPTIONSAFTALE: 'Optionsaftale',
  TILTRAEDELSESDOKUMENT: 'Tiltrædelsesdokument',
  KASSEKREDIT: 'Kassekreditaftale',
  CASH_POOL: 'Cash pool-aftale',
  INTERCOMPANY_LAAN: 'Intercompany-lån',
  SELSKABSGARANTI: 'Selskabsgaranti',
}

export function getContractTypeLabel(systemType: string): string {
  return CONTRACT_TYPE_LABELS[systemType] ?? systemType
}

// ─── Kontraktkategorier ──────────────────────────────────────────────────────

export const CONTRACT_CATEGORIES = [
  'EJERSKAB_OG_SELSKABSRET',
  'ANSAETTELSE_OG_PERSONALE',
  'LOKALER_OG_UDSTYR',
  'KOMMERCIELLE_AFTALER',
  'FORSIKRING_OG_GOVERNANCE',
  'STRUKTURAFTALER',
] as const

export type ContractCategory = (typeof CONTRACT_CATEGORIES)[number]

export const CONTRACT_CATEGORY_LABELS: Record<ContractCategory, string> = {
  EJERSKAB_OG_SELSKABSRET: 'Ejerskab og selskabsret',
  ANSAETTELSE_OG_PERSONALE: 'Ansættelse og personale',
  LOKALER_OG_UDSTYR: 'Lokaler og udstyr',
  KOMMERCIELLE_AFTALER: 'Kommercielle aftaler',
  FORSIKRING_OG_GOVERNANCE: 'Forsikring og governance',
  STRUKTURAFTALER: 'Strukturaftaler',
}

export const CONTRACT_CATEGORY_MAP: Record<string, ContractCategory> = {
  // Ejerskab og selskabsret
  EJERAFTALE: 'EJERSKAB_OG_SELSKABSRET',
  DIREKTOERKONTRAKT: 'EJERSKAB_OG_SELSKABSRET',
  OVERDRAGELSESAFTALE: 'EJERSKAB_OG_SELSKABSRET',
  AKTINONAERLAAN: 'EJERSKAB_OG_SELSKABSRET',
  PANTSAETNING: 'EJERSKAB_OG_SELSKABSRET',
  VEDTAEGTER: 'EJERSKAB_OG_SELSKABSRET',
  // Ansættelse og personale
  ANSAETTELSE_FUNKTIONAER: 'ANSAETTELSE_OG_PERSONALE',
  ANSAETTELSE_IKKE_FUNKTIONAER: 'ANSAETTELSE_OG_PERSONALE',
  VIKARAFTALE: 'ANSAETTELSE_OG_PERSONALE',
  UDDANNELSESAFTALE: 'ANSAETTELSE_OG_PERSONALE',
  FRATROEDELSESAFTALE: 'ANSAETTELSE_OG_PERSONALE',
  KONKURRENCEKLAUSUL: 'ANSAETTELSE_OG_PERSONALE',
  PERSONALEHAANDBOG: 'ANSAETTELSE_OG_PERSONALE',
  // Lokaler og udstyr
  LEJEKONTRAKT_ERHVERV: 'LOKALER_OG_UDSTYR',
  LEASINGAFTALE: 'LOKALER_OG_UDSTYR',
  // Kommercielle aftaler
  LEVERANDOERKONTRAKT: 'KOMMERCIELLE_AFTALER',
  SAMARBEJDSAFTALE: 'KOMMERCIELLE_AFTALER',
  NDA: 'KOMMERCIELLE_AFTALER',
  IT_SYSTEMAFTALE: 'KOMMERCIELLE_AFTALER',
  DBA: 'KOMMERCIELLE_AFTALER',
  VOA: 'KOMMERCIELLE_AFTALER',
  // Forsikring og governance
  FORSIKRING: 'FORSIKRING_OG_GOVERNANCE',
  GF_REFERAT: 'FORSIKRING_OG_GOVERNANCE',
  BESTYRELSESREFERAT: 'FORSIKRING_OG_GOVERNANCE',
  FORRETNINGSORDEN: 'FORSIKRING_OG_GOVERNANCE',
  DIREKTIONSINSTRUKS: 'FORSIKRING_OG_GOVERNANCE',
  // Strukturaftaler (Lag 2)
  INTERN_SERVICEAFTALE: 'STRUKTURAFTALER',
  ROYALTY_LICENS: 'STRUKTURAFTALER',
  OPTIONSAFTALE: 'STRUKTURAFTALER',
  TILTRAEDELSESDOKUMENT: 'STRUKTURAFTALER',
  KASSEKREDIT: 'STRUKTURAFTALER',
  CASH_POOL: 'STRUKTURAFTALER',
  INTERCOMPANY_LAAN: 'STRUKTURAFTALER',
  SELSKABSGARANTI: 'STRUKTURAFTALER',
}

export function getContractCategory(systemType: string): ContractCategory {
  return CONTRACT_CATEGORY_MAP[systemType] ?? 'KOMMERCIELLE_AFTALER'
}

export function getContractCategoryLabel(category: ContractCategory): string {
  return CONTRACT_CATEGORY_LABELS[category] ?? category
}

// ─── Sensitivitetsniveauer ────────────────────────────────────────────────────

export const SENSITIVITY_LABELS: Record<string, string> = {
  PUBLIC: 'Offentlig',
  STANDARD: 'Standard',
  INTERN: 'Intern',
  FORTROLIG: 'Fortrolig',
  STRENGT_FORTROLIG: 'Strengt fortrolig',
}

export const SENSITIVITY_STYLES: Record<string, string> = {
  PUBLIC: 'bg-gray-50 text-gray-500',
  STANDARD: 'bg-gray-100 text-gray-600',
  INTERN: 'bg-blue-50 text-blue-600',
  FORTROLIG: 'bg-orange-50 text-orange-700',
  STRENGT_FORTROLIG: 'bg-red-50 text-red-700',
}

export function getSensitivityLabel(level: string): string {
  return SENSITIVITY_LABELS[level] ?? level
}

export function getSensitivityStyle(level: string): string {
  return SENSITIVITY_STYLES[level] ?? 'bg-gray-100 text-gray-600'
}

// ─── Brugerroller ─────────────────────────────────────────────────────────────

export const USER_ROLE_LABELS: Record<string, string> = {
  GROUP_OWNER: 'Kædeejer',
  GROUP_ADMIN: 'Kædeadministrator',
  GROUP_LEGAL: 'Juridisk ansvarlig',
  GROUP_FINANCE: 'Økonomisk ansvarlig',
  GROUP_READONLY: 'Revisor / Læseadgang',
  COMPANY_MANAGER: 'Klinikchef',
  COMPANY_LEGAL: 'Klinikjurist',
  COMPANY_READONLY: 'Klinik-læseadgang',
  EXTERNAL_PARTNER: 'Ekstern partner',
  EXTERNAL_EMPLOYEE: 'Ekstern medarbejder',
}

export const USER_ROLE_STYLES: Record<string, string> = {
  GROUP_OWNER: 'bg-blue-600 text-white',
  GROUP_ADMIN: 'bg-blue-100 text-blue-800',
  GROUP_LEGAL: 'bg-purple-100 text-purple-800',
  GROUP_FINANCE: 'bg-green-100 text-green-800',
  GROUP_READONLY: 'bg-gray-100 text-gray-600',
  COMPANY_MANAGER: 'bg-orange-100 text-orange-800',
  COMPANY_LEGAL: 'bg-purple-50 text-purple-700',
  COMPANY_READONLY: 'bg-gray-50 text-gray-500',
}

export function getUserRoleLabel(role: string): string {
  return USER_ROLE_LABELS[role] ?? role
}

export function getUserRoleStyle(role: string): string {
  return USER_ROLE_STYLES[role] ?? 'bg-gray-100 text-gray-600'
}

// ─── Opgavestatus ─────────────────────────────────────────────────────────────

export const TASK_STATUS_LABELS: Record<string, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AKTIV_TASK: 'Aktiv',
  AFVENTER: 'Afventer',
  LUKKET: 'Lukket',
}

export const TASK_STATUS_STYLES: Record<string, string> = {
  NY: 'bg-gray-100 text-gray-600',
  AKTIV: 'bg-blue-50 text-blue-700',
  AFVENTER: 'bg-yellow-50 text-yellow-700',
  LUKKET: 'bg-gray-50 text-gray-500',
}

export function getTaskStatusLabel(status: string): string {
  return TASK_STATUS_LABELS[status] ?? status
}

// ─── Prioritet ────────────────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<string, string> = {
  LAV: 'Lav',
  MELLEM: 'Mellem',
  HOEJ: 'Høj',
  KRITISK: 'Kritisk',
}

export const PRIORITY_STYLES: Record<string, string> = {
  LAV: 'bg-gray-100 text-gray-600',
  MELLEM: 'bg-blue-50 text-blue-700',
  HOEJ: 'bg-orange-50 text-orange-700',
  KRITISK: 'bg-red-100 text-red-700',
}

export function getPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? priority
}

export function getPriorityStyle(priority: string): string {
  return PRIORITY_STYLES[priority] ?? 'bg-gray-100 text-gray-600'
}

// ─── Sagsstatus ───────────────────────────────────────────────────────────────

export const CASE_STATUS_LABELS: Record<string, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AFVENTER_EKSTERN: 'Afventer ekstern',
  AFVENTER_KLIENT: 'Afventer klient',
  LUKKET: 'Lukket',
  ARKIVERET: 'Arkiveret',
}

export const CASE_STATUS_STYLES: Record<string, string> = {
  NY: 'bg-gray-100 text-gray-700',
  AKTIV: 'bg-blue-50 text-blue-700',
  AFVENTER_EKSTERN: 'bg-yellow-50 text-yellow-700',
  AFVENTER_KLIENT: 'bg-orange-50 text-orange-700',
  LUKKET: 'bg-green-50 text-green-700',
  ARKIVERET: 'bg-gray-50 text-gray-500',
}

export function getCaseStatusLabel(status: string): string {
  return CASE_STATUS_LABELS[status] ?? status
}

export function getCaseStatusStyle(status: string): string {
  return CASE_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'
}

// ─── Sagstype ─────────────────────────────────────────────────────────────────

export const CASE_TYPE_LABELS: Record<string, string> = {
  TRANSAKTION: 'Transaktion',
  TVIST: 'Tvist',
  COMPLIANCE: 'Compliance',
  KONTRAKT: 'Kontrakt',
  GOVERNANCE: 'Governance',
  ANDET: 'Andet',
}

export function getCaseTypeLabel(caseType: string): string {
  return CASE_TYPE_LABELS[caseType] ?? caseType
}

// ─── VersionSource ────────────────────────────────────────────────────────────

export const VERSION_SOURCE_LABELS: Record<string, string> = {
  BRANCHESTANDARD: 'Branchestandard',
  INTERNT: 'Internt',
  EKSTERNT_STANDARD: 'Eksternt standard',
  CUSTOM: 'Tilpasset',
}

export function getVersionSourceLabel(source: string): string {
  return VERSION_SOURCE_LABELS[source] ?? source
}

// ─── DeadlineType ─────────────────────────────────────────────────────────────

export const DEADLINE_TYPE_LABELS: Record<string, string> = {
  ABSOLUT: 'Absolut frist',
  OPERATIONEL: 'Operationel frist',
  INGEN: 'Ingen frist',
}

export function getDeadlineTypeLabel(type: string): string {
  return DEADLINE_TYPE_LABELS[type] ?? type
}

// ─── Metric typer ─────────────────────────────────────────────────────────────

export const METRIC_TYPE_LABELS: Record<string, string> = {
  OMSAETNING: 'Omsætning',
  EBITDA: 'EBITDA',
  RESULTAT: 'Resultat',
  LIKVIDITET: 'Likviditet',
  EGENKAPITAL: 'Egenkapital',
  ANDET: 'Andet',
}

export function getMetricTypeLabel(type: string): string {
  return METRIC_TYPE_LABELS[type] ?? type
}

// ─── Periode type ─────────────────────────────────────────────────────────────

export const PERIOD_TYPE_LABELS: Record<string, string> = {
  HELAER: 'Helår',
  HELAAR: 'Helår',
  H1: '1. halvår',
  H2: '2. halvår',
  Q1: '1. kvartal',
  Q2: '2. kvartal',
  Q3: '3. kvartal',
  Q4: '4. kvartal',
  MAANED: 'Måned',
}

export function getPeriodTypeLabel(type: string): string {
  return PERIOD_TYPE_LABELS[type] ?? type
}

// ─── Ændringstype (ContractVersion) ──────────────────────────────────────────

export const CHANGE_TYPE_LABELS: Record<string, string> = {
  NY_VERSION: 'Ny version',
  REDAKTIONEL: 'Redaktionel',
  MATERIEL: 'Materiel',
  ALLONGE: 'Allonge',
}

export const CHANGE_TYPE_STYLES: Record<string, string> = {
  NY_VERSION: 'bg-gray-100 text-gray-700',
  REDAKTIONEL: 'bg-blue-50 text-blue-700',
  MATERIEL: 'bg-orange-50 text-orange-700',
  ALLONGE: 'bg-purple-50 text-purple-700',
}

export function getChangeTypeLabel(changeType: string): string {
  return CHANGE_TYPE_LABELS[changeType] ?? changeType
}

export function getChangeTypeStyle(changeType: string): string {
  return CHANGE_TYPE_STYLES[changeType] ?? 'bg-gray-100 text-gray-700'
}

// ─── Besøgstype ──────────────────────────────────────────────────────────────

export const VISIT_TYPE_LABELS: Record<string, string> = {
  KVARTALSBESOEG: 'Kvartalsbesøg',
  OPFOELGNING: 'Opfølgning',
  AD_HOC: 'Ad hoc',
  AUDIT: 'Audit',
  ONBOARDING: 'Onboarding',
  OVERDRAGELSE: 'Overdragelse',
}

export const VISIT_STATUS_LABELS: Record<string, string> = {
  PLANLAGT: 'Planlagt',
  GENNEMFOERT: 'Gennemført',
  AFLYST: 'Aflyst',
}

export const VISIT_STATUS_STYLES: Record<string, string> = {
  PLANLAGT: 'bg-blue-50 text-blue-700',
  GENNEMFOERT: 'bg-green-50 text-green-700',
  AFLYST: 'bg-gray-100 text-gray-500',
}

export function getVisitTypeLabel(type: string): string {
  return VISIT_TYPE_LABELS[type] ?? type
}

export function getVisitStatusLabel(status: string): string {
  return VISIT_STATUS_LABELS[status] ?? status
}

export function getVisitStatusStyle(status: string): string {
  return VISIT_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
}

// ─── CompanyPerson roller ────────────────────────────────────────────────────

export const COMPANY_PERSON_ROLE_LABELS: Record<string, string> = {
  direktoer: 'Direktør',
  bestyrelsesformand: 'Bestyrelsesformand',
  bestyrelsesmedlem: 'Bestyrelsesmedlem',
  tegningsberettiget: 'Tegningsberettiget',
  revisor: 'Revisor',
  ansat: 'Ansat',
  funktionaer: 'Funktionær',
  'ikke-funktionaer': 'Ikke-funktionær',
  vikar: 'Vikar',
  leder: 'Leder/nøglemedarbejder',
  ekstern_advokat: 'Ekstern advokat',
  ekstern_raadgiver: 'Ekstern rådgiver',
  bankkontakt: 'Bankkontakt',
  forsikringskontakt: 'Forsikringskontakt',
}

export const GOVERNANCE_ROLES = [
  'direktoer',
  'bestyrelsesformand',
  'bestyrelsesmedlem',
  'tegningsberettiget',
  'revisor',
] as const

export const EMPLOYEE_ROLES = [
  'ansat',
  'funktionaer',
  'ikke-funktionaer',
  'vikar',
  'leder',
] as const

export function getCompanyPersonRoleLabel(role: string): string {
  return COMPANY_PERSON_ROLE_LABELS[role] ?? role
}

// ─── Økonomi kilde ───────────────────────────────────────────────────────────

export const METRIC_SOURCE_LABELS: Record<string, string> = {
  REVIDERET: 'Revideret',
  UREVIDERET: 'Urevideret',
  ESTIMAT: 'Estimat',
}

export const METRIC_SOURCE_STYLES: Record<string, string> = {
  REVIDERET: 'text-green-700',
  UREVIDERET: 'text-gray-500',
  ESTIMAT: 'text-yellow-600',
}

export function getMetricSourceLabel(source: string): string {
  return METRIC_SOURCE_LABELS[source] ?? source
}

export function getMetricSourceStyle(source: string): string {
  return METRIC_SOURCE_STYLES[source] ?? 'text-gray-500'
}

// ─── Hjælpefunktioner ─────────────────────────────────────────────────────────

/**
 * Formatér dato til dansk datoformat: "15. jan. 2025"
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Formatér dato til kort dansk format: "15/1-25"
 */
export function formatDateShort(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'numeric', year: '2-digit' })
}

/**
 * Beregn dage fra nu til dato (negativt = forfaldent)
 */
export function daysUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = d.getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Formater "udløber om X dage" / "forfaldent X dage"
 */
export function formatDaysUntilLabel(date: Date | string): string {
  const days = daysUntil(date)
  if (days < 0) return `${Math.abs(days)} dag${Math.abs(days) !== 1 ? 'e' : ''} forfalden`
  if (days === 0) return 'Udløber i dag'
  if (days === 1) return 'Udløber i morgen'
  return `${days} dage`
}

/**
 * Formatér beløb i DKK: "1.234.567 kr."
 */
export function formatCurrency(amount: number | string | null, currency = 'DKK'): string {
  if (amount === null || amount === undefined) return '—'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Formatér beløb i millioner: "1.2" (uden suffix — kald som `${formatMio(val)}M`)
 */
export function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1)
}

/**
 * Formatér filstørrelse: "1.2 MB", "512 KB", "128 B"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Relativ dato fra dage-til-udløb: "om 5 dage", "I dag", "3 dage siden"
 */
export function relativeDate(daysUntilExpiry: number | null): string {
  if (daysUntilExpiry == null) return '—'
  if (daysUntilExpiry < 0) return `${Math.abs(daysUntilExpiry)} dage siden`
  if (daysUntilExpiry === 0) return 'I dag'
  if (daysUntilExpiry === 1) return 'I morgen'
  return `om ${daysUntilExpiry} dage`
}
