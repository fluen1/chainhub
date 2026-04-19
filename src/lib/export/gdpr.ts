import { prisma } from '@/lib/db'
import { captureError, createLogger } from '@/lib/logger'

const log = createLogger('gdpr')

// ============================================================
// Article 15 — Right of access (export)
// ============================================================

export interface GdprPersonExport {
  exportedAt: Date
  person: Record<string, unknown>
  companyPersons: Record<string, unknown>[]
  ownerships: Record<string, unknown>[]
  contractParties: Record<string, unknown>[]
  casePersons: Record<string, unknown>[]
  comments: Record<string, unknown>[]
  metadata: {
    note: string
  }
}

/**
 * GDPR Article 15: samler alle person-relaterede records i en struktureret
 * bundle. Returnerer null hvis person ikke findes (eller ikke i org).
 */
export async function gdprExportPerson(
  personId: string,
  organizationId: string
): Promise<GdprPersonExport | null> {
  const person = await prisma.person.findFirst({
    where: { id: personId, organization_id: organizationId },
  })
  if (!person) return null

  const [companyPersons, ownerships, contractParties, casePersons] = await Promise.all([
    prisma.companyPerson.findMany({ where: { person_id: personId } }),
    prisma.ownership.findMany({ where: { owner_person_id: personId } }),
    prisma.contractParty.findMany({ where: { person_id: personId } }),
    prisma.casePerson.findMany({ where: { person_id: personId } }),
  ])

  // Comments har FK til User (ikke Person) — vi logger dem IKKE i standard-export.
  // Hvis Person har en tilknyttet User (sjældent), kunne vi aggregere comments via user_id.

  return {
    exportedAt: new Date(),
    person: person as unknown as Record<string, unknown>,
    companyPersons: companyPersons as unknown as Record<string, unknown>[],
    ownerships: ownerships as unknown as Record<string, unknown>[],
    contractParties: contractParties as unknown as Record<string, unknown>[],
    casePersons: casePersons as unknown as Record<string, unknown>[],
    comments: [],
    metadata: {
      note: 'GDPR Article 15 — Right of Access. Denne eksport indeholder alle strukturerede data om den pågældende person i ChainHub. Bemærk at fri-tekst-notater i kommentarer (skrevet af andre brugere) ikke er inkluderet, da de er linket til forfatter-user, ikke person-entity.',
    },
  }
}

// ============================================================
// Article 17 — Right to erasure (pseudonymization)
// ============================================================

export interface GdprDeleteResult {
  deleted: boolean
  summary: {
    personUpdated: number
    companyPersonsEnded: number
    ownershipsEnded: number
    contractPartiesDeleted: number
    casePersonsDeleted: number
  }
}

const PSEUDONYMIZED_NAME = 'Slettet person'
const PSEUDONYMIZED_EMAIL = null

/**
 * GDPR Article 17: pseudonymiserer person og soft-sletter/hard-sletter relations.
 *
 * STRATEGI (valgt pga. audit-trail-krav i B2B):
 * - Person record: update med pseudonymiserede felter (first_name='Slettet person',
 *   last_name='', email=null, phone=null, notes=null, microsoft_contact_id=null)
 *   + sæt deleted_at=now().
 * - CompanyPerson + Ownership: update end_date=today() (soft-end — bevarer historik).
 * - ContractParty + CasePerson: hard-delete (join-tables uden soft-delete-felt; person er nu
 *   pseudonymiseret, så referencer bliver meningsløse).
 *
 * Kører alt i én transaction for atomicity.
 */
export async function gdprDeletePerson(
  personId: string,
  organizationId: string
): Promise<GdprDeleteResult> {
  const person = await prisma.person.findFirst({
    where: { id: personId, organization_id: organizationId },
  })
  if (!person) {
    return {
      deleted: false,
      summary: {
        personUpdated: 0,
        companyPersonsEnded: 0,
        ownershipsEnded: 0,
        contractPartiesDeleted: 0,
        casePersonsDeleted: 0,
      },
    }
  }

  const now = new Date()
  try {
    const summary = await prisma.$transaction(async (tx) => {
      await tx.person.update({
        where: { id: personId },
        data: {
          first_name: PSEUDONYMIZED_NAME,
          last_name: '',
          email: PSEUDONYMIZED_EMAIL,
          phone: null,
          notes: null,
          microsoft_contact_id: null,
          deleted_at: now,
        },
      })
      const cp = await tx.companyPerson.updateMany({
        where: { person_id: personId, end_date: null },
        data: { end_date: now },
      })
      const ow = await tx.ownership.updateMany({
        where: { owner_person_id: personId, end_date: null },
        data: { end_date: now },
      })
      const cpty = await tx.contractParty.deleteMany({ where: { person_id: personId } })
      const cpr = await tx.casePerson.deleteMany({ where: { person_id: personId } })
      return {
        personUpdated: 1,
        companyPersonsEnded: cp.count,
        ownershipsEnded: ow.count,
        contractPartiesDeleted: cpty.count,
        casePersonsDeleted: cpr.count,
      }
    })

    log.info({ personId, organizationId, summary }, 'GDPR-sletning gennemført')
    return { deleted: true, summary }
  } catch (err) {
    captureError(err, { namespace: 'gdpr:deletePerson', extra: { personId, organizationId } })
    throw err
  }
}
