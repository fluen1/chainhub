# Launch plan 2/4 — Public-lag (forside · pricing · kontakt)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg et offentligt marketing-lag i den eksisterende Next.js-app — ny `(public)` route-group med forside, pricing-side og kontaktformular — så uautoriserede besøgende kan se værditilbud, priser og booke demo, uden self-service signup.

**Architecture:** Ny `src/app/(public)/` route-group med egen header/footer-layout, der nester under det eksisterende minimale rod-layout. Rod-redirecten (`src/app/page.tsx` → `/login`) erstattes af forsiden. `proxy.ts` udvides så `/`, `/pricing` og `/kontakt` ikke kræver session. Kontaktformularen er en client-komponent der kalder en server action (`'use server'` + Zod + Resend) med honeypot-spamguard og mailto-fallback ved Resend-fejl. Priser ligger som ét data-modul (`src/lib/pricing.ts`) der unit-testes mod de låste spec-værdier — inkl. en test der håndhæver dental-eksklusionen.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), React server/client components, Tailwind (B-stil tokens `b-*`), Zod 4, Resend 6 (`replyTo`), Vitest + Testing Library, Playwright (e2e + axe-core).

**Spec:** `docs/superpowers/specs/2026-06-08-launch-readiness-design.md` (afsnit "1. Public-lag" + "4. Pricing-side + kontaktformular")
**Branch:** `feat/launch-readiness` (allerede aktiv; plan 1 landet — sidste commit `48058e8`)
**Forudgående plan:** 1/4 Gate 1 + dental-sanering (leveret 2026-06-08)
**Efterfølgende planer:** 3/4 legal-dokumenter + onboarding-docs · 4/4 deploy-forberedelse

---

## Genbrugte byggeklodser (verificeret i kodebasen 2026-06-08)

| Hvad                    | Hvor                                                                                        | Note                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `auth()`                | `@/lib/auth`                                                                                | server-side session, returnerer `null` hvis ikke logget ind                                                |
| `ActionResult<T>`       | `@/types/actions`                                                                           | `{ data: T } \| { error: string }`                                                                         |
| `BButton`               | `@/components/ui/b`                                                                         | props: `primary?`, `href?` (→ `<Link>`), ellers `onClick`/`type`/`disabled`. `className` merges.           |
| `BrandMark`             | `@/components/ui/b`                                                                         | SVG-logo                                                                                                   |
| `resend`, `DIGEST_FROM` | `@/lib/email/resend`                                                                        | `resend` er `null` hvis `RESEND_API_KEY` mangler; `DIGEST_FROM` default `'ChainHub <noreply@chainhub.dk>'` |
| Tailwind B-tokens       | `bg-b-canvas`, `text-b-1/2/3`, `border-b-border(-strong)`, `text-b-blue-fg/green-fg/red-fg` | se `tailwind.config.ts`                                                                                    |
| proxy public-liste      | `src/proxy.ts` `PUBLIC_PATHS` (linje 33)                                                    | `isPublicRoute` matcher `pathname === p \|\| startsWith(p + '/')`                                          |
| middleware-test-helpers | `src/__tests__/middleware.test.ts`                                                          | `runMiddleware(path, withAuth)` + `mockNext`/`mockRedirect`                                                |
| axe-sweep               | `tests/e2e/a11y.spec.ts`                                                                    | `PAGES`-array + `test.describe`-blok; bruger `loggedInPage`-fixture                                        |

**Konventioner (Rule 11):** Server actions følger `'use server'` → `safeParse` → `{ error: issues[0].message }` ved fejl → `{ data }` ved succes. Zod bruger `z.string().email('…')` (ikke `z.email()`), som resten af repoet. Resend v6 bruger `replyTo` (camelCase).

**Scope-afgrænsning:** Nav/footer linker KUN til sider der findes efter plan 2 (`/`, `/pricing`, `/kontakt`, `/login`). `Docs` og `legal/*` tilføjes til nav/footer i plan 3 — undgå 404-links i denne plan.

---

### Task 1: Public route-group + auth-bypass (infrastruktur)

Etablér `(public)`-gruppen med header/footer, erstat rod-redirecten, og gør de tre public routes session-frie. Forsiden er foreløbig en placeholder (rigtigt indhold i Task 2) så vi kan verificere routing + auth-bypass isoleret.

**Files:**

- Modify: `src/proxy.ts:33` (`PUBLIC_PATHS`)
- Modify: `src/__tests__/middleware.test.ts` (nye tests)
- Delete: `src/app/page.tsx` (rod-redirect — kolliderer ellers med `(public)/page.tsx` på `/`)
- Create: `src/app/(public)/layout.tsx`
- Create: `src/app/(public)/page.tsx` (placeholder)
- Create: `src/components/public/PublicHeader.tsx`
- Create: `src/components/public/PublicFooter.tsx`
- Create: `tests/e2e/public.spec.ts`

- [ ] **Step 1: Skriv fejlende middleware-tests** — tilføj denne `describe`-blok i bunden af `src/__tests__/middleware.test.ts`:

