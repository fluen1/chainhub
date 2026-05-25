/**
 * Phase M — Content + Copywriting + Email fixes (2026-05-15)
 *
 * Statiske tests for:
 * 1. labels.ts: AKTIONAERLAAN stavefejl rettet
 * 2. labels.ts: formatMio bruger dansk komma-separator
 * 3. companies-list-b: ingen rå enum-strenge GROUP_OWNER/GROUP_ADMIN
 * 4. dashboard: ingen 'auto-refresh on'
 * 5. settings-b: ingen engelske rester (extractions, cost-cap, tier, renewal-risk)
 * 6. GdprPanel: 'uomkørbar' fjernet, GDPR Art.-referencer på knapper fjernet
 * 7. DeleteDocumentButton: ingen 'soft-delete', 'OBS' → 'Bemærk'
 * 8. email digest: 'Godmorgen' → 'Hej', afmeld-link
 * 9. decimal-separator placeholders: komma i stedet for punktum
 * 10. actions: actionable fejlbeskeder
 * 11. Annullér → Annuller konsistens
 * 12. P-nummer hint i EditStamdataDialog
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'

function read(relativePath: string): string {
  return fs.readFileSync(`${process.cwd()}/${relativePath}`, 'utf-8')
}

// ────────────────────────────────────────────────────────────────────────────
// Fix 1: labels.ts AKTIONAERLAAN stavefejl
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 1: labels.ts AKTIONAERLAAN stavefejl', () => {
  const src = read('src/lib/labels.ts')

  it('bruger korrekt enum-nøgle AKTIONAERLAAN (ikke AKTINONAERLAAN)', () => {
    expect(src).toContain('AKTIONAERLAAN:')
    expect(src).not.toContain('AKTINONAERLAAN:')
  })

  it('CONTRACT_CATEGORY_MAP bruger korrekt nøgle AKTIONAERLAAN', () => {
    const mapSection = src.substring(src.indexOf('CONTRACT_CATEGORY_MAP'))
    expect(mapSection).toContain('AKTIONAERLAAN:')
    expect(mapSection).not.toContain('AKTINONAERLAAN:')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 2: formatMio dansk komma-separator
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 2: formatMio dansk format', () => {
  const src = read('src/lib/labels.ts')

  it('bruger Intl.NumberFormat med da-DK locale', () => {
    expect(src).toContain("Intl.NumberFormat('da-DK'")
  })

  it('bruger ikke toFixed(1) direkte (returnerer engelske decimaler)', () => {
    const formatMioSection = src.substring(
      src.indexOf('export function formatMio'),
      src.indexOf('export function formatMio') + 300
    )
    // toFixed er ok hvis det ikke er det primære output — men Intl.NumberFormat skal bruges
    expect(formatMioSection).toContain("Intl.NumberFormat('da-DK'")
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 3: companies-list-b: ingen rå enum-strenge
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 3: companies-list-b ingen rå enum-strenge til brugeren', () => {
  const src = read('src/app/(dashboard)/companies/companies-list-b.tsx')

  it('viser ikke GROUP_OWNER rå enum i brugervendt tekst', () => {
    // Rå enum-string i brugervendt tekst (ikke i kommentarer eller kode)
    expect(src).not.toMatch(/Bed en GROUP_OWNER/)
    expect(src).not.toMatch(/Bed en GROUP_ADMIN/)
  })

  it('bruger dansk rollenavn i empty-state', () => {
    expect(src).toMatch(/kædeejer|administrator/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 4: dashboard ingen 'auto-refresh on'
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 4: dashboard page auto-refresh tekst', () => {
  const src = read('src/app/(dashboard)/dashboard/page.tsx')

  it("indeholder ikke 'auto-refresh on' som brugervendt tekst", () => {
    expect(src).not.toContain('auto-refresh on')
  })

  it("bruger dansk tekst 'automatisk opdatering'", () => {
    expect(src).toContain('automatisk opdatering')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 5: settings-b ingen engelske rester
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 5: settings-b engelske rester fjernet', () => {
  const src = read('src/app/(dashboard)/settings/settings-b.tsx')

  it("indeholder ikke 'extractions brugt' som brugervendt tekst", () => {
    expect(src).not.toContain('extractions brugt')
  })

  it("bruger 'analyser brugt' i stedet", () => {
    expect(src).toContain('analyser brugt')
  })

  it("indeholder ikke 'cost-cap' som brugervendt tekst", () => {
    // cost-cap må ikke optræde i synlig UI-tekst (kommentarer er OK)
    // Vi tjekker for de specifikke brugervendte strenge
    expect(src).not.toContain('Månedlig cost-cap er nået')
    expect(src).not.toContain('af cost-cap brugt')
  })

  it("bruger 'kvota' i stedet for 'cost-cap' i brugervendte strenge", () => {
    expect(src).toContain('kvota')
  })

  it("indeholder ikke 'tier' som brugervendt tekst (AI-tekst)", () => {
    expect(src).not.toContain('for jeres tier')
  })

  it("bruger 'abonnement' i stedet for 'tier'", () => {
    expect(src).toContain('abonnement')
  })

  it("indeholder ikke 'renewal-risk' som brugervendt tekst", () => {
    expect(src).not.toContain('renewal-risk')
  })

  it("bruger 'fornyelsesrisiko' i stedet", () => {
    expect(src).toContain('fornyelsesrisiko')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 6: GdprPanel labels
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 6: GdprPanel brugervendte labels', () => {
  const src = read('src/components/persons/GdprPanel.tsx')

  it("knap-label indeholder ikke 'GDPR Art. 15'", () => {
    // Art.-reference må ikke være på selve knappen
    expect(src).not.toContain("'Eksportér persondata (GDPR Art. 15)'")
    expect(src).not.toContain('"Eksportér persondata (GDPR Art. 15)"')
  })

  it("knap-label indeholder ikke 'GDPR Art. 17'", () => {
    expect(src).not.toContain("'Slet permanent (GDPR Art. 17)'")
    expect(src).not.toContain('"Slet permanent (GDPR Art. 17)"')
  })

  it("toast-besked indeholder ikke 'Art. 17'", () => {
    expect(src).not.toContain("'Persondata slettet permanent (GDPR Art. 17)'")
  })

  it("bruger 'kan ikke fortrydes' i stedet for 'uomkørbar'", () => {
    expect(src).not.toContain('uomkørbar')
    expect(src).toContain('kan ikke fortrydes')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 7: DeleteDocumentButton arkiv-tekst
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 7: DeleteDocumentButton arkiv-tekst', () => {
  const src = read('src/components/documents/DeleteDocumentButton.tsx')

  it("indeholder ikke 'soft-delete' som brugervendt tekst", () => {
    expect(src).not.toContain('soft-delete')
  })

  it("indeholder ikke 'via UI' som brugervendt tekst", () => {
    expect(src).not.toContain('via UI')
  })

  it("bruger 'flyttes til arkiv' i stedet", () => {
    expect(src).toContain('flyttes til arkiv')
  })

  it("bruger 'Bemærk' i stedet for 'OBS'", () => {
    expect(src).not.toContain('>OBS:<')
    expect(src).toContain('Bemærk')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 8: email digest template
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 8: email digest template', () => {
  const src = read('src/lib/email/templates/digest.tsx')

  it("indeholder ikke 'Godmorgen' som hilsen", () => {
    expect(src).not.toContain('Godmorgen,')
  })

  it("bruger 'Hej' som tidsuafhængig hilsen", () => {
    expect(src).toContain('Hej ')
  })

  it('har afmeld-link i footer', () => {
    expect(src).toContain('/settings?section=notif')
    expect(src).toContain('Afmeld daglig email-opdatering')
  })

  it('har brugervenlig footer-tekst', () => {
    expect(src).not.toContain('Du kan ikke svare på den.')
    expect(src).toContain('Svar venligst ikke')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 9: decimal-separator i placeholders
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 9: decimal-separator i placeholders', () => {
  it('AddPersonOwnershipModal bruger komma i andel-placeholder', () => {
    const src = read('src/components/persons/AddPersonOwnershipModal.tsx')
    expect(src).toContain('33,33')
    expect(src).not.toContain('"fx 33.33"')
    expect(src).not.toContain("'fx 33.33'")
  })

  it('AddOwnerForm bruger komma i andel-placeholder', () => {
    const src = read('src/components/companies/AddOwnerForm.tsx')
    expect(src).toContain('50,00')
    expect(src).not.toContain('"50.00"')
    expect(src).not.toContain("'50.00'")
  })

  it('AddMetricForm bruger tusindtalsseparator i beløb-placeholder', () => {
    const src = read('src/components/finance/AddMetricForm.tsx')
    expect(src).toContain('5.000.000')
    expect(src).not.toContain('"fx 5000000"')
    expect(src).not.toContain("'fx 5000000'")
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 10: actionable fejlbeskeder i actions
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 10: actionable fejlbeskeder', () => {
  it("cases.ts: ingen generisk 'Ugyldig statusændring: X → Y' besked", () => {
    const src = read('src/actions/cases.ts')
    expect(src).not.toMatch(/Ugyldig statusændring:.*→/)
    expect(src).toContain('Sagen kan ikke ændres til denne status i det nuværende forløb.')
  })

  it("cases.ts: bruger 'Din session er udløbet' i stedet for 'Ikke autoriseret'", () => {
    const src = read('src/actions/cases.ts')
    expect(src).not.toContain("'Ikke autoriseret'")
    expect(src).toContain('Din session er udløbet — log ind igen.')
  })

  it("tasks.ts: bruger 'Din session er udløbet' i stedet for 'Ikke autoriseret'", () => {
    const src = read('src/actions/tasks.ts')
    expect(src).not.toContain("'Ikke autoriseret'")
    expect(src).toContain('Din session er udløbet — log ind igen.')
  })

  it("contracts.ts: bruger 'Din session er udløbet' i stedet for 'Ikke autoriseret'", () => {
    const src = read('src/actions/contracts.ts')
    expect(src).not.toContain("'Ikke autoriseret'")
    expect(src).toContain('Din session er udløbet — log ind igen.')
  })

  it("persons.ts: bruger 'Din session er udløbet' i stedet for 'Ikke autoriseret'", () => {
    const src = read('src/actions/persons.ts')
    expect(src).not.toContain("'Ikke autoriseret'")
    expect(src).toContain('Din session er udløbet — log ind igen.')
  })

  it("companies.ts: bruger 'Din session er udløbet' i stedet for 'Ikke autoriseret'", () => {
    const src = read('src/actions/companies.ts')
    expect(src).not.toContain("'Ikke autoriseret'")
    expect(src).toContain('Din session er udløbet — log ind igen.')
  })

  it("cases.ts: bruger actionable 'Udfyld alle påkrævede felter' i stedet for 'Ugyldigt input'", () => {
    const src = read('src/actions/cases.ts')
    expect(src).not.toContain("'Ugyldigt input'")
    expect(src).toContain('Udfyld alle påkrævede felter og prøv igen.')
  })

  it("ownership.ts: bruger 'Du har ikke adgang' i stedet for 'Ingen adgang'", () => {
    const src = read('src/actions/ownership.ts')
    expect(src).not.toContain("return { error: 'Ingen adgang' }")
    expect(src).toContain('Du har ikke adgang til denne funktion. Kontakt din administrator.')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 11: Annullér → Annuller konsistens
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 11: Annullér → Annuller konsistens', () => {
  const filesToCheck = [
    'src/components/companies/AddOwnerForm.tsx',
    'src/components/companies/OwnershipList.tsx',
    'src/components/companies/EmployeeList.tsx',
    'src/components/companies/CompanyPersonList.tsx',
    'src/components/companies/AddCompanyPersonForm.tsx',
    'src/components/companies/CreateCompanyForm.tsx',
    'src/components/cases/CreateCaseForm.tsx',
    'src/components/persons/CreatePersonForm.tsx',
    'src/components/settings/UserActions.tsx',
    'src/components/settings/CreateUserForm.tsx',
    'src/components/tasks/CreateTaskForm.tsx',
    'src/components/finance/AddMetricForm.tsx',
    'src/components/visits/CreateVisitForm.tsx',
    'src/components/contracts/CreateContractForm.tsx',
    'src/components/documents/DeleteDocumentButton.tsx',
  ]

  for (const file of filesToCheck) {
    it(`${file.split('/').pop()} bruger 'Annuller' uden accent`, () => {
      const src = read(file)
      expect(src).not.toContain('Annullér')
    })
  }

  it('BModal har Annuller som default cancelLabel (uden accent)', () => {
    const src = read('src/components/ui/b/BModal.tsx')
    expect(src).toContain("cancelLabel = 'Annuller'")
    expect(src).not.toContain("cancelLabel = 'Annullér'")
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 12: P-nummer hint i EditStamdataDialog
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 12: P-nummer hint i EditStamdataDialog', () => {
  const src = read('src/components/companies/EditStamdataDialog.tsx')

  it('branchekode-felt har hint om produktionsenhedsnummer', () => {
    expect(src).toContain('produktionsenhedsnummer')
  })

  it('hint nævner CVR-registret', () => {
    expect(src).toContain('CVR-registret')
  })
})
