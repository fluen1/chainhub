export type MockRole = 'GROUP_OWNER' | 'GROUP_LEGAL' | 'GROUP_FINANCE' | 'GROUP_ADMIN' | 'COMPANY_MANAGER'
export type DataScenario = 'normal' | 'many_warnings' | 'empty'

export interface MockUser {
  id: string; name: string; email: string; role: MockRole; roleLabel: string; companyIds: string[]
}

export interface MockCompany {
  id: string; name: string; cvr: string
  status: 'AKTIV' | 'UNDER_STIFTELSE' | 'UNDER_AFVIKLING' | 'INAKTIV'
  city: string; address: string; companyType: string
  healthStatus: 'healthy' | 'warning' | 'critical'; healthReasons: string[]
  partnerName: string; partnerOwnershipPct: number; groupOwnershipPct: number
  contractCount: number; openCaseCount: number; employeeCount: number
}

export interface MockContract {
  id: string; companyId: string; companyName: string; displayName: string
  systemType: string; category: string; categoryLabel: string
  status: 'UDKAST' | 'AKTIV' | 'UDLOEBET' | 'OPSAGT' | 'FORNYET'; statusLabel: string
  expiryDate: string | null; daysUntilExpiry: number | null
  urgency: 'critical' | 'warning' | 'normal' | 'none'; sensitivity: string
}

export interface MockTask {
  id: string; title: string
  status: 'NY' | 'AKTIV' | 'AFVENTER' | 'LUKKET'; statusLabel: string
  priority: 'LAV' | 'MELLEM' | 'HOEJ' | 'KRITISK'; priorityLabel: string
  dueDate: string | null; daysUntilDue: number | null
  companyId: string; companyName: string
  assignedTo: string; assignedToName: string
  timeGroup: 'overdue' | 'this_week' | 'next_week' | 'later' | 'no_date'
}

export interface MockDocument {
  id: string; fileName: string; fileType: string
  companyId: string; companyName: string
  uploadedAt: string; uploadedBy: string
  status: 'processing' | 'ready_for_review' | 'reviewed' | 'archived'
  processingStage?: string; processingProgress?: number
  confidenceLevel?: 'high' | 'medium' | 'low'
  extractedFieldCount?: number; attentionFieldCount?: number
}

export interface MockExtractedField {
  id: string; fieldName: string; fieldLabel: string
  extractedValue: string | null; existingValue: string | null
  confidence: number; confidenceLevel: 'high' | 'medium' | 'low'
  sourcePageNumber: number; sourceParagraph: string; sourceText: string
  hasDiscrepancy: boolean; discrepancyType?: 'value_mismatch' | 'missing_clause' | 'new_data'
  category: string
}

export interface MockFinancialMetric {
  companyId: string; companyName: string; year: number
  omsaetning: number | null; ebitda: number | null; resultat: number | null
  omsaetningTrend: number | null; ebitdaTrend: number | null
}

export interface MockInsight {
  id: string; type: 'critical' | 'warning' | 'info' | 'coverage'
  icon: string; title: string; description: string
  actionLabel: string; actionHref: string
  roles: MockRole[]; page: string
}

export interface MockSearchResponse {
  query: string; queryType: 'search' | 'question' | 'action'
  directMatches: { type: 'company' | 'person' | 'contract' | 'document' | 'case'; typeLabel: string; id: string; title: string; subtitle: string; href: string }[]
  aiAnswer?: { text: string; dataPoints: { label: string; value: string; urgency?: 'critical' | 'warning' | 'normal'; href?: string }[] }
  suggestedFollowUps: string[]
  actionPreview?: { description: string; items: { label: string; checked: boolean }[]; confirmLabel: string }
}

export interface PrototypeState {
  activeUser: MockUser; companyCount: number; dataScenario: DataScenario
}