```ts
describe('middleware — public marketing-sider passerer uden auth', () => {
  beforeEach(() => {
    mockNext.mockClear()
    mockRedirect.mockClear()
  })

  it('allows / (forside) without auth', async () => {
    await runMiddleware('/', false)
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /pricing without auth', async () => {
    await runMiddleware('/pricing', false)
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /kontakt without auth', async () => {
    await runMiddleware('/kontakt', false)
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirecter STADIG /dashboard til login (/ må ikke gøre alt public)', async () => {
    await runMiddleware('/dashboard', false)
    expect(mockRedirect).toHaveBeenCalled()
    expect(mockNext).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Kør testen — verificér den fejler**

Run: `npx vitest run src/__tests__/middleware.test.ts`
Expected: De tre nye `allows`-tests FEJLER (redirect kaldes på `/`, `/pricing`, `/kontakt`), `/dashboard`-testen består.

- [ ] **Step 3: Tilføj de tre routes til `PUBLIC_PATHS`** i `src/proxy.ts` (linje 33). Erstat:

```ts
const PUBLIC_PATHS = ['/login', '/signup', '/invite', '/reset-password']
```

med:

```ts
// '/' matcher KUN eksakt (isPublicRoute bruger `pathname === p`), så øvrige routes
// forbliver beskyttede. /pricing og /kontakt matcher eksakt + evt. undersider.
const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/kontakt',
  '/login',
  '/signup',
  '/invite',
  '/reset-password',
]
```

- [ ] **Step 4: Kør middleware-testen — verificér grøn**

Run: `npx vitest run src/__tests__/middleware.test.ts`
Expected: Alle tests PASS (inkl. at `/dashboard` stadig redirecter).

- [ ] **Step 5: Slet rod-redirecten**

Run: `git -C C:\Users\birke\Projects\chainhub rm src/app/page.tsx`
Expected: Filen fjernes. (Den nye forside på `/` kommer fra `(public)/page.tsx`.)

- [ ] **Step 6: Opret `src/components/public/PublicHeader.tsx`**

```tsx
import Link from 'next/link'
import { BButton, BrandMark } from '@/components/ui/b'

export function PublicHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="border-b border-b-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-b-1 no-underline">
          <BrandMark />
          <span className="text-[15px] font-semibold">ChainHub</span>
        </Link>
        <nav className="flex items-center gap-4 text-[13px]">
          <Link href="/pricing" className="text-b-2 no-underline hover:text-b-1">
            Priser
          </Link>
          <Link href="/kontakt" className="text-b-2 no-underline hover:text-b-1">
            Kontakt
          </Link>
          {/* Docs-link tilføjes i plan 3 når /docs findes */}
          {loggedIn ? (
            <BButton primary href="/dashboard">
              Gå til dashboard
            </BButton>
          ) : (
            <BButton primary href="/login">
              Log ind
            </BButton>
          )}
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 7: Opret `src/components/public/PublicFooter.tsx`**

```tsx
import Link from 'next/link'

export function PublicFooter() {
  return (
    <footer className="border-t border-b-border bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-[12px] text-b-3 sm:flex-row">
        <span>© ChainHub</span>
        <nav className="flex gap-4">
          <Link href="/pricing" className="text-b-2 no-underline hover:text-b-1">
            Priser
          </Link>
          <Link href="/kontakt" className="text-b-2 no-underline hover:text-b-1">
            Kontakt
          </Link>
          <Link href="/login" className="text-b-2 no-underline hover:text-b-1">
            Log ind
          </Link>
          {/* Legal-links (vilkår, privatliv, cookies, DBA) tilføjes i plan 3 */}
        </nav>
      </div>
    </footer>
  )
}
```

- [ ] **Step 8: Opret `src/app/(public)/layout.tsx`** (async server component — henter session til header)

```tsx
import { auth } from '@/lib/auth'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <div className="flex min-h-screen flex-col bg-b-canvas">
      <PublicHeader loggedIn={!!session} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}
```

- [ ] **Step 9: Opret placeholder-forside `src/app/(public)/page.tsx`** (erstattes i Task 2)

```tsx
export default function ForsidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="text-[34px] font-semibold text-b-1">ChainHub</h1>
    </div>
  )
}
```

- [ ] **Step 10: Skriv e2e-smoke `tests/e2e/public.spec.ts`** (plain `page` — INGEN auth-fixture)

```ts
import { test, expect } from '@playwright/test'

test.describe('public-lag — tilgængeligt uden login', () => {
  test('forside loader på / uden redirect til login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('header har Log ind-knap når ikke logget ind', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Log ind' }).first()).toBeVisible()
  })
})
```

- [ ] **Step 11: Verificér build + e2e**

Run: `npx next build`
Expected: build GRØN, ingen "two parallel pages resolve to /"-fejl.

Run: `npx playwright test tests/e2e/public.spec.ts`
Expected: begge tests PASS.

