export interface CvrCompanyData {
  cvr: string
  name: string
  address: string | null
  city: string | null
  postalCode: string | null
  companyType: string | null
  foundedDate: string | null
  capital: number | null
  status: string | null
  signingRule: string | null
}

export interface CvrLookupResult {
  found: boolean
  data: CvrCompanyData | null
  source: 'cvr_api'
}
