export interface PortfolioCompanyRow {
  id: string
  name: string
  cvr: string | null
  companyType: string | null
  status: string
  city: string | null
  createdAt: Date
  maxEjerandel: number | null
  activeCases: number
  expiringContracts: number
  totalContracts: number
}

export interface PortfolioSummary {
  totalCompanies: number
  activeCompanies: number
  totalActiveCases: number
  totalExpiringContracts: number
}

export interface PortfolioData {
  companies: PortfolioCompanyRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  summary: PortfolioSummary
}

export type PortfolioFilters = {
  status?: string
  minEjerandel?: number
  maxEjerandel?: number
  harAktiveSager?: boolean
  harUdloebende?: boolean
  page: number
}