- [ ] **Step 12: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add -A src/proxy.ts src/__tests__/middleware.test.ts src/app/ src/components/public/ tests/e2e/public.spec.ts
git -C C:\Users\birke\Projects\chainhub commit -m "feat(public): (public) route-group + auth-bypass for forside/pricing/kontakt"
```

---

### Task 2: Forside-indhold

Erstat placeholderen med rigtigt værditilbud. Server component der via `auth()` viser "Gå til dashboard" til indloggede uden at redirecte (jf. spec). ICP nævner kun optiker-, fysio-, læge- og franchisekæder — **aldrig** dental.

**Files:**

- Modify: `src/app/(public)/page.tsx`

- [ ] **Step 1: Skriv forsiden** — erstat hele `src/app/(public)/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { BButton } from '@/components/ui/b'

export const metadata: Metadata = {
  title: 'ChainHub — CRM og kontraktstyring for kæder',
  description:
    'Saml hele kædens selskaber, ejerskab, kontrakter og opgaver ét sted. Bygget til optiker-, fysio-, læge- og franchisekæder.',
}

const FEATURES = [
  {
    title: 'Hele koncernen ét sted',
    body: 'Selskaber, ejerskab og koncernstruktur samlet — fra holding til den enkelte butik.',
  },
  {
    title: 'Kontrakter under kontrol',
    body: 'Lejekontrakter, leverandøraftaler og fornyelser med automatiske påmindelser før deadline.',
  },
  {
    title: 'AI der læser for dig',
    body: 'Plus og Enterprise ekstraherer nøgledata fra kontrakter automatisk — mindre manuel indtastning.',
  },
]

