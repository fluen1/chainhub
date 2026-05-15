/**
 * Phase N5 — Create-forms cleanup + CVR-validering + BModal width-fix
 *
 * Statiske tests for:
 * 1. BModal: style={{ width }} → style={{ maxWidth: width }} + w-full
 * 2. CreateCompanyForm: CVR client-side regex + cvrError state + disabled submit
 * 3. CreateUserForm: B-stil port (ingen rå Tailwind) + ROLE_HINTS map
 * 4. CreateContractForm: loadError state + beskrivende fejlbesked
 * 5. CreateContractForm: 0-selskaber empty-state med link
 * 6. CreateContractForm: getSensitivityLabel i hint (ikke rå enum)
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'

function read(relativePath: string): string {
  return fs.readFileSync(`${process.cwd()}/${relativePath}`, 'utf-8')
}

// ────────────────────────────────────────────────────────────────────────────
// Fix 1: BModal width — maxWidth i stedet for width inline-style
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 1: BModal width som maxWidth', () => {
  const src = read('src/components/ui/b/BModal.tsx')

  it('bruger maxWidth i stedet for width i inline-style', () => {
    expect(src).toContain('maxWidth: width')
    expect(src).not.toContain('style={{ width }}')
    expect(src).not.toContain('style={ { width }')
  })

  it('har w-full Tailwind-klasse på dialog-div', () => {
    expect(src).toContain('w-full')
  })

  it('har ikke sm:max-w-none (som overskrev max-w-[calc(100vw-16px)])', () => {
    expect(src).not.toContain('sm:max-w-none')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 2: CreateCompanyForm CVR client-side validering
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 2: CreateCompanyForm CVR validering', () => {
  const src = read('src/components/companies/CreateCompanyForm.tsx')

  it('har cvrError state', () => {
    expect(src).toContain('cvrError')
    expect(src).toContain('setCvrError')
  })

  it('validerer CVR med /^\\d{8}$/ regex', () => {
    expect(src).toContain('/^\\d{8}$/')
  })

  it('viser dansk fejlbesked ved forkert CVR', () => {
    expect(src).toContain('CVR skal være 8 cifre')
  })

  it('disabler submit hvis cvrError er sat', () => {
    expect(src).toContain('!!cvrError')
  })

  it('sender error-prop til BTextField for CVR', () => {
    // cvrError bruges som error-prop et sted i filen
    expect(src).toContain('error={cvrError}')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 3: CreateUserForm B-stil port + rolle-tooltip
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 3: CreateUserForm B-stil port', () => {
  const src = read('src/components/settings/CreateUserForm.tsx')

  it('importerer B-stil primitiver fra @/components/ui/b', () => {
    expect(src).toContain("from '@/components/ui/b'")
  })

  it('bruger BTextField til navn-felt', () => {
    expect(src).toContain('BTextField')
  })

  it('bruger BButton til submit', () => {
    expect(src).toContain('BButton')
  })

  it('bruger Panel som wrapper', () => {
    expect(src).toContain('Panel')
  })

  it('har ingen rå Tailwind rounded-md bg-blue-600 (gammelt design)', () => {
    expect(src).not.toContain('bg-blue-600')
    expect(src).not.toContain('rounded-md border border-gray-300')
  })

  it('har ROLE_HINTS map med alle 8 roller', () => {
    expect(src).toContain('ROLE_HINTS')
    expect(src).toContain('GROUP_OWNER:')
    expect(src).toContain('GROUP_ADMIN:')
    expect(src).toContain('GROUP_LEGAL:')
    expect(src).toContain('GROUP_FINANCE:')
    expect(src).toContain('GROUP_READONLY:')
    expect(src).toContain('COMPANY_MANAGER:')
    expect(src).toContain('COMPANY_LEGAL:')
    expect(src).toContain('COMPANY_READONLY:')
  })

  it('viser rolle-hint under dropdown ved valgt rolle', () => {
    // hint={role ? ROLE_HINTS[role] : undefined} eller tilsvarende
    expect(src).toContain('ROLE_HINTS[role]')
  })

  it('har dansk UI — ingen engelske labels som Name, Email, Password', () => {
    expect(src).not.toContain('>Name<')
    expect(src).not.toContain('>Email *<')
    expect(src).not.toContain('>Password<')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 4: CreateContractForm loadError i stedet for silent-catch
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 4: CreateContractForm loadError state', () => {
  const src = read('src/components/contracts/CreateContractForm.tsx')

  it('har loadError state', () => {
    expect(src).toContain('loadError')
    expect(src).toContain('setLoadError')
  })

  it('viser dansk fejlbesked ved fetch-fejl', () => {
    expect(src).toContain('Kunne ikke hente selskaber')
  })

  it('har ikke tom catch(() => {})', () => {
    expect(src).not.toContain('.catch(() => {})')
  })

  it('disabler submit hvis loadError er sat', () => {
    expect(src).toContain('!!loadError')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 5: CreateContractForm 0-selskaber empty-state
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 5: CreateContractForm 0-selskaber empty-state', () => {
  const src = read('src/components/contracts/CreateContractForm.tsx')

  it('viser empty-state tekst ved 0 selskaber', () => {
    expect(src).toContain('Du har ingen selskaber endnu')
  })

  it('linker til /companies/new i empty-state', () => {
    expect(src).toContain('/companies/new')
  })

  it('disabler submit ved 0 selskaber', () => {
    expect(src).toContain('companies.length === 0')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 6: CreateContractForm getSensitivityLabel i hint
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 6: CreateContractForm sensitivity-hint bruger getSensitivityLabel', () => {
  const src = read('src/components/contracts/CreateContractForm.tsx')

  it('importerer getSensitivityLabel fra @/lib/labels', () => {
    expect(src).toContain('getSensitivityLabel')
    expect(src).toContain("from '@/lib/labels'")
  })

  it('bruger getSensitivityLabel i hint — ikke rå enum-string', () => {
    // Kald-stedet i hint-prop
    expect(src).toContain('getSensitivityLabel(')
  })

  it('hint-tekst indeholder "fortrolighed" i stedet for rå "sensitivitet" i brugervendt tekst', () => {
    expect(src).toContain('fortrolighed')
  })

  it('hint nævner "strengeste fortrolighedsniveau" ved STRENGT_FORTROLIG', () => {
    expect(src).toContain('strengeste fortrolighedsniveau')
  })
})
