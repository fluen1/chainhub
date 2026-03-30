import type { MockContract, DataScenario } from './types'

// Hjælpefunktion til at beregne dage fra i dag
function daysFromNow(days: number): string {
  const d = new Date('2026-03-30')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysAgo(days: number): string {
  return daysFromNow(-days)
}

type ContractStatus = MockContract['status']
type ContractUrgency = MockContract['urgency']

function makeContracts(
  companyId: string,
  companyName: string,
  specs: {
    id: string
    displayName: string
    systemType: string
    category: string
    categoryLabel: string
    status: ContractStatus
    statusLabel: string
    expiryDate: string | null
    daysUntilExpiry: number | null
    urgency: ContractUrgency
    sensitivity: string
  }[]
): MockContract[] {
  return specs.map((s) => ({ companyId, companyName, ...s }))
}

// ---- ODENSE (critical: forsikring udløbet) ----
const odenseContracts = makeContracts('company-odense', 'Odense Tandlægehus ApS', [
  { id: 'c-odense-1', displayName: 'Ejeraftale 2021', systemType: 'EJERAFTALE', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-odense-2', displayName: 'Lejekontrakt Vestergade', systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(720), daysUntilExpiry: 720, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-odense-3', displayName: 'Erhvervsforsikring 2025', systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'UDLOEBET', statusLabel: 'Udløbet', expiryDate: daysAgo(12), daysUntilExpiry: -12, urgency: 'critical', sensitivity: 'STANDARD' },
  { id: 'c-odense-4', displayName: 'Ansættelseskontrakt Henrik Munk', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-odense-5', displayName: 'Klinikdriftsaftale', systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(365), daysUntilExpiry: 365, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-odense-6', displayName: 'Samarbejdsaftale 2023', systemType: 'SAMARBEJDSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(180), daysUntilExpiry: 180, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-odense-7', displayName: 'Non-disclosure aftale', systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(540), daysUntilExpiry: 540, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-odense-8', displayName: 'Vedtægter 2021', systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-odense-9', displayName: 'Ansættelseskontrakt sygeplejerske', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
])

// ---- HORSENS (critical: ejeraftale mangler) ----
const horsensContracts = makeContracts('company-horsens', 'Horsens Tandklinik ApS', [
  { id: 'c-horsens-1', displayName: 'Lejekontrakt Søndergade', systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(900), daysUntilExpiry: 900, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-horsens-2', displayName: 'Ansættelseskontrakt Camilla Broe', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-horsens-3', displayName: 'Erhvervsforsikring 2025', systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(240), daysUntilExpiry: 240, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-horsens-4', displayName: 'Klinikdriftsaftale', systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(400), daysUntilExpiry: 400, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-horsens-5', displayName: 'Vedtægter 2023', systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-horsens-6', displayName: 'Non-disclosure aftale', systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(600), daysUntilExpiry: 600, urgency: 'none', sensitivity: 'FORTROLIG' },
  // Note: mangler EJERAFTALE — det er pointen
])

// ---- VIBORG (critical: lejekontrakt udløber snart) ----
const viborgContracts = makeContracts('company-viborg', 'Viborg Tandlæge ApS', [
  { id: 'c-viborg-1', displayName: 'Ejeraftale 2022', systemType: 'EJERAFTALE', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-viborg-2', displayName: 'Lejekontrakt Sct. Mathias Gade', systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(28), daysUntilExpiry: 28, urgency: 'critical', sensitivity: 'STANDARD' },
  { id: 'c-viborg-3', displayName: 'Erhvervsforsikring 2025', systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(300), daysUntilExpiry: 300, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-viborg-4', displayName: 'Ansættelseskontrakt Peter Holm', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-viborg-5', displayName: 'Klinikdriftsaftale', systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(500), daysUntilExpiry: 500, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-viborg-6', displayName: 'Vedtægter 2022', systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-viborg-7', displayName: 'Non-disclosure aftale', systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(730), daysUntilExpiry: 730, urgency: 'none', sensitivity: 'FORTROLIG' },
  // Note: mangler LEJEKONTRAKT fornyelse
])

// ---- AALBORG (warning: samarbejdsaftale udløber) ----
const aalborgContracts = makeContracts('company-aalborg', 'Aalborg Tandlægehus ApS', [
  { id: 'c-aalborg-1', displayName: 'Ejeraftale 2020', systemType: 'EJERAFTALE', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-aalborg-2', displayName: 'Lejekontrakt Algade', systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(1200), daysUntilExpiry: 1200, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aalborg-3', displayName: 'Erhvervsforsikring 2025', systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(180), daysUntilExpiry: 180, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aalborg-4', displayName: 'Samarbejdsaftale region', systemType: 'SAMARBEJDSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(68), daysUntilExpiry: 68, urgency: 'warning', sensitivity: 'STANDARD' },
  { id: 'c-aalborg-5', displayName: 'Ansættelseskontrakt Lone Sørensen', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-aalborg-6', displayName: 'Klinikdriftsaftale', systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(600), daysUntilExpiry: 600, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aalborg-7', displayName: 'Vedtægter 2020', systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aalborg-8', displayName: 'Non-disclosure aftale', systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(800), daysUntilExpiry: 800, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-aalborg-9', displayName: 'Ansættelseskontrakt assistent', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-aalborg-10', displayName: 'Inventaraftale 2024', systemType: 'INVENTARLEASING', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(400), daysUntilExpiry: 400, urgency: 'none', sensitivity: 'STANDARD' },
])

// ---- RANDERS (warning) ----
const randersContracts = makeContracts('company-randers', 'Randers Tandklinik ApS', [
  { id: 'c-randers-1', displayName: 'Ejeraftale 2021', systemType: 'EJERAFTALE', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-randers-2', displayName: 'Lejekontrakt Torvegade', systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(1100), daysUntilExpiry: 1100, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-randers-3', displayName: 'Erhvervsforsikring 2025', systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(350), daysUntilExpiry: 350, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-randers-4', displayName: 'Ansættelseskontrakt Mads Overgaard', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-randers-5', displayName: 'Klinikdriftsaftale', systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(450), daysUntilExpiry: 450, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-randers-6', displayName: 'Vedtægter 2021', systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-randers-7', displayName: 'Samarbejdsaftale 2022', systemType: 'SAMARBEJDSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(200), daysUntilExpiry: 200, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-randers-8', displayName: 'Non-disclosure aftale', systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(700), daysUntilExpiry: 700, urgency: 'none', sensitivity: 'FORTROLIG' },
])

// ---- SILKEBORG (warning) ----
const silkeborgContracts = makeContracts('company-silkeborg', 'Silkeborg Tandhus ApS', [
  { id: 'c-silkeborg-1', displayName: 'Ejeraftale 2022', systemType: 'EJERAFTALE', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-silkeborg-2', displayName: 'Lejekontrakt Papirfabrikken', systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(800), daysUntilExpiry: 800, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-silkeborg-3', displayName: 'Erhvervsforsikring 2025', systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(270), daysUntilExpiry: 270, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-silkeborg-4', displayName: 'Ansættelseskontrakt Anne Kjær', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-silkeborg-5', displayName: 'Klinikdriftsaftale', systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(550), daysUntilExpiry: 550, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-silkeborg-6', displayName: 'Vedtægter 2022', systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-silkeborg-7', displayName: 'Non-disclosure aftale', systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(650), daysUntilExpiry: 650, urgency: 'none', sensitivity: 'FORTROLIG' },
])

// ---- KOLDING (warning) ----
const koldingContracts = makeContracts('company-kolding', 'Kolding Tandlæge ApS', [
  { id: 'c-kolding-1', displayName: 'Ejeraftale 2021', systemType: 'EJERAFTALE', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-kolding-2', displayName: 'Lejekontrakt Akseltorv', systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(950), daysUntilExpiry: 950, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-kolding-3', displayName: 'Erhvervsforsikring 2025', systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(82), daysUntilExpiry: 82, urgency: 'warning', sensitivity: 'STANDARD' },
  { id: 'c-kolding-4', displayName: 'Ansættelseskontrakt Søren Damgaard', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-kolding-5', displayName: 'Klinikdriftsaftale', systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(480), daysUntilExpiry: 480, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-kolding-6', displayName: 'Samarbejdsaftale 2023', systemType: 'SAMARBEJDSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(250), daysUntilExpiry: 250, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-kolding-7', displayName: 'Vedtægter 2021', systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-kolding-8', displayName: 'Non-disclosure aftale', systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(750), daysUntilExpiry: 750, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-kolding-9', displayName: 'Inventaraftale 2023', systemType: 'INVENTARLEASING', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(300), daysUntilExpiry: 300, urgency: 'none', sensitivity: 'STANDARD' },
])

// ---- AARHUS (healthy, 12 kontrakter) ----
const aarhusContracts = makeContracts('company-aarhus', 'Aarhus Tandklinik ApS', [
  { id: 'c-aarhus-1', displayName: 'Ejeraftale 2020', systemType: 'EJERAFTALE', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-aarhus-2', displayName: 'Lejekontrakt Strøget', systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(1500), daysUntilExpiry: 1500, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aarhus-3', displayName: 'Erhvervsforsikring 2025', systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(320), daysUntilExpiry: 320, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aarhus-4', displayName: 'Ansættelseskontrakt Jens Thomsen', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-aarhus-5', displayName: 'Klinikdriftsaftale', systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(600), daysUntilExpiry: 600, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aarhus-6', displayName: 'Samarbejdsaftale region', systemType: 'SAMARBEJDSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(400), daysUntilExpiry: 400, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aarhus-7', displayName: 'Vedtægter 2020', systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aarhus-8', displayName: 'Non-disclosure aftale', systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(900), daysUntilExpiry: 900, urgency: 'none', sensitivity: 'FORTROLIG' },
  { id: 'c-aarhus-9', displayName: 'Ansættelseskontrakt assistent 1', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-aarhus-10', displayName: 'Ansættelseskontrakt assistent 2', systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
  { id: 'c-aarhus-11', displayName: 'Inventaraftale 2024', systemType: 'INVENTARLEASING', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(500), daysUntilExpiry: 500, urgency: 'none', sensitivity: 'STANDARD' },
  { id: 'c-aarhus-12', displayName: 'Patientdatabehandleraftale', systemType: 'DATABEHANDLERAFTALE', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
])

// ---- Remaining 14 healthy companies — standard 6-8 contracts each ----
function makeStandardContracts(
  companyId: string,
  companyName: string,
  city: string,
  baseId: string,
  ejectDate: number,
  leaseDate: number,
  insuranceDate: number
): MockContract[] {
  return makeContracts(companyId, companyName, [
    { id: `c-${baseId}-1`, displayName: `Ejeraftale ${city}`, systemType: 'EJERAFTALE', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'FORTROLIG' },
    { id: `c-${baseId}-2`, displayName: `Lejekontrakt ${city}`, systemType: 'LEJEKONTRAKT', category: 'Lokaler', categoryLabel: 'Lokaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(leaseDate), daysUntilExpiry: leaseDate, urgency: 'none', sensitivity: 'STANDARD' },
    { id: `c-${baseId}-3`, displayName: `Erhvervsforsikring 2025`, systemType: 'FORSIKRING', category: 'Forsikring', categoryLabel: 'Forsikring', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(insuranceDate), daysUntilExpiry: insuranceDate, urgency: 'none', sensitivity: 'STANDARD' },
    { id: `c-${baseId}-4`, displayName: `Ansættelseskontrakt`, systemType: 'ANSAETTELSESKONTRAKT', category: 'Ansaettelse', categoryLabel: 'Ansættelse', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'INTERN' },
    { id: `c-${baseId}-5`, displayName: `Klinikdriftsaftale`, systemType: 'DRIFTSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(ejectDate), daysUntilExpiry: ejectDate, urgency: 'none', sensitivity: 'STANDARD' },
    { id: `c-${baseId}-6`, displayName: `Vedtægter`, systemType: 'VEDTAEGTER', category: 'Ejerskab', categoryLabel: 'Ejerskab', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: null, daysUntilExpiry: null, urgency: 'none', sensitivity: 'STANDARD' },
    { id: `c-${baseId}-7`, displayName: `Non-disclosure aftale`, systemType: 'NDA', category: 'Strukturaftaler', categoryLabel: 'Strukturaftaler', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(800), daysUntilExpiry: 800, urgency: 'none', sensitivity: 'FORTROLIG' },
    { id: `c-${baseId}-8`, displayName: `Samarbejdsaftale`, systemType: 'SAMARBEJDSAFTALE', category: 'Kommercielle', categoryLabel: 'Kommercielle', status: 'AKTIV', statusLabel: 'Aktiv', expiryDate: daysFromNow(350), daysUntilExpiry: 350, urgency: 'none', sensitivity: 'STANDARD' },
  ])
}

const vejleContracts = makeStandardContracts('company-vejle', 'Vejle Tandlægehus ApS', 'Vejle', 'vejle', 520, 1300, 290)
const fredericiaContracts = makeStandardContracts('company-fredericia', 'Fredericia Tandklinik ApS', 'Fredericia', 'fredericia', 460, 1100, 340)
const esbjergContracts = makeStandardContracts('company-esbjerg', 'Esbjerg Tandlæge ApS', 'Esbjerg', 'esbjerg', 580, 1250, 310)
const herningContracts = makeStandardContracts('company-herning', 'Herning Tandhus ApS', 'Herning', 'herning', 500, 1050, 280)
const holstebroContracts = makeStandardContracts('company-holstebro', 'Holstebro Tandklinik ApS', 'Holstebro', 'holstebro', 420, 980, 260)
const roskildeContracts = makeStandardContracts('company-roskilde', 'Roskilde Tandlægehus ApS', 'Roskilde', 'roskilde', 600, 1400, 320)
const naestvedContracts = makeStandardContracts('company-naestved', 'Næstved Tandklinik ApS', 'Næstved', 'naestved', 440, 1020, 295)
const slagelseContracts = makeStandardContracts('company-slagelse', 'Slagelse Tandhus ApS', 'Slagelse', 'slagelse', 380, 900, 270)
const hilleroedContracts = makeStandardContracts('company-hilleroed', 'Hillerød Tandlæge ApS', 'Hillerød', 'hilleroed', 560, 1150, 305)
const helsingoerContracts = makeStandardContracts('company-helsingoer', 'Helsingør Tandklinik ApS', 'Helsingør', 'helsingoer', 490, 1080, 285)
const koegeContracts = makeStandardContracts('company-koege', 'Køge Tandlægehus ApS', 'Køge', 'koege', 410, 970, 265)
const svendborgContracts = makeStandardContracts('company-svendborg', 'Svendborg Tandklinik ApS', 'Svendborg', 'svendborg', 360, 850, 255)
const nyborgContracts = makeStandardContracts('company-nyborg', 'Nyborg Tandhus ApS', 'Nyborg', 'nyborg', 320, 820, 240)
const haderslevContracts = makeStandardContracts('company-haderslev', 'Haderslev Tandlæge ApS', 'Haderslev', 'haderslev', 530, 1200, 315)

export const mockContracts: MockContract[] = [
  ...odenseContracts,
  ...horsensContracts,
  ...viborgContracts,
  ...aalborgContracts,
  ...randersContracts,
  ...silkeborgContracts,
  ...koldingContracts,
  ...aarhusContracts,
  ...vejleContracts,
  ...fredericiaContracts,
  ...esbjergContracts,
  ...herningContracts,
  ...holstebroContracts,
  ...roskildeContracts,
  ...naestvedContracts,
  ...slagelseContracts,
  ...hilleroedContracts,
  ...helsingoerContracts,
  ...koegeContracts,
  ...svendborgContracts,
  ...nyborgContracts,
  ...haderslevContracts,
]

export function getContracts(scenario: DataScenario = 'normal'): MockContract[] {
  if (scenario === 'empty') return []
  return mockContracts
}

export function getContractsByCompany(companyId: string): MockContract[] {
  return mockContracts.filter((c) => c.companyId === companyId)
}

export function getContractById(id: string): MockContract | undefined {
  return mockContracts.find((c) => c.id === id)
}

export function getExpiringContracts(days: number): MockContract[] {
  return mockContracts.filter(
    (c) => c.daysUntilExpiry !== null && c.daysUntilExpiry >= 0 && c.daysUntilExpiry <= days
  )
}

export function getContractCoverage(): {
  companyId: string
  companyName: string
  missingTypes: string[]
}[] {
  const requiredTypes = ['EJERAFTALE', 'LEJEKONTRAKT', 'FORSIKRING', 'ANSAETTELSESKONTRAKT']
  const companies = [
    { id: 'company-odense', name: 'Odense Tandlægehus ApS' },
    { id: 'company-horsens', name: 'Horsens Tandklinik ApS' },
    { id: 'company-viborg', name: 'Viborg Tandlæge ApS' },
  ]

  return companies.map(({ id, name }) => {
    const companyContractTypes = mockContracts
      .filter((c) => c.companyId === id)
      .map((c) => c.systemType)
    const missingTypes = requiredTypes.filter((t) => !companyContractTypes.includes(t))
    return { companyId: id, companyName: name, missingTypes }
  })
}

export function getMissingContracts(): { companyId: string; companyName: string; missingType: string; description: string }[] {
  return [
    { companyId: 'company-horsens', companyName: 'Horsens Tandklinik ApS', missingType: 'EJERAFTALE', description: 'Ejeraftale mangler — 6 måneder efter stiftelse' },
    { companyId: 'company-odense', companyName: 'Odense Tandlægehus ApS', missingType: 'FORSIKRING', description: 'Erhvervsforsikring udløbet og ikke fornyet' },
    { companyId: 'company-viborg', companyName: 'Viborg Tandlæge ApS', missingType: 'LEJEKONTRAKT', description: 'Lejekontrakt udløber om 28 dage og er ikke fornyet' },
  ]
}