export default async function ForsidePage() {
  const session = await auth()
  const loggedIn = !!session

  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-[34px] font-semibold leading-tight text-b-1">
          CRM og kontraktstyring bygget til kæder
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] text-b-2">
          ChainHub samler hele kædens selskaber, ejerskab, kontrakter og opgaver ét sted — til
          optiker-, fysio-, læge- og franchisekæder.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <BButton primary href="/kontakt" className="px-4 py-2 text-[14px]">
            Book demo
          </BButton>
          <BButton href="/pricing" className="px-4 py-2 text-[14px]">
            Se priser
          </BButton>
          {loggedIn && (
            <BButton href="/dashboard" className="px-4 py-2 text-[14px]">
              Gå til dashboard
            </BButton>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 px-4 pb-20 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-[6px] border border-b-border bg-white p-5">
            <h2 className="text-[15px] font-semibold text-b-1">{f.title}</h2>
            <p className="mt-2 text-[13px] text-b-2">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verificér build**

Run: `npx next build`
Expected: GRØN.

- [ ] **Step 3: Visuel smoke** (dev-server kører `npm run dev`): åbn `http://localhost:3000/` — H1 + to CTA'er ("Book demo", "Se priser") + tre feature-kort. Ingen "tandlæge"/"dental"-tekst.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/app/(public)/page.tsx
git -C C:\Users\birke\Projects\chainhub commit -m "feat(public): forside med vaerditilbud og demo-CTA"
```

---

### Task 3: Pricing — data-modul + side

Priser ligger i ét data-modul der unit-testes mod de låste spec-værdier. Pricing-siden renderer modullet. Testen håndhæver både de kommercielt låste priser (Rule 9: testen fanger hvis nogen ændrer en kontraktligt fastlåst pris) og dental-eksklusionen.

**Files:**

- Create: `src/lib/pricing.ts`
- Create: `src/__tests__/pricing.test.ts`
- Create: `src/app/(public)/pricing/page.tsx`

- [ ] **Step 1: Skriv fejlende test `src/__tests__/pricing.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { PRICING_TIERS, ONBOARDING_FEE } from '@/lib/pricing'

describe('PRICING_TIERS — låste kommercielle beslutninger (2026-06-07/08)', () => {
  const byId = (id: string) => PRICING_TIERS.find((t) => t.id === id)!

  it('har præcis tre tiers: basis, plus, enterprise', () => {
    expect(PRICING_TIERS.map((t) => t.id)).toEqual(['basis', 'plus', 'enterprise'])
  })

  it('Basis = 3.500 kr./md uden AI', () => {
    const basis = byId('basis')
    expect(basis.price).toBe('3.500 kr.')
    // Basis er kerne-CRM UDEN AI
    expect(JSON.stringify(basis).toLowerCase()).not.toContain('ai-ekstraktion')
  })

  it('Plus = 9.500 kr./md, 50 ekstraktioner inkl., 75 kr./ekstra', () => {
    const plus = byId('plus')
    expect(plus.price).toBe('9.500 kr.')
    expect(plus.priceNote).toContain('50')
    expect(plus.features.join(' ')).toContain('75 kr.')
  })

  it('Enterprise = forhandles, floor 32.000 kr./md, fair-use 500/md', () => {
    const ent = byId('enterprise')
    expect(ent.price.toLowerCase()).toContain('forhandles')
    expect(ent.priceNote).toContain('32.000')
    expect(ent.priceNote).toContain('500')
  })

  it('onboarding-fee = 1 kr./dokument, maks 2.500 kr.', () => {
    expect(ONBOARDING_FEE.perDocument).toBe(1)
    expect(ONBOARDING_FEE.cap).toBe(2500)
  })

  it('nævner ALDRIG dental/tandlæge (bindende dental-eksklusion)', () => {
    const blob = (JSON.stringify(PRICING_TIERS) + JSON.stringify(ONBOARDING_FEE)).toLowerCase()
    expect(blob).not.toContain('tandlæge')
    expect(blob).not.toContain('tandlaege')
    expect(blob).not.toContain('dental')
  })
})
```

- [ ] **Step 2: Kør testen — verificér den fejler**

Run: `npx vitest run src/__tests__/pricing.test.ts`
Expected: FAIL — `Cannot find module '@/lib/pricing'`.

- [ ] **Step 3: Skriv `src/lib/pricing.ts`**

```ts
export type PricingTier = {
  id: 'basis' | 'plus' | 'enterprise'
  name: string
  price: string
  priceNote: string
  tagline: string
  features: string[]
  cta: string
}

export const ONBOARDING_FEE = {
  perDocument: 1, // kr. pr. dokument ved initial import
  cap: 2500, // kr. — maks
  label: 'Onboarding (data-migrations-setup): 1 kr./dokument ved initial import, maks. 2.500 kr.',
} as const

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'basis',
    name: 'Basis',
    price: '3.500 kr.',
    priceNote: 'pr. måned',
    tagline: 'Kerne-CRM til kæden — uden AI.',
    features: [
      'Selskaber, ejerskab og koncernstruktur',
      'Kontrakter, sager og opgaver',
      'Brugere, roller og adgangsstyring',
      'Eksport og GDPR-værktøjer',
    ],
    cta: 'Book demo',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '9.500 kr.',
    priceNote: 'pr. måned · 50 AI-ekstraktioner inkl.',
    tagline: 'Alt i Basis + AI-ekstraktion og -indsigter.',
    features: [
      'Alt i Basis',
      'AI-ekstraktion af kontraktdata',
      'AI-indsigter og påmindelser',
      '50 ekstraktioner inkl., derefter 75 kr./ekstra',
    ],
    cta: 'Book demo',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Forhandles',
    priceNote: 'fra 32.000 kr./md · fair-use 500 ekstraktioner/md',
    tagline: 'Alt i Plus + portfolio-AI, RAG og SLA.',
    features: [
      'Alt i Plus',
      'Portfolio-AI på tværs af hele kæden',
      'RAG-baseret dokumentsøgning',
      'SLA og dedikeret onboarding',
    ],
    cta: 'Kontakt salg',
  },
]
```

- [ ] **Step 4: Kør testen — verificér grøn**

Run: `npx vitest run src/__tests__/pricing.test.ts`
Expected: Alle 6 tests PASS.

- [ ] **Step 5: Skriv `src/app/(public)/pricing/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { BButton } from '@/components/ui/b'
import { PRICING_TIERS, ONBOARDING_FEE } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Priser — ChainHub',
  description: 'Basis, Plus og Enterprise. Gennemsigtige priser for kæder.',
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-[28px] font-semibold text-b-1">Priser</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-[14px] text-b-2">
        Vælg den plan der passer kæden. Alle planer faktureres månedligt. Salg sker via demo — ingen
        self-service.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.id}
            className="flex flex-col rounded-[8px] border border-b-border bg-white p-6"
          >
            <h2 className="text-[18px] font-semibold text-b-1">{tier.name}</h2>
            <p className="mt-1 text-[13px] text-b-2">{tier.tagline}</p>
            <div className="mt-4">
              <span className="text-[24px] font-semibold text-b-1">{tier.price}</span>
              <span className="ml-1 text-[12px] text-b-3">{tier.priceNote}</span>
            </div>
            <ul className="mt-4 flex flex-1 flex-col gap-2 text-[13px] text-b-1">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-b-green-fg">
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <BButton primary href="/kontakt" className="w-full px-3 py-2 text-[13px]">
                {tier.cta}
              </BButton>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-[12px] text-b-3">{ONBOARDING_FEE.label}</p>
    </div>
  )
}
```

- [ ] **Step 6: Verificér build**

Run: `npx next build`
Expected: GRØN.

- [ ] **Step 7: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/lib/pricing.ts src/__tests__/pricing.test.ts "src/app/(public)/pricing/page.tsx"
git -C C:\Users\birke\Projects\chainhub commit -m "feat(public): pricing-side med laaste tiers + dental-eksklusion-test"
```

---

### Task 4: Kontakt-validering (Zod-schema)

Isoleret schema-modul, unit-testet — samme mønster som `src/lib/validations/*`.

**Files:**

- Create: `src/lib/validations/contact.ts`
- Create: `src/__tests__/contact-validation.test.ts`

