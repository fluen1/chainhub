import type { MockFinancialMetric, DataScenario } from './types'

// Realistiske tandlægeklinik-tal (DKK)
// Omsætning: 2-6M, EBITDA: 200K-800K, Resultat: 150K-600K
// Odense: EBITDA faldet 23% (490K→380K i 2024→2025)
// Viborg: Omsætning faldet 8% i 2025

export const mockFinancialMetrics: MockFinancialMetric[] = [
  // === ODENSE — critical EBITDA drop ===
  { companyId: 'company-odense', companyName: 'Odense Tandlægehus ApS', year: 2024, omsaetning: 4850000, ebitda: 490000, resultat: 380000, omsaetningTrend: 0.08, ebitdaTrend: 0.05 },
  { companyId: 'company-odense', companyName: 'Odense Tandlægehus ApS', year: 2025, omsaetning: 4720000, ebitda: 380000, resultat: 290000, omsaetningTrend: -0.03, ebitdaTrend: -0.23 },

  // === HORSENS ===
  { companyId: 'company-horsens', companyName: 'Horsens Tandklinik ApS', year: 2024, omsaetning: 3200000, ebitda: 320000, resultat: 250000, omsaetningTrend: 0.12, ebitdaTrend: 0.15 },
  { companyId: 'company-horsens', companyName: 'Horsens Tandklinik ApS', year: 2025, omsaetning: 3480000, ebitda: 365000, resultat: 285000, omsaetningTrend: 0.09, ebitdaTrend: 0.14 },

  // === VIBORG — omsætning down 8% ===
  { companyId: 'company-viborg', companyName: 'Viborg Tandlæge ApS', year: 2024, omsaetning: 3750000, ebitda: 430000, resultat: 330000, omsaetningTrend: 0.06, ebitdaTrend: 0.08 },
  { companyId: 'company-viborg', companyName: 'Viborg Tandlæge ApS', year: 2025, omsaetning: 3450000, ebitda: 395000, resultat: 295000, omsaetningTrend: -0.08, ebitdaTrend: -0.08 },

  // === AALBORG (positive trends) ===
  { companyId: 'company-aalborg', companyName: 'Aalborg Tandlægehus ApS', year: 2024, omsaetning: 5200000, ebitda: 620000, resultat: 480000, omsaetningTrend: 0.11, ebitdaTrend: 0.13 },
  { companyId: 'company-aalborg', companyName: 'Aalborg Tandlægehus ApS', year: 2025, omsaetning: 5650000, ebitda: 690000, resultat: 530000, omsaetningTrend: 0.09, ebitdaTrend: 0.11 },

  // === RANDERS ===
  { companyId: 'company-randers', companyName: 'Randers Tandklinik ApS', year: 2024, omsaetning: 2900000, ebitda: 285000, resultat: 220000, omsaetningTrend: 0.04, ebitdaTrend: 0.03 },
  { companyId: 'company-randers', companyName: 'Randers Tandklinik ApS', year: 2025, omsaetning: 3050000, ebitda: 310000, resultat: 240000, omsaetningTrend: 0.05, ebitdaTrend: 0.09 },

  // === SILKEBORG ===
  { companyId: 'company-silkeborg', companyName: 'Silkeborg Tandhus ApS', year: 2024, omsaetning: 2650000, ebitda: 265000, resultat: 200000, omsaetningTrend: 0.07, ebitdaTrend: 0.06 },
  { companyId: 'company-silkeborg', companyName: 'Silkeborg Tandhus ApS', year: 2025, omsaetning: 2820000, ebitda: 295000, resultat: 225000, omsaetningTrend: 0.06, ebitdaTrend: 0.11 },

  // === KOLDING ===
  { companyId: 'company-kolding', companyName: 'Kolding Tandlæge ApS', year: 2024, omsaetning: 3900000, ebitda: 450000, resultat: 345000, omsaetningTrend: 0.09, ebitdaTrend: 0.10 },
  { companyId: 'company-kolding', companyName: 'Kolding Tandlæge ApS', year: 2025, omsaetning: 4150000, ebitda: 490000, resultat: 375000, omsaetningTrend: 0.06, ebitdaTrend: 0.09 },

  // === AARHUS (healthy, positive) ===
  { companyId: 'company-aarhus', companyName: 'Aarhus Tandklinik ApS', year: 2024, omsaetning: 5800000, ebitda: 720000, resultat: 560000, omsaetningTrend: 0.14, ebitdaTrend: 0.16 },
  { companyId: 'company-aarhus', companyName: 'Aarhus Tandklinik ApS', year: 2025, omsaetning: 6200000, ebitda: 790000, resultat: 610000, omsaetningTrend: 0.07, ebitdaTrend: 0.10 },

  // === VEJLE ===
  { companyId: 'company-vejle', companyName: 'Vejle Tandlægehus ApS', year: 2024, omsaetning: 4200000, ebitda: 510000, resultat: 390000, omsaetningTrend: 0.10, ebitdaTrend: 0.12 },
  { companyId: 'company-vejle', companyName: 'Vejle Tandlægehus ApS', year: 2025, omsaetning: 4550000, ebitda: 565000, resultat: 430000, omsaetningTrend: 0.08, ebitdaTrend: 0.11 },

  // === FREDERICIA ===
  { companyId: 'company-fredericia', companyName: 'Fredericia Tandklinik ApS', year: 2024, omsaetning: 3100000, ebitda: 310000, resultat: 240000, omsaetningTrend: 0.05, ebitdaTrend: 0.07 },
  { companyId: 'company-fredericia', companyName: 'Fredericia Tandklinik ApS', year: 2025, omsaetning: 3280000, ebitda: 340000, resultat: 260000, omsaetningTrend: 0.06, ebitdaTrend: 0.10 },

  // === ESBJERG ===
  { companyId: 'company-esbjerg', companyName: 'Esbjerg Tandlæge ApS', year: 2024, omsaetning: 3600000, ebitda: 400000, resultat: 305000, omsaetningTrend: 0.08, ebitdaTrend: 0.09 },
  { companyId: 'company-esbjerg', companyName: 'Esbjerg Tandlæge ApS', year: 2025, omsaetning: 3850000, ebitda: 440000, resultat: 335000, omsaetningTrend: 0.07, ebitdaTrend: 0.10 },

  // === HERNING ===
  { companyId: 'company-herning', companyName: 'Herning Tandhus ApS', year: 2024, omsaetning: 3350000, ebitda: 370000, resultat: 285000, omsaetningTrend: 0.09, ebitdaTrend: 0.11 },
  { companyId: 'company-herning', companyName: 'Herning Tandhus ApS', year: 2025, omsaetning: 3580000, ebitda: 410000, resultat: 315000, omsaetningTrend: 0.07, ebitdaTrend: 0.11 },

  // === HOLSTEBRO ===
  { companyId: 'company-holstebro', companyName: 'Holstebro Tandklinik ApS', year: 2024, omsaetning: 2450000, ebitda: 240000, resultat: 185000, omsaetningTrend: 0.05, ebitdaTrend: 0.04 },
  { companyId: 'company-holstebro', companyName: 'Holstebro Tandklinik ApS', year: 2025, omsaetning: 2590000, ebitda: 265000, resultat: 200000, omsaetningTrend: 0.06, ebitdaTrend: 0.10 },

  // === ROSKILDE ===
  { companyId: 'company-roskilde', companyName: 'Roskilde Tandlægehus ApS', year: 2024, omsaetning: 4800000, ebitda: 580000, resultat: 445000, omsaetningTrend: 0.12, ebitdaTrend: 0.14 },
  { companyId: 'company-roskilde', companyName: 'Roskilde Tandlægehus ApS', year: 2025, omsaetning: 5100000, ebitda: 630000, resultat: 480000, omsaetningTrend: 0.06, ebitdaTrend: 0.09 },

  // === NÆSTVED ===
  { companyId: 'company-naestved', companyName: 'Næstved Tandklinik ApS', year: 2024, omsaetning: 3050000, ebitda: 295000, resultat: 225000, omsaetningTrend: 0.06, ebitdaTrend: 0.07 },
  { companyId: 'company-naestved', companyName: 'Næstved Tandklinik ApS', year: 2025, omsaetning: 3200000, ebitda: 325000, resultat: 248000, omsaetningTrend: 0.05, ebitdaTrend: 0.10 },

  // === SLAGELSE ===
  { companyId: 'company-slagelse', companyName: 'Slagelse Tandhus ApS', year: 2024, omsaetning: 2350000, ebitda: 220000, resultat: 168000, omsaetningTrend: 0.04, ebitdaTrend: 0.03 },
  { companyId: 'company-slagelse', companyName: 'Slagelse Tandhus ApS', year: 2025, omsaetning: 2480000, ebitda: 248000, resultat: 188000, omsaetningTrend: 0.06, ebitdaTrend: 0.13 },

  // === HILLERØD ===
  { companyId: 'company-hilleroed', companyName: 'Hillerød Tandlæge ApS', year: 2024, omsaetning: 3750000, ebitda: 445000, resultat: 340000, omsaetningTrend: 0.10, ebitdaTrend: 0.12 },
  { companyId: 'company-hilleroed', companyName: 'Hillerød Tandlæge ApS', year: 2025, omsaetning: 3990000, ebitda: 490000, resultat: 375000, omsaetningTrend: 0.06, ebitdaTrend: 0.10 },

  // === HELSINGØR ===
  { companyId: 'company-helsingoer', companyName: 'Helsingør Tandklinik ApS', year: 2024, omsaetning: 3200000, ebitda: 335000, resultat: 258000, omsaetningTrend: 0.07, ebitdaTrend: 0.09 },
  { companyId: 'company-helsingoer', companyName: 'Helsingør Tandklinik ApS', year: 2025, omsaetning: 3410000, ebitda: 370000, resultat: 284000, omsaetningTrend: 0.07, ebitdaTrend: 0.10 },

  // === KØGE ===
  { companyId: 'company-koege', companyName: 'Køge Tandlægehus ApS', year: 2024, omsaetning: 2800000, ebitda: 272000, resultat: 208000, omsaetningTrend: 0.05, ebitdaTrend: 0.06 },
  { companyId: 'company-koege', companyName: 'Køge Tandlægehus ApS', year: 2025, omsaetning: 2960000, ebitda: 302000, resultat: 230000, omsaetningTrend: 0.06, ebitdaTrend: 0.11 },

  // === SVENDBORG ===
  { companyId: 'company-svendborg', companyName: 'Svendborg Tandklinik ApS', year: 2024, omsaetning: 2150000, ebitda: 208000, resultat: 158000, omsaetningTrend: 0.04, ebitdaTrend: 0.05 },
  { companyId: 'company-svendborg', companyName: 'Svendborg Tandklinik ApS', year: 2025, omsaetning: 2280000, ebitda: 232000, resultat: 177000, omsaetningTrend: 0.06, ebitdaTrend: 0.12 },

  // === NYBORG ===
  { companyId: 'company-nyborg', companyName: 'Nyborg Tandhus ApS', year: 2024, omsaetning: 2050000, ebitda: 195000, resultat: 148000, omsaetningTrend: 0.03, ebitdaTrend: 0.04 },
  { companyId: 'company-nyborg', companyName: 'Nyborg Tandhus ApS', year: 2025, omsaetning: 2180000, ebitda: 218000, resultat: 165000, omsaetningTrend: 0.06, ebitdaTrend: 0.12 },

  // === HADERSLEV ===
  { companyId: 'company-haderslev', companyName: 'Haderslev Tandlæge ApS', year: 2024, omsaetning: 3550000, ebitda: 415000, resultat: 318000, omsaetningTrend: 0.09, ebitdaTrend: 0.11 },
  { companyId: 'company-haderslev', companyName: 'Haderslev Tandlæge ApS', year: 2025, omsaetning: 3760000, ebitda: 458000, resultat: 350000, omsaetningTrend: 0.06, ebitdaTrend: 0.10 },
]

