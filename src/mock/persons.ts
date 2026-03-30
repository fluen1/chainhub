import type { MockRole } from './types'

export interface MockPerson {
  name: string
  role: string
  email: string
  startDate: string
}

// ---------------------------------------------------------------
// Persons per company — unikke, realistiske navne
// ---------------------------------------------------------------

const personsByCompany: Record<string, MockPerson[]> = {
  'company-odense': [
    { name: 'Henrik Munk', role: 'Direktoer', email: 'henrik.munk@odense-tand.dk', startDate: '2018-04-01' },
    { name: 'Dorthe Lassen', role: 'Klinikchef', email: 'dorthe.lassen@odense-tand.dk', startDate: '2019-09-01' },
    { name: 'Rasmus Kjeldsen', role: 'Tandlaege', email: 'rasmus.kjeldsen@odense-tand.dk', startDate: '2021-02-01' },
    { name: 'Vibeke Nørgaard', role: 'Receptionist', email: 'vibeke@odense-tand.dk', startDate: '2022-06-15' },
    { name: 'Søren Holm', role: 'Bestyrelsesmedlem', email: 'soren.holm@chaingroup.dk', startDate: '2018-04-01' },
  ],
  'company-horsens': [
    { name: 'Camilla Broe', role: 'Direktoer', email: 'camilla.broe@horsens-tand.dk', startDate: '2023-09-15' },
    { name: 'Mikkel Vestergaard', role: 'Tandlaege', email: 'mikkel.v@horsens-tand.dk', startDate: '2023-10-01' },
    { name: 'Lena Gade', role: 'Receptionist', email: 'lena.gade@horsens-tand.dk', startDate: '2024-01-15' },
    { name: 'Philip Andersen', role: 'Bestyrelsesmedlem', email: 'philip@chaingroup.dk', startDate: '2023-09-15' },
  ],
  'company-viborg': [
    { name: 'Peter Holm', role: 'Direktoer', email: 'peter.holm@viborg-tand.dk', startDate: '2020-06-01' },
    { name: 'Anette Christoffersen', role: 'Klinikchef', email: 'anette.c@viborg-tand.dk', startDate: '2020-09-01' },
    { name: 'Jonas Kruse', role: 'Tandlaege', email: 'jonas.kruse@viborg-tand.dk', startDate: '2022-01-01' },
    { name: 'Helle Damgaard', role: 'Receptionist', email: 'helle.d@viborg-tand.dk', startDate: '2022-08-15' },
    { name: 'Maria Christensen', role: 'Bestyrelsesmedlem', email: 'maria@chaingroup.dk', startDate: '2020-06-01' },
  ],
  'company-aalborg': [
    { name: 'Lone Sørensen', role: 'Direktoer', email: 'lone.s@aalborg-tand.dk', startDate: '2017-03-01' },
    { name: 'Thomas Brandt', role: 'Klinikchef', email: 'thomas.brandt@aalborg-tand.dk', startDate: '2018-05-01' },
    { name: 'Rikke Magnusson', role: 'Tandlaege', email: 'rikke.m@aalborg-tand.dk', startDate: '2019-11-01' },
    { name: 'Jan Frost', role: 'Tandlaege', email: 'jan.frost@aalborg-tand.dk', startDate: '2021-03-15' },
    { name: 'Birgit Olesen', role: 'Receptionist', email: 'birgit.o@aalborg-tand.dk', startDate: '2020-01-02' },
    { name: 'Kristian Nørgaard', role: 'Bestyrelsesmedlem', email: 'kristian@chaingroup.dk', startDate: '2017-03-01' },
    { name: 'Grethe Hansen', role: 'Receptionist', email: 'grethe.h@aalborg-tand.dk', startDate: '2023-04-01' },
  ],
  'company-aarhus': [
    { name: 'Jens Thomsen', role: 'Direktoer', email: 'jens.thomsen@aarhus-tand.dk', startDate: '2016-08-01' },
    { name: 'Louise Bach', role: 'Klinikchef', email: 'louise.bach@aarhus-tand.dk', startDate: '2017-02-01' },
    { name: 'Anders Klint', role: 'Tandlaege', email: 'anders.klint@aarhus-tand.dk', startDate: '2018-09-01' },
    { name: 'Pernille Wahl', role: 'Tandlaege', email: 'pernille.wahl@aarhus-tand.dk', startDate: '2020-04-15' },
    { name: 'Mads Fog', role: 'Tandlaege', email: 'mads.fog@aarhus-tand.dk', startDate: '2022-01-01' },
    { name: 'Susanne Rix', role: 'Receptionist', email: 'susanne.rix@aarhus-tand.dk', startDate: '2019-06-01' },
    { name: 'Helena Stub', role: 'Receptionist', email: 'helena.stub@aarhus-tand.dk', startDate: '2023-09-01' },
    { name: 'Philip Andersen', role: 'Bestyrelsesmedlem', email: 'philip@chaingroup.dk', startDate: '2016-08-01' },
  ],
  'company-randers': [
    { name: 'Mads Overgaard', role: 'Direktoer', email: 'mads.overgaard@randers-tand.dk', startDate: '2019-01-15' },
    { name: 'Pia Thorsen', role: 'Tandlaege', email: 'pia.thorsen@randers-tand.dk', startDate: '2019-03-01' },
    { name: 'Christian Juul', role: 'Tandlaege', email: 'christian.juul@randers-tand.dk', startDate: '2021-08-01' },
    { name: 'Tina Kjær', role: 'Receptionist', email: 'tina.kjaer@randers-tand.dk', startDate: '2020-11-15' },
    { name: 'Maria Christensen', role: 'Bestyrelsesmedlem', email: 'maria@chaingroup.dk', startDate: '2019-01-15' },
  ],
  'company-silkeborg': [
    { name: 'Anne Kjær', role: 'Direktoer', email: 'anne.kjaer@silkeborg-tand.dk', startDate: '2020-03-01' },
    { name: 'Bo Sandberg', role: 'Tandlaege', email: 'bo.sandberg@silkeborg-tand.dk', startDate: '2020-06-01' },
    { name: 'Maja Lund', role: 'Receptionist', email: 'maja.lund@silkeborg-tand.dk', startDate: '2021-09-15' },
    { name: 'Thomas Nielsen', role: 'Bestyrelsesmedlem', email: 'thomas@chaingroup.dk', startDate: '2020-03-01' },
  ],
  'company-kolding': [
    { name: 'Søren Damgaard', role: 'Direktoer', email: 'soren.damgaard@kolding-tand.dk', startDate: '2018-11-01' },
    { name: 'Heidi Brøns', role: 'Klinikchef', email: 'heidi.brons@kolding-tand.dk', startDate: '2019-04-15' },
    { name: 'Niels Steffensen', role: 'Tandlaege', email: 'niels.steffensen@kolding-tand.dk', startDate: '2020-01-01' },
    { name: 'Kirsten Olsen', role: 'Receptionist', email: 'kirsten.olsen@kolding-tand.dk', startDate: '2021-03-01' },
    { name: 'Flemming Bay', role: 'Tandlaege', email: 'flemming.bay@kolding-tand.dk', startDate: '2022-08-01' },
    { name: 'Philip Andersen', role: 'Bestyrelsesmedlem', email: 'philip@chaingroup.dk', startDate: '2018-11-01' },
  ],
}