- [ ] **Step 1: Skriv fejlende test `src/__tests__/contact-validation.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { contactSchema } from '@/lib/validations/contact'

const valid = {
  name: 'Test Tester',
  email: 'test@optikgruppen.dk',
  company: 'OptikGruppen',
  message: 'Vi vil gerne høre mere om Plus-planen til vores kæde.',
}

describe('contactSchema', () => {
  it('accepterer gyldigt input', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })

  it('company er valgfrit', () => {
    const { company: _omit, ...rest } = valid
    expect(contactSchema.safeParse(rest).success).toBe(true)
  })

  it('afviser ugyldig e-mail', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'ikke-en-email' }).success).toBe(false)
  })

  it('afviser for kort navn', () => {
    expect(contactSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false)
  })

  it('afviser for kort besked (< 10 tegn)', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'kort' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Kør testen — verificér den fejler**

Run: `npx vitest run src/__tests__/contact-validation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validations/contact'`.

- [ ] **Step 3: Skriv `src/lib/validations/contact.ts`**

```ts
import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().min(2, 'Angiv dit navn'),
  email: z.string().email('Ugyldig e-mail-adresse'),
  company: z.string().optional(),
  message: z.string().min(10, 'Skriv en kort besked (mindst 10 tegn)'),
})

export type ContactFormData = z.infer<typeof contactSchema>
```

- [ ] **Step 4: Kør testen — verificér grøn**

Run: `npx vitest run src/__tests__/contact-validation.test.ts`
Expected: Alle 5 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/lib/validations/contact.ts src/__tests__/contact-validation.test.ts
git -C C:\Users\birke\Projects\chainhub commit -m "feat(contact): zod-schema for kontaktformular"
```

---

### Task 5: `sendContactEmail` + env-var

Tilføj email-funktion til den eksisterende Resend-helper og registrér modtager-adressen i env-valideringen. Funktionen **kaster** hvis Resend ikke er konfigureret (modsat de andre helpers der bare warner) — så server-action'en i Task 6 kan degradere til mailto-fallback.

**Files:**

- Modify: `src/lib/email/resend.ts` (tilføj `CONTACT_TO` + `sendContactEmail`)
- Modify: `src/lib/env.ts` (tilføj `CONTACT_TO_EMAIL`)

- [ ] **Step 1: Tilføj til bunden af `src/lib/email/resend.ts`**

```ts
export const CONTACT_TO = process.env.CONTACT_TO_EMAIL ?? 'kontakt@chainhub.dk'

export async function sendContactEmail(input: {
  name: string
  email: string
  company?: string
  message: string
}): Promise<void> {
  if (!resend) {
    // Ingen Resend-konfiguration → kast, så server-action degraderer til mailto-fallback.
    throw new Error('RESEND_API_KEY ikke konfigureret')
  }

  const { name, email, company, message } = input
  const safeCompany = company?.trim() ? company : '—'

  // 1) Notifikation til ChainHub (svar går direkte til afsenderen via replyTo)
  await resend.emails.send({
    from: DIGEST_FROM,
    to: CONTACT_TO,
    replyTo: email,
    subject: `Ny demo-forespørgsel fra ${name}`,
    html: `
      <h2>Ny henvendelse via chainhub.dk</h2>
      <p><strong>Navn:</strong> ${name}</p>
      <p><strong>E-mail:</strong> ${email}</p>
      <p><strong>Virksomhed:</strong> ${safeCompany}</p>
      <p><strong>Besked:</strong></p>
      <p>${message.replace(/\n/g, '<br/>')}</p>
    `,
  })

  // 2) Kvittering til afsenderen
  await resend.emails.send({
    from: DIGEST_FROM,
    to: email,
    subject: 'Tak for din henvendelse — ChainHub',
    html: `
      <h2>Hej ${name},</h2>
      <p>Tak for din interesse i ChainHub. Vi har modtaget din besked og vender tilbage hurtigst muligt.</p>
      <p>Venlig hilsen,<br/>ChainHub</p>
    `,
  })
}
```

- [ ] **Step 2: Registrér `CONTACT_TO_EMAIL` i `src/lib/env.ts`** — tilføj linjen umiddelbart efter `RESEND_API_KEY`-feltet i Zod-objektet:

```ts
  CONTACT_TO_EMAIL: z.string().optional(),
```

(Optional — falder tilbage til `kontakt@chainhub.dk`. Tilføjes til `.env.production`-skabelonen i plan 4.)

- [ ] **Step 3: Verificér typecheck**

Run: `npx tsc --noEmit`
Expected: 0 fejl. (Bekræfter at `replyTo` er gyldig i resend v6's `CreateEmailOptions`.)

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/lib/email/resend.ts src/lib/env.ts
git -C C:\Users\birke\Projects\chainhub commit -m "feat(contact): sendContactEmail + CONTACT_TO_EMAIL env-var"
```

---

### Task 6: `submitContactForm` server action

Server action med honeypot-spamguard, Zod-validering og mailto-fallback ved Resend-fejl. Testet med mocket Resend-helper — happy path, Resend-fejl, honeypot og ugyldigt input.

