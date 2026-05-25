import type { CvrLookupResult } from './types'

const CVR_API_URL = 'https://cvrapi.dk/api'
const NOT_FOUND: CvrLookupResult = { found: false, data: null, source: 'cvr_api' }

// cvrapi.dk response-format (relevante felter)
interface CvrApiResponse {
  vat?: string
  name?: string
  address?: string
  zipcode?: string
  city?: string
  type?: string
  startdate?: string
  capital?: number
  status?: string
  companydesc?: string
}

export async function lookupByCvr(cvr: string): Promise<CvrLookupResult> {
  // Valider CVR: præcis 8 cifre
  if (!/^\d{8}$/.test(cvr.trim())) {
    return NOT_FOUND
  }

  try {
    const signal = AbortSignal.timeout(5000)
    const response = await fetch(`${CVR_API_URL}?search=${cvr.trim()}&country=dk`, {
      headers: {
        'User-Agent': 'ChainHub/1.0 (chainhub.dk)',
      },
      signal,
    })

    if (!response.ok) {
      return NOT_FOUND
    }

    const json: CvrApiResponse = (await response.json()) as CvrApiResponse

    if (!json.name) {
      return NOT_FOUND
    }

    return {
      found: true,
      source: 'cvr_api',
      data: {
        cvr: json.vat ?? cvr.trim(),
        name: json.name,
        address: json.address ?? null,
        city: json.city ?? null,
        postalCode: json.zipcode ?? null,
        companyType: json.type ?? null,
        foundedDate: json.startdate ?? null,
        capital: json.capital ?? null,
        status: json.status ?? null,
        signingRule: json.companydesc ?? null,
      },
    }
  } catch {
    return NOT_FOUND
  }
}