// Default personsæt baseret på partner-navn til alle øvrige selskaber
function makeDefaultPersons(partnerName: string, companySlug: string): MockPerson[] {
  return [
    { name: partnerName, role: 'Direktoer', email: `direktoer@${companySlug}.dk`, startDate: '2019-01-01' },
    { name: 'Sara Larsen', role: 'Bestyrelsesmedlem', email: 'sara@chaingroup.dk', startDate: '2019-01-01' },
    { name: 'Anna Pedersen', role: 'Receptionist', email: `kontakt@${companySlug}.dk`, startDate: '2020-06-01' },
  ]
}

// Komplet company → partner name mapping for default-set
const defaultPartners: Record<string, { partner: string; slug: string }> = {
  'company-vejle': { partner: 'Birgitte Hald', slug: 'vejle-tand' },
  'company-fredericia': { partner: 'Klaus Bundgaard', slug: 'fredericia-tand' },
  'company-esbjerg': { partner: 'Charlotte Lund', slug: 'esbjerg-tand' },
  'company-herning': { partner: 'Ole Vestergaard', slug: 'herning-tand' },
  'company-holstebro': { partner: 'Tina Michelsen', slug: 'holstebro-tand' },
  'company-roskilde': { partner: 'Henrik Dahl', slug: 'roskilde-tand' },
  'company-naestved': { partner: 'Susanne Poulsen', slug: 'naestved-tand' },
  'company-slagelse': { partner: 'Finn Madsen', slug: 'slagelse-tand' },
  'company-hilleroed': { partner: 'Marianne Krog', slug: 'hilleroed-tand' },
  'company-helsingoer': { partner: 'Torben Fabricius', slug: 'helsingoer-tand' },
  'company-koege': { partner: 'Dorte Simonsen', slug: 'koege-tand' },
  'company-svendborg': { partner: 'Niels Brylle', slug: 'svendborg-tand' },
  'company-nyborg': { partner: 'Inger Winther', slug: 'nyborg-tand' },
  'company-haderslev': { partner: 'Karsten Frandsen', slug: 'haderslev-tand' },
}

export function getPersonsByCompany(companyId: string): MockPerson[] {
  if (personsByCompany[companyId]) {
    return personsByCompany[companyId]
  }
  const defaults = defaultPartners[companyId]
  if (defaults) {
    return makeDefaultPersons(defaults.partner, defaults.slug)
  }
  return [
    { name: 'Ukendt direktoer', role: 'Direktoer', email: 'kontakt@klinik.dk', startDate: '2020-01-01' },
  ]
}

// Eksporter typen til brug andetsteds
export type { MockRole }