**Files:**

- Create: `src/actions/contact.ts`
- Create: `src/__tests__/contact-action.test.ts`

- [ ] **Step 1: Skriv fejlende test `src/__tests__/contact-action.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/email/resend', () => ({
  sendContactEmail: vi.fn(),
}))

import { submitContactForm } from '@/actions/contact'
import { sendContactEmail } from '@/lib/email/resend'

const valid = {
  name: 'Test Tester',
  email: 'test@optikgruppen.dk',
  company: 'OptikGruppen',
  message: 'Vi vil gerne høre mere om Plus-planen.',
}

describe('submitContactForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: sender mail og returnerer { data: true }', async () => {
    vi.mocked(sendContactEmail).mockResolvedValueOnce(undefined)
    const res = await submitContactForm(valid)
    expect(res).toEqual({ data: true })
    expect(sendContactEmail).toHaveBeenCalledOnce()
  })

  it('Resend-fejl: returnerer handlingsanvisende fejl med mailto-adresse', async () => {
    vi.mocked(sendContactEmail).mockRejectedValueOnce(new Error('resend down'))
    const res = await submitContactForm(valid)
    expect('error' in res && res.error).toContain('kontakt@chainhub.dk')
  })

  it('honeypot udfyldt: silent success, ingen mail sendt (spam-guard)', async () => {
    const res = await submitContactForm({ ...valid, honeypot: 'http://spam.example' })
    expect(res).toEqual({ data: true })
    expect(sendContactEmail).not.toHaveBeenCalled()
  })

  it('ugyldig e-mail: valideringsfejl, ingen mail sendt', async () => {
    const res = await submitContactForm({ ...valid, email: 'ikke-en-email' })
    expect('error' in res).toBe(true)
    expect(sendContactEmail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Kør testen — verificér den fejler**

Run: `npx vitest run src/__tests__/contact-action.test.ts`
Expected: FAIL — `Cannot find module '@/actions/contact'`.

- [ ] **Step 3: Skriv `src/actions/contact.ts`**

```ts
'use server'

import { contactSchema, type ContactFormData } from '@/lib/validations/contact'
import { sendContactEmail } from '@/lib/email/resend'
import type { ActionResult } from '@/types/actions'

export type ContactSubmission = ContactFormData & { honeypot?: string }

export async function submitContactForm(input: ContactSubmission): Promise<ActionResult<true>> {
  // Spam-guard: honeypot-feltet er skjult for mennesker. Er det udfyldt, er afsenderen en bot.
  // Vi svarer "success" (så botten ikke kan probe), men sender ingen mail.
  if (input.honeypot && input.honeypot.trim() !== '') {
    return { data: true }
  }

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }
  }

  try {
    await sendContactEmail(parsed.data)
    return { data: true }
  } catch {
    return {
      error:
        'Vi kunne ikke sende din besked lige nu. Skriv venligst direkte til kontakt@chainhub.dk, så vender vi tilbage.',
    }
  }
}
```

- [ ] **Step 4: Kør testen — verificér grøn**

Run: `npx vitest run src/__tests__/contact-action.test.ts`
Expected: Alle 4 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/actions/contact.ts src/__tests__/contact-action.test.ts
git -C C:\Users\birke\Projects\chainhub commit -m "feat(contact): submitContactForm server action med honeypot + mailto-fallback"
```

---

### Task 7: Kontaktformular-komponent + side

Client-komponent der kalder server-action'en, med skjult honeypot-felt og mailto-fallback i fejl-state. Server-page wrapper med metadata.

**Files:**

- Create: `src/components/public/ContactForm.tsx`
- Create: `src/app/(public)/kontakt/page.tsx`

- [ ] **Step 1: Skriv `src/components/public/ContactForm.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { submitContactForm } from '@/actions/contact'
import { BButton } from '@/components/ui/b'

const fieldCls =
  'w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 outline-none focus:border-b-blue-fg'
const labelCls = 'mb-1 block text-[12px] font-medium text-b-1'

export function ContactForm() {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      company: String(data.get('company') ?? ''),
      message: String(data.get('message') ?? ''),
      honeypot: String(data.get('company_url') ?? ''),
    }
    startTransition(async () => {
      const res = await submitContactForm(payload)
      if ('data' in res) {
        setStatus('success')
        form.reset()
      } else {
        setStatus('error')
        setErrorMsg(res.error)
      }
    })
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-[4px] border border-b-green-fg/30 bg-b-green-fg/5 p-4 text-[13px] text-b-1"
      >
        Tak for din henvendelse — vi vender tilbage hurtigst muligt.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div>
        <label htmlFor="name" className={labelCls}>
          Navn
        </label>
        <input id="name" name="name" required className={fieldCls} />
      </div>
      <div>
        <label htmlFor="email" className={labelCls}>
          E-mail
        </label>
        <input id="email" name="email" type="email" required className={fieldCls} />
      </div>
      <div>
        <label htmlFor="company" className={labelCls}>
          Virksomhed (valgfrit)
        </label>
        <input id="company" name="company" className={fieldCls} />
      </div>
      <div>
        <label htmlFor="message" className={labelCls}>
          Besked
        </label>
        <textarea id="message" name="message" required rows={5} className={fieldCls} />
      </div>

      {/* Honeypot: skjult for mennesker, lokker bots. aria-hidden + off-screen + tabIndex=-1. */}
      <div aria-hidden="true" className="absolute left-[-9999px]" tabIndex={-1}>
        <label htmlFor="company_url">Lad dette felt stå tomt</label>
        <input id="company_url" name="company_url" tabIndex={-1} autoComplete="off" />
      </div>

      {status === 'error' && (
        <p role="alert" className="text-[13px] text-b-red-fg">
          {errorMsg}{' '}
          <a href="mailto:kontakt@chainhub.dk" className="underline">
            Send e-mail i stedet
          </a>
        </p>
      )}

      <div>
        <BButton type="submit" primary disabled={isPending} className="px-3 py-1.5 text-[13px]">
          {isPending ? 'Sender…' : 'Send forespørgsel'}
        </BButton>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Skriv `src/app/(public)/kontakt/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { ContactForm } from '@/components/public/ContactForm'

