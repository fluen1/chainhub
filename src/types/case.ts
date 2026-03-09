import type {
  Case,
  CaseCompany,
  CaseContract,
  CasePerson,
  Task,
  Deadline,
  Document,
  Company,
  Contract,
  Person,
  TimeEntry,
  CaseStatus,
  SagsType,
  SagsSubtype,
  SensitivityLevel,
  Prisma,
} from '@prisma/client'

// ==================== FÆLLES ====================

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

// ==================== SAG ====================

export type CaseWithRelations = Prisma.CaseGetPayload<{
  include: {
    caseCompanies: {
      include: { company: true }
    }
    caseContracts: {
      include: { contract: { include: { company: true } } }
    }
    casePersons: {
      include: { person: true }
    }
    tasks: {
      where: { deletedAt: null }
      orderBy: { createdAt: 'desc' }
    }
    deadlines: {
      where: { deletedAt: null }
      orderBy: { dueDate: 'asc' }
    }
    documents: {
      where: { deletedAt: null }
    }
    _count: {
      select: {
        tasks: true
        deadlines: true
        documents: true
        timeEntries: true
        caseCompanies: true
        caseContracts: true
        casePersons: true
      }
    }
  }
}>

export type CaseWithCounts = Prisma.CaseGetPayload<{
  include: {
    caseCompanies: {
      include: { company: { select: { id: true; name: true } } }
    }
    _count: {
      select: {
        tasks: true
        deadlines: true
        documents: true
        caseCompanies: true
        caseContracts: true
        casePersons: true
      }
    }
  }
}>

export type TaskWithAssignee = Prisma.TaskGetPayload<{
  include: {
    assignee: {
      select: { id: true; name: true; email: true; avatarUrl: true }
    }
  }
}>

export type DeadlineWithCase = Prisma.DeadlineGetPayload<{
  include: {
    case: { select: { id: true; title: true } }
  }
}>

// ==================== STATUS FLOW ====================

export const VALID_CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NY: ['AKTIV'],
  AKTIV: ['AFVENTER_EKSTERN', 'AFVENTER_KLIENT', 'LUKKET', 'ARKIVERET'],
  AFVENTER_EKSTERN: ['AKTIV', 'LUKKET', 'ARKIVERET'],
  AFVENTER_KLIENT: ['AKTIV', 'LUKKET', 'ARKIVERET'],
  LUKKET: ['ARKIVERET'],
  ARKIVERET: [],
}

export function isValidCaseStatusTransition(
  current: CaseStatus,
  next: CaseStatus
): boolean {
  return VALID_CASE_STATUS_TRANSITIONS[current]?.includes(next) ?? false
}

// ==================== SAGSTYPE MAPPING ====================

export const CASE_TYPE_LABELS: Record<SagsType, string> = {
  TRANSAKTION: 'Transaktion',
  TVIST: 'Tvist',
  COMPLIANCE: 'Compliance',
  KONTRAKT: 'Kontrakt',
  GOVERNANCE: 'Governance',
  ANDET: 'Andet',
}

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AFVENTER_EKSTERN: 'Afventer ekstern',
  AFVENTER_KLIENT: 'Afventer klient',
  LUKKET: 'Lukket',
  ARKIVERET: 'Arkiveret',
}

export const CASE_SUBTYPE_LABELS: Record<string, string> = {
  // TRANSAKTION
  VIRKSOMHEDSKOEB: 'Virksomhedskøb',
  VIRKSOMHEDSSALG: 'Virksomhedssalg',
  FUSION: 'Fusion',
  OMSTRUKTURERING: 'Omstrukturering',
  STIFTELSE: 'Stiftelse',
  // TVIST
  RETSSAG: 'Retssag',
  VOLDGIFT: 'Voldgift',
  FORHANDLING_MED_MODPART: 'Forhandling med modpart',
  INKASSO: 'Inkasso',
  // COMPLIANCE
  GDPR: 'GDPR',
  ARBEJDSMILJOE: 'Arbejdsmiljø',
  MYNDIGHEDSPAABUD: 'Myndighedspåbud',
  SKATTEMASSIG: 'Skattemæssig',
  // KONTRAKT
  FORHANDLING: 'Forhandling',
  OPSIGELSE: 'Opsigelse',
  FORNYELSE: 'Fornyelse',
  MISLIGHOLDELSE: 'Misligholdelse',
  // GOVERNANCE
  GENERALFORSAMLING: 'Generalforsamling',
  BESTYRELSESMOEDE: 'Bestyrelsesmøde',
  VEDTAEGTSAENDRING: 'Vedtægtsændring',
  DIREKTOERSKIFTE: 'Direktørskifte',
}

// Gyldige subtypes per sagstype
export const VALID_SUBTYPES_FOR_TYPE: Record<SagsType, string[]> = {
  TRANSAKTION: [
    'VIRKSOMHEDSKOEB',
    'VIRKSOMHEDSSALG',
    'FUSION',
    'OMSTRUKTURERING',
    'STIFTELSE',
  ],
  TVIST: ['RETSSAG', 'VOLDGIFT', 'FORHANDLING_MED_MODPART', 'INKASSO'],
  COMPLIANCE: ['GDPR', 'ARBEJDSMILJOE', 'MYNDIGHEDSPAABUD', 'SKATTEMASSIG'],
  KONTRAKT: ['FORHANDLING', 'OPSIGELSE', 'FORNYELSE', 'MISLIGHOLDELSE'],
  GOVERNANCE: [
    'GENERALFORSAMLING',
    'BESTYRELSESMOEDE',
    'VEDTAEGTSAENDRING',
    'DIREKTOERSKIFTE',
  ],
  ANDET: [],
}

// ==================== EMAIL SYNC ====================

export interface EmailSyncStatus {
  connected: boolean
  lastSyncAt: Date | null
  totalEmails: number
  error: string | null
}

export interface EmailSyncConfig {
  enabled: boolean
  bccAddress: string | null
  microsoftClientId: string | null
  configurationGuide: string
}

export interface EmailThreadEntry {
  id: string
  subject: string
  from: string
  receivedAt: Date
  bodyPreview: string
  caseId: string
}