export function getFinancialMetrics(scenario: DataScenario = 'normal'): MockFinancialMetric[] {
  if (scenario === 'empty') return []
  return mockFinancialMetrics
}

export function getFinancialByCompany(companyId: string): MockFinancialMetric[] {
  return mockFinancialMetrics.filter((m) => m.companyId === companyId)
}

export function getUnderperformingCompanies(): { companyId: string; companyName: string; reason: string }[] {
  return [
    { companyId: 'company-odense', companyName: 'Odense Tandlægehus ApS', reason: 'EBITDA faldet 23% (490K → 380K)' },
    { companyId: 'company-viborg', companyName: 'Viborg Tandlæge ApS', reason: 'Omsætning faldet 8% i 2025' },
  ]
}

export function getPortfolioTotals(year: number): {
  year: number
  totalOmsaetning: number
  totalEbitda: number
  totalResultat: number
  avgEbitdaMargin: number
} {
  const metrics = mockFinancialMetrics.filter((m) => m.year === year)
  const totalOmsaetning = metrics.reduce((sum, m) => sum + (m.omsaetning ?? 0), 0)
  const totalEbitda = metrics.reduce((sum, m) => sum + (m.ebitda ?? 0), 0)
  const totalResultat = metrics.reduce((sum, m) => sum + (m.resultat ?? 0), 0)
  const avgEbitdaMargin = totalOmsaetning > 0 ? totalEbitda / totalOmsaetning : 0

  return { year, totalOmsaetning, totalEbitda, totalResultat, avgEbitdaMargin }
}