export const metadata: Metadata = {
  title: 'Kontakt — ChainHub',
  description: 'Book en demo af ChainHub, eller stil os et spørgsmål.',
}

export default function KontaktPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-[24px] font-semibold text-b-1">Book en demo</h1>
      <p className="mt-2 text-[14px] text-b-2">
        Fortæl os kort om jeres kæde, så vender vi tilbage med en demo. Du kan også skrive direkte
        til{' '}
        <a href="mailto:kontakt@chainhub.dk" className="text-b-blue-fg underline">
          kontakt@chainhub.dk
        </a>
        .
      </p>
      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: GRØN.

- [ ] **Step 4: Manuel smoke** (dev kører): `http://localhost:3000/kontakt` → udfyld og send. Med `RESEND_API_KEY` sat lokalt: success-besked. Uden key: rød fejl-besked med "Send e-mail i stedet"-mailto-link (degraderet fallback virker).

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/components/public/ContactForm.tsx "src/app/(public)/kontakt/page.tsx"
git -C C:\Users\birke\Projects\chainhub commit -m "feat(public): kontaktformular med honeypot + mailto-fallback"
```

---

### Task 8: a11y- + e2e-sweeps for public-lag

Tilføj de tre public routes til axe-sweepet (egen describe-blok uden auth) og udvid e2e-smoke med pricing/kontakt + kontaktformular-validering.

**Files:**

- Modify: `tests/e2e/a11y.spec.ts` (ny describe-blok)
- Modify: `tests/e2e/public.spec.ts` (flere tests)

- [ ] **Step 1: Tilføj public-axe-blok i `tests/e2e/a11y.spec.ts`** — indsæt efter den eksisterende `test.describe('a11y — axe-core scans', …)`-blok (bruger plain `page`, ikke `loggedInPage`, da siderne er offentlige):

```ts
const PUBLIC_PAGES = [
  { path: '/', label: 'Forside' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/kontakt', label: 'Kontakt' },
]

test.describe('a11y — public-lag (uden auth)', () => {
  for (const { path, label } of PUBLIC_PAGES) {
    test(`${label} har ingen critical/serious violations`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle', { timeout: 10_000 })

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const critical = results.violations.filter((v) => v.impact === 'critical')
      const serious = results.violations.filter((v) => v.impact === 'serious')
      expect(
        [...critical, ...serious].map((v) => `${v.id}: ${v.help}`),
        `a11y-violations på ${label}`
      ).toEqual([])
    })
  }
})
```

- [ ] **Step 2: Udvid `tests/e2e/public.spec.ts`** — tilføj disse tests i `describe`-blokken:

```ts
test('pricing viser de tre tiers med priser', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page.getByRole('heading', { name: 'Basis' })).toBeVisible()
  await expect(page.getByText('3.500 kr.')).toBeVisible()
  await expect(page.getByText('9.500 kr.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible()
})

test('kontaktformular viser valideringsfejl ved tom indsendelse', async ({ page }) => {
  await page.goto('/kontakt')
  await page.getByRole('button', { name: 'Send forespørgsel' }).click()
  // HTML5 required blokerer indsendelse — vi forbliver på /kontakt med synligt navnefelt
  await expect(page).toHaveURL(/\/kontakt$/)
  await expect(page.getByLabel('Navn')).toBeVisible()
})

test('pricing-CTA fører til kontakt', async ({ page }) => {
  await page.goto('/pricing')
  await page.getByRole('link', { name: 'Book demo' }).first().click()
  await expect(page).toHaveURL(/\/kontakt$/)
})
```

- [ ] **Step 3: Kør hele e2e + a11y mod public-lag**

Run: `npx playwright test tests/e2e/public.spec.ts tests/e2e/a11y.spec.ts`
Expected: Alle PASS. Fejler axe på en public side → fix kontrast/labels TDD-style (superpowers:systematic-debugging) og commit pr. fix.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add tests/e2e/a11y.spec.ts tests/e2e/public.spec.ts
git -C C:\Users\birke\Projects\chainhub commit -m "test(public): axe-sweep + e2e-smoke for forside/pricing/kontakt"
```

---

### Task 9: Fuld kvalitetsgate

Kør hele suiten samlet før status/handoff (spec: "Gate ved hvert checkpoint: format, lint, tsc, build, alle tests grønne").

- [ ] **Step 1: Format + lint**

Run: `npm run format; npm run lint`
Expected: 0 fejl. (Bekræft script-navne i `package.json` — er det fx `format:check`, brug den.)

- [ ] **Step 2: TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 fejl.

- [ ] **Step 3: Unit-tests (fuld suite — verificér ingen regression)**

Run: `npm test`
Expected: Tidligere baseline (1190) + nye tests (pricing 6 + contact-validation 5 + contact-action 4 + middleware 4) alle grønne, 0 failed.

- [ ] **Step 4: Build**

Run: `npx next build`
Expected: GRØN.

- [ ] **Step 5: Fuld e2e-suite mod reseedet DB**

Run: `npx playwright test`
Expected: Alle specs grønne (inkl. nye public-specs).

- [ ] **Step 6: Fejler noget → fix før videre.** Brug superpowers:systematic-debugging pr. fejl; commit pr. fix med `fix(public): …`.

---

### Task 10: Status-opdatering + handoff

**Files:**

- Modify: `docs/status/PROGRESS.md`

- [ ] **Step 1: Opdatér `docs/status/PROGRESS.md`** — ny sektion "Launch-readiness plan 2 (2026-06-08)": `(public)` route-group etableret; forside erstatter rod-redirect; pricing med låste tiers; kontaktformular (Zod + Resend + honeypot + mailto-fallback); proxy-bypass for `/`, `/pricing`, `/kontakt`; axe + e2e grønne.

- [ ] **Step 2: Trello** — på CopenAI-boardet: flyt pricing-side-kortet + kontaktformular-kortet (under Chainhub/Tilbudsgenerator-sporet) til Done; kommentar med commit-range. Hvis kort mangler, opret dem i Done med kort beskrivelse. (Følg `~/.claude/knowledge/workflows/trello-projektstyring.md`.)

- [ ] **Step 3: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add docs/status/PROGRESS.md
git -C C:\Users\birke\Projects\chainhub commit -m "docs: PROGRESS opdateret efter launch-readiness plan 2"
```

- [ ] **Step 4: Handoff** — meld tilbage til Philip: plan 2 leveret, commit-range, evt. åbne punkter (fx Docs/legal-links der først aktiveres i plan 3). **Ingen PR til master endnu** — CopenAI-regel: PR afstemmes med Rico, og plan 3+4 ligger på samme branch. PR rejses i plan 4.

---

## Self-review mod spec

- **Public route-group `(public)`** med forside/pricing/kontakt → Task 1-3, 7 ✓
- **proxy.ts: public routes uden session** → Task 1 (TDD med middleware-test) ✓
- **Authed bruger på `/` redirectes ikke — "Gå til dashboard"** → Task 2 (`auth()` i server component) ✓
- **Samme Tailwind-design-system, public header/footer (nav: Pricing, Kontakt, Log ind)** → Task 1; Docs/legal bevidst udskudt til plan 3 (undgår 404) ✓
- **Pricing: låste priser + onboarding-fee, feature-matrix, CTA "Book demo"** → Task 3 (data-modul + test der håndhæver de låste værdier) ✓
- **Kontakt: server action, Zod, Resend til Philip + kvittering, mailto-fallback, honeypot** → Task 4-7 ✓
- **Dental-eksklusion i alt kundevendt materiale** → Task 2 (ICP-tekst) + Task 3 (test der fejler ved "tandlæge"/"dental") ✓
- **Test: unit (rendering/form-validering) + axe + e2e-smoke + kontakt happy/Resend-fejl/honeypot** → Task 3,4,6 (unit/logik), Task 8 (axe + e2e). Bemærkning: side-"rendering" verificeres via e2e frem for RTL, da siderne er async server components — repoet har ikke RTL-render-tests for server components (Rule 11), og e2e dækker faktisk rendering bedre. ✓
- **Public-sider ingen DB-afhængighed** → statiske/auth-only; ingen Prisma-kald ✓
- **Gate ved checkpoint (format/lint/tsc/build/tests)** → Task 9 ✓
- **Uden for scope: signup/Stripe, S/L-split** → ikke berørt; CTA er demo-booking ✓
- **No-placeholder-scan:** alle kode-steps har komplet kode; ingen TBD/TODO. ✓
- **Type-konsistens:** `ContactFormData` (validations) → `ContactSubmission = ContactFormData & { honeypot? }` (action); `sendContactEmail`-signatur matcher `parsed.data`-form; `ActionResult<true>` ensartet. ✓
