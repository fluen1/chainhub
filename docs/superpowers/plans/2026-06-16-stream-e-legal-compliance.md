# Stream E — Legal/Compliance-kode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementér de tre GDPR/legal-compliance-krav der mangler inden første betalende kunde: (a) spor accept af vilkår + DBA pr. organisation med tidsstempel (GDPR art. 28-bevis), (b) giv brugeren mulighed for at tilbagetrække cookie-samtykke inde fra app'en (GDPR art. 7 stk. 3), og (c) eksponér CVR/adresse korrekt på legal-siderne via en env-var med graceful fallback der sikrer at placeholder-teksten ALDRIG vises offentligt.

**Architecture:** Ny Prisma-migration ovenpå Stream A's `0_init` baseline. Accept-tidsstempler på `Organization`-modellen — den logiske ejer (en org accepterer ét sæt vilkår/DBA). Cookie-tilbagetrækning sker i settings-sektionen "sikkerhed" (eksisterer allerede som "coming soon"-panel), eksponeret som `CookieWithdrawPanel` med `role="alert"`. CVR-env `CHAINHUB_CVR` læses via `src/lib/env.ts`; legal-siderne henter fra env og viser intet (eller en admin-only placeholder) hvis ikke sat.

**Tech Stack:** Prisma 6 (`migrate dev`), Next.js 16 Server Actions, Zod, React `useTransition`, Vitest.

**Forudsætning:** Stream A er kørt og grøn — `prisma/migrations/0_init/migration.sql` eksisterer, dev-DB er reseed'et, `npm run lint` og `npm run build` er grønne.

---

## Vigtigt før start

- **Afhængigheds-rækkefølge:** Task 1 (schema + migration) skal køres FØRST — alle efterfølgende tasks forudsætter at Prisma-client er regenereret.
- **Commit-stil:** `[type]: beskrivelse på dansk`. Én commit pr. task.
- **Philip-afhængighed:** CVR-værdien (`CHAINHUB_CVR`) sættes IKKE af koden — den sættes manuelt i Vercel-env efter CVR-registrering. Koden er designet til at tie stille indtil da.
- **Ingen prod-DB-impact:** Migrationen er additive (kun nye kolonner med default NULL) og er backward-compatible.

---

## Task 1: Schema — tilføj `terms_accepted_at` og `dpa_accepted_at` + kør migration

**Files:**

- Modify: `prisma/schema.prisma` (Organization-model, linje 298–337)
- Create: `prisma/migrations/<timestamp>_add_acceptance_tracking/migration.sql` (auto-genereret)

**Hvad og hvorfor:** GDPR art. 28 kræver dokumenterbart bevis for at databehandleraftalen er accepteret. Vi tilføjer to nullable DateTime-felter direkte på `Organization` (ét pr. juridisk dokument). Nullable = ikke-retroaktivt-breaking; eksisterende orgs sættes til NULL og opfordres til at acceptere ved næste login (fremtidigt UX-scope — udenfor denne stream).

- [ ] **Step 1: Tilføj felter til Organization-modellen**

Find linjerne i `prisma/schema.prisma` der beskriver `Organization`:

```prisma
model Organization {
  id              String    @id @default(uuid())
  name            String
  cvr             String?
  plan            String    @default("trial")
  plan_expires_at DateTime?
  chain_structure      Boolean   @default(false)
  industry             String?
  estimated_locations  String?
  created_at           DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  created_by      String?
```

Tilføj de to nye felter efter `created_by`:

```prisma
  terms_accepted_at    DateTime?
  dpa_accepted_at      DateTime?
```

Fuld Organisation-model-header ser nu således ud (kun tilføjede linjer vist med `+`):

```diff
   created_by      String?
+  terms_accepted_at    DateTime?
+  dpa_accepted_at      DateTime?

   users                 User[]
```

- [ ] **Step 2: Generér og kør migrationen**

```bash
npx prisma migrate dev --name add_acceptance_tracking
```

Expected output: `Applying migration '..._add_acceptance_tracking'` → `Your database is now in sync with your schema.`

- [ ] **Step 3: Verificér migrationsfilens SQL**

```bash
# Find det auto-genererede migrations-mappenavn (det starter med dato-timestamp):
ls prisma/migrations/
# Læs SQL:
cat prisma/migrations/*add_acceptance_tracking*/migration.sql
```

Expected: SQL indeholder mindst:

```sql
ALTER TABLE "Organization" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "dpa_accepted_at" TIMESTAMP(3);
```

Ingen DROP, ingen CASCADE, ingen breaking ændringer.

- [ ] **Step 4: Regenerér Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` uden fejl.

- [ ] **Step 5: TypeScript-check — Prisma-typen er opdateret**

```bash
npx tsc --noEmit
```

Expected: 0 fejl.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): tilføj terms_accepted_at + dpa_accepted_at på Organization"
```

---

## Task 2: Signup-flow — obligatorisk accept-checkbox (GDPR art. 28-bevis)

**Files:**

- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/actions/signup.ts`
- Modify: `src/lib/validations/` — NOPE: signup bruger inline Zod-skema i `signup.ts`; udvid det der.

**Hvad og hvorfor:** Step 1-signup (`/signup`) opretter konto + org. Det er det rigtige sted for accept-checkbox, fordi det er her org oprettes i `createAccount`-transaktionen. Accept-tidsstempler persisteres på org ved oprettelse. Der er ingen separat "terms accepted" flow i Step 2 (`/signup/organization`) — den er kun til onboarding-info.

**Signup-flowet i dag:**

- `src/app/(auth)/signup/page.tsx` — klient-form med `name`, `email`, `password`
- `src/actions/signup.ts` → `createAccount()` → transaktion: opret org + user + rolle
- Ingen accept-checkbox i dag

### TDD

- [ ] **Step 1: Skriv failing tests FØRST**

Opret `src/__tests__/actions/signup-acceptance.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAccount } from '@/actions/signup'

// Prisma-mock
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed') } }))

import { prisma } from '@/lib/db'
import { vi as viAlias } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createAccount — accept-sporing', () => {
  it('afviser signup uden termsAccepted=true', async () => {
    const result = await createAccount({
      name: 'Test Bruger',
      email: 'test@example.com',
      password: 'password123',
      termsAccepted: false,
    })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/vilkår/i)
    }
  })

  it('afviser signup uden dpaAccepted=true', async () => {
    const result = await createAccount({
      name: 'Test Bruger',
      email: 'test@example.com',
      password: 'password123',
      termsAccepted: true,
      dpaAccepted: false,
    })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/databehandler/i)
    }
  })

  it('persisterer terms_accepted_at og dpa_accepted_at ved gyldig signup', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const now = new Date('2026-06-16T10:00:00.000Z')
    vi.setSystemTime(now)

    const orgCreateSpy = vi.fn().mockResolvedValue({ id: 'org-1' })
    const userCreateSpy = vi.fn().mockResolvedValue({ id: 'user-1' })
    const roleCreateSpy = vi.fn().mockResolvedValue({})

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return fn({
        organization: { create: orgCreateSpy },
        user: { create: userCreateSpy },
        userRoleAssignment: { create: roleCreateSpy },
      } as unknown as Parameters<typeof fn>[0])
    })

    await createAccount({
      name: 'Test Bruger',
      email: 'test@example.com',
      password: 'password123',
      termsAccepted: true,
      dpaAccepted: true,
    })

    expect(orgCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          terms_accepted_at: now,
          dpa_accepted_at: now,
        }),
      })
    )
    vi.useRealTimers()
  })
})
```

Kør: `npx vitest run src/__tests__/actions/signup-acceptance.test.ts`

Expected: **3 FAIL** (felterne `termsAccepted`/`dpaAccepted` eksisterer ikke i `createAccountSchema` endnu).

### Implementation

- [ ] **Step 2: Udvid `createAccountSchema` i `src/actions/signup.ts`**

Find:

```typescript
const createAccountSchema = z.object({
  name: z.string().min(2, 'Navn skal være mindst 2 tegn'),
  email: z.string().email('Ugyldig e-mailadresse'),
  password: z.string().min(8, 'Adgangskoden skal være mindst 8 tegn'),
})
```

Erstat med:

```typescript
const createAccountSchema = z.object({
  name: z.string().min(2, 'Navn skal være mindst 2 tegn'),
  email: z.string().email('Ugyldig e-mailadresse'),
  password: z.string().min(8, 'Adgangskoden skal være mindst 8 tegn'),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Du skal acceptere servicevilkårene for at fortsætte' }),
  }),
  dpaAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Du skal acceptere databehandleraftalen for at fortsætte' }),
  }),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
```

- [ ] **Step 3: Persistér tidsstempler i `createAccount`-transaktionen**

Find `tx.organization.create`-kaldet (linje ~68):

```typescript
const org = await tx.organization.create({
  data: {
    name: orgName,
    plan: 'trial',
    plan_expires_at: planExpiresAt,
  },
})
```

Erstat med:

```typescript
const acceptedAt = new Date()

const org = await tx.organization.create({
  data: {
    name: orgName,
    plan: 'trial',
    plan_expires_at: planExpiresAt,
    terms_accepted_at: acceptedAt,
    dpa_accepted_at: acceptedAt,
  },
})
```

- [ ] **Step 4: Tilføj accept-checkboxe til `src/app/(auth)/signup/page.tsx`**

Find `useState`-blokken øverst i `SignupPage` (linje ~18) og tilføj to nye state-variabler:

```typescript
const [termsAccepted, setTermsAccepted] = useState(false)
const [dpaAccepted, setDpaAccepted] = useState(false)
```

Find `createAccount`-kaldet i `handleSubmit` (linje ~37) og tilføj de nye felter:

```typescript
const result = await createAccount({
  name: name.trim(),
  email: email.trim(),
  password,
  termsAccepted: termsAccepted as true,
  dpaAccepted: dpaAccepted as true,
})
```

Find `canSubmit`-udtrykket (linje ~63) og udvid det:

```typescript
const canSubmit =
  name.trim().length >= 2 &&
  email.trim().length > 0 &&
  password.length >= 8 &&
  termsAccepted &&
  dpaAccepted &&
  !loading
```

Tilføj accept-checkboxe i JSX **efter** adgangskode-feltet og **før** submit-knappen — indsæt dette blok:

```tsx
{
  /* Accept-checkboxe — obligatoriske (GDPR art. 28 + servicevilkår) */
}
;<div className="flex flex-col gap-2 rounded-[4px] border border-b-border bg-b-panel-h px-3 py-2.5">
  <label className="flex cursor-pointer items-start gap-2">
    <input
      type="checkbox"
      checked={termsAccepted}
      onChange={(e) => setTermsAccepted(e.target.checked)}
      disabled={loading}
      className="mt-0.5 shrink-0 accent-b-blue-fg"
      aria-required="true"
    />
    <span className="text-[12px] text-b-2">
      Jeg accepterer{' '}
      <a
        href="/legal/vilkaar"
        target="_blank"
        rel="noopener noreferrer"
        className="text-b-blue-fg underline hover:no-underline"
      >
        servicevilkårene
      </a>{' '}
      (påkrævet)
    </span>
  </label>

  <label className="flex cursor-pointer items-start gap-2">
    <input
      type="checkbox"
      checked={dpaAccepted}
      onChange={(e) => setDpaAccepted(e.target.checked)}
      disabled={loading}
      className="mt-0.5 shrink-0 accent-b-blue-fg"
      aria-required="true"
    />
    <span className="text-[12px] text-b-2">
      Jeg accepterer{' '}
      <a
        href="/legal/databehandleraftale"
        target="_blank"
        rel="noopener noreferrer"
        className="text-b-blue-fg underline hover:no-underline"
      >
        databehandleraftalen
      </a>{' '}
      (påkrævet — GDPR art. 28)
    </span>
  </label>
</div>
```

- [ ] **Step 5: Kør tests — forvent GREEN**

```bash
npx vitest run src/__tests__/actions/signup-acceptance.test.ts
```

Expected: **3 PASS**.

- [ ] **Step 6: TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 fejl.

- [ ] **Step 7: Commit**

```bash
git add src/actions/signup.ts src/app/\(auth\)/signup/page.tsx src/__tests__/actions/signup-acceptance.test.ts
git commit -m "feat(legal): accept-checkboxe ved signup — terms_accepted_at + dpa_accepted_at persisteres (GDPR art. 28)"
```

---

## Task 3: CVR/adresse-eksponering på legal-sider via env-var

**Files:**

- Modify: `src/lib/env.ts`
- Modify: `src/app/(public)/legal/privatliv/page.tsx` (linje 32–34)
- Modify: `src/app/(public)/legal/vilkaar/page.tsx` (CVR-reference hvis den eksisterer)
- Modify: `src/app/(public)/legal/databehandleraftale/page.tsx` (CVR-reference hvis den eksisterer)

**Hvad og hvorfor:** Privatlivspolitikken viser i dag `CVR: [indsættes ved registrering]` som statisk tekst — den er tilgængelig for alle (ingen auth). Det er ikke acceptabelt at vise en placeholder på en offentlig side. Løsningen: env-var `CHAINHUB_CVR` + `CHAINHUB_ADDRESS`. Hvis de er sat: vis dem. Hvis de IKKE er sat: vis sektionen slet ikke (eller vis den med `<!-- hidden til CVR klar -->` i source; i DOM er `<p>` simpelthen fraværende). Philip sætter værdierne i Vercel-env efter CVR-registrering.

**Kritisk beslutning — to optioner:**

**Option A (anbefalet): Skjul hele dataansvarlig-boksen hvis CVR mangler**

Fordel: ingen placeholder overhovedet vises offentligt.
Ulempe: siden er teknisk ufuldstændig indtil Philip sætter env.

```tsx
// I privatliv/page.tsx — øverst i TermsPage (server component, kan læse env direkte)
import { env } from '@/lib/env'

const cvr = env.CHAINHUB_CVR // undefined if not set
const address = env.CHAINHUB_ADDRESS // undefined if not set

// I JSX, § 1 LegalContactBox:
{
  cvr ? (
    <LegalContactBox>
      <p className="font-semibold text-b-1">ChainHub</p>
      <p>CVR: {cvr}</p>
      {address && <p>{address}</p>}
      <p>Danmark</p>
      <p className="mt-1">
        E-mail: <LegalMailLink address="kontakt@chainhub.dk" />
      </p>
    </LegalContactBox>
  ) : (
    // Vis minimumsinfo indtil CVR er registreret (Philip-afhængighed)
    <LegalContactBox>
      <p className="font-semibold text-b-1">ChainHub</p>
      <p>Danmark</p>
      <p className="mt-1">
        E-mail: <LegalMailLink address="kontakt@chainhub.dk" />
      </p>
      {/* CVR og adresse tilføjes efter virksomhedsregistrering */}
    </LegalContactBox>
  )
}
```

**Option B: Admin-only TODO-kommentar i HTML source (ikke i render-output)**

Viser ikke placeholder, men efterlader en HTML-kommentar til admins. Valg mellem A og B overlades til Philip — men koden implementerer Option A som default.

### Implementation

- [ ] **Step 1: Tilføj `CHAINHUB_CVR` og `CHAINHUB_ADDRESS` til `src/lib/env.ts`**

Find `envSchema`-definitionen. Tilføj efter `GOOGLE_CLIENT_SECRET`:

```typescript
  CHAINHUB_CVR: z.string().regex(/^\d{8}$/, 'CHAINHUB_CVR skal være 8 cifre').optional(),
  CHAINHUB_ADDRESS: z.string().optional(),
```

`CHAINHUB_CVR` er optional (tom = ikke-registreret endnu). Regex sikrer at værdien er præcis 8 cifre (dansk CVR-format) — beskytter mod typos. Ikke-required i prod, da virksomheden kan godt deploye inden CVR er klar.

- [ ] **Step 2: Ret `src/app/(public)/legal/privatliv/page.tsx`**

Filen er et Server Component — kan importere `env` direkte.

Tilføj øverst i filen, efter `import`-blokken:

```typescript
import { env } from '@/lib/env'
```

Find den nuværende `LegalContactBox`-blok i § 1 (linje 30–37):

```tsx
<LegalContactBox>
  <p className="font-semibold text-b-1">ChainHub</p>
  <p>CVR: [indsættes ved registrering]</p>
  <p>Danmark</p>
  <p className="mt-1">
    E-mail: <LegalMailLink address="kontakt@chainhub.dk" />
  </p>
</LegalContactBox>
```

Erstat med:

```tsx
<LegalContactBox>
  <p className="font-semibold text-b-1">ChainHub</p>
  {env.CHAINHUB_CVR && <p>CVR: {env.CHAINHUB_CVR}</p>}
  {env.CHAINHUB_ADDRESS && <p>{env.CHAINHUB_ADDRESS}</p>}
  <p>Danmark</p>
  <p className="mt-1">
    E-mail: <LegalMailLink address="kontakt@chainhub.dk" />
  </p>
</LegalContactBox>
```

- [ ] **Step 3: Tjek om vilkaar/page.tsx og databehandleraftale/page.tsx har CVR-referencer**

```bash
grep -n "CVR\|indsættes" "src/app/(public)/legal/vilkaar/page.tsx" "src/app/(public)/legal/databehandleraftale/page.tsx"
```

Vilkår og DPA-siderne refererer ikke direkte til CVR i de læste uddrag — men bekræft med grep. Hvis der er placeholder-CVR-tekst: anvend samme mønster som Step 2.

- [ ] **Step 4: TypeScript + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: 0 fejl. Legal-siden bygger grønt.

- [ ] **Step 5: Manuel spot-verifikation (dev-server)**

Start dev-server og åbn `http://localhost:3000/legal/privatliv` i browser. Bekræft at CVR-linjen IKKE vises (env-var er ikke sat i `.env.local`). Sæt `CHAINHUB_CVR=12345678` i `.env.local`, reload serveren, bekræft at `CVR: 12345678` nu vises.

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts "src/app/(public)/legal/privatliv/page.tsx"
# Tilføj vilkaar + DPA hvis de blev rettet:
# git add "src/app/(public)/legal/vilkaar/page.tsx" "src/app/(public)/legal/databehandleraftale/page.tsx"
git commit -m "feat(legal): CVR/adresse via CHAINHUB_CVR env-var — vises kun når sat (ingen placeholder i prod)"
```

---

## Task 4: In-app cookie-tilbagetrækning — `CookieWithdrawPanel` + `role=alert`

**Files:**

- Create: `src/components/settings/CookieWithdrawPanel.tsx`
- Modify: `src/app/(dashboard)/settings/settings-b.tsx` (tilføj panel til "sikkerhed"-sektionen)
- Create: `src/__tests__/components/settings/CookieWithdrawPanel.test.tsx`

**Hvad og hvorfor:** GDPR art. 7 stk. 3 kræver at samtykke kan trækkes tilbage "til enhver tid" og "lige så let som det gives". Cookie-banneret (`CookieConsent.tsx`) vises kun ved første besøg. Hvis bruger er logget ind og aldrig ser banneret igen, er der ingen in-app måde at tilbagetrække på. Løsningen: et panel i Settings → Sikkerhed med current consent-status + knap til at ændre. Panelet bruger `role="alert"` (eksisterende design-mønster fra `GdprPanel.tsx` er amber; dette panel bruger blå/informationstone).

**Eksisterende kode:**

- `src/lib/cookie-consent.ts` — `COOKIE_CONSENT_KEY = 'chainhub-cookie-consent'`, type `CookieConsentChoice = 'granted' | 'denied'`
- `src/components/CookieConsent.tsx` — banner, kalder `posthog.opt_in_capturing()` / `posthog.opt_out_capturing()`
- `src/app/(dashboard)/settings/settings-b.tsx` — section `'sikkerhed'` er "coming soon"-panel

### TDD

- [ ] **Step 1: Skriv failing tests FØRST**

Opret `src/__tests__/components/settings/CookieWithdrawPanel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CookieWithdrawPanel } from '@/components/settings/CookieWithdrawPanel'
import { COOKIE_CONSENT_KEY } from '@/lib/cookie-consent'

// posthog mock
vi.mock('posthog-js', () => ({
  default: {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}))

import posthog from 'posthog-js'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('CookieWithdrawPanel', () => {
  it('viser "ikke givet" og Acceptér-knap når localStorage er tom', () => {
    render(<CookieWithdrawPanel />)
    expect(screen.getByText(/ikke givet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /acceptér analytics/i })).toBeInTheDocument()
  })

  it('viser "Givet" og Tilbagekald-knap når consent er "granted"', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'granted')
    render(<CookieWithdrawPanel />)
    expect(screen.getByText(/givet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tilbagekald samtykke/i })).toBeInTheDocument()
  })

  it('kalder posthog.opt_out_capturing og sætter localStorage til "denied" ved tilbagetrækning', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'granted')
    render(<CookieWithdrawPanel />)
    fireEvent.click(screen.getByRole('button', { name: /tilbagekald samtykke/i }))
    expect(posthog.opt_out_capturing).toHaveBeenCalledOnce()
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('denied')
  })

  it('har role="alert" på status-indikatoren', () => {
    render(<CookieWithdrawPanel />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
```

Kør: `npx vitest run src/__tests__/components/settings/CookieWithdrawPanel.test.tsx`

Expected: **4 FAIL** (komponenten eksisterer ikke).

### Implementation

- [ ] **Step 2: Opret `src/components/settings/CookieWithdrawPanel.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { COOKIE_CONSENT_KEY, type CookieConsentChoice, isValidConsent } from '@/lib/cookie-consent'

// ─────────────────────────────────────────────────────────────────────────────
// CookieWithdrawPanel — GDPR art. 7 stk. 3: tilbagetrækning af cookie-samtykke.
// Vises i Settings → Sikkerhed. Synkroniserer med localStorage og PostHog.
// ─────────────────────────────────────────────────────────────────────────────

export function CookieWithdrawPanel() {
  const [consent, setConsent] = useState<CookieConsentChoice | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    setConsent(isValidConsent(stored) ? stored : null)
  }, [])

  function handleChoice(choice: CookieConsentChoice) {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice)
    try {
      if (choice === 'granted') posthog.opt_in_capturing()
      else posthog.opt_out_capturing()
    } catch {
      /* PostHog ikke initialiseret — ignorér */
    }
    setConsent(choice)
  }

  const isGranted = consent === 'granted'

  return (
    <div className="rounded-[6px] border border-b-border bg-b-panel px-4 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="text-[12px] font-semibold uppercase text-b-2"
          style={{ letterSpacing: '0.4px' }}
        >
          Analytics-samtykke
        </span>
      </div>

      <p className="mb-3 text-[12px] text-b-2">
        Du kan til enhver tid acceptere eller tilbagekalde dit samtykke til analytics-cookies (GDPR
        art. 7 stk. 3). Nødvendige session-cookies kan ikke frakobles.
      </p>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-medium text-b-2">Status:</span>
        <span
          role="alert"
          aria-live="polite"
          className={`rounded-[3px] px-1.5 py-px text-[10px] font-semibold ${
            isGranted ? 'bg-green-100 text-green-800' : 'bg-b-panel-h text-b-2'
          }`}
        >
          {isGranted ? 'Givet' : 'Ikke givet'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {isGranted ? (
          <button
            type="button"
            onClick={() => handleChoice('denied')}
            className="inline-flex items-center rounded-[4px] border border-b-border-strong bg-white px-3 py-1.5 text-[12px] font-medium text-b-1 hover:bg-b-panel-h"
          >
            Tilbagekald samtykke
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleChoice('granted')}
            className="inline-flex items-center rounded-[4px] border border-b-blue-fg bg-b-blue-fg px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0860c7]"
          >
            Acceptér analytics
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Integrér i settings-sektionen "sikkerhed"**

Læs `src/app/(dashboard)/settings/settings-b.tsx` og find "sikkerhed"-sektionens nuværende indhold (det er et "coming soon"-panel). Find blokken med `section === 'sikkerhed'` (ca. linje 200+).

Tilføj import øverst i settings-b.tsx:

```tsx
import { CookieWithdrawPanel } from '@/components/settings/CookieWithdrawPanel'
```

Find "sikkerhed"-sektionens render-blok og tilføj `CookieWithdrawPanel` som første element:

```tsx
{
  section === 'sikkerhed' && (
    <div className="flex flex-col gap-4">
      <PageHeader title="Sikkerhed" />
      <CookieWithdrawPanel />
      {/* Øvrige sikkerhedsindstillinger kommer i fremtidige sprints */}
      <Panel>
        <PanelHeader title="Adgangskode" />
        <p className="px-4 py-3 text-[12px] text-b-3">Adgangskodeændring kommer snart.</p>
      </Panel>
    </div>
  )
}
```

OBS: Den eksakte struktur af "sikkerhed"-sektionen kendes ikke uden at læse hele filen. Agenten skal LÆSE linjen der indeholder `'sikkerhed'` og matche det eksisterende panel-mønster (se "brugere" og "ai"-sektioner som reference).

- [ ] **Step 4: Kør tests — forvent GREEN**

```bash
npx vitest run src/__tests__/components/settings/CookieWithdrawPanel.test.tsx
```

Expected: **4 PASS**.

- [ ] **Step 5: TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 fejl.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/CookieWithdrawPanel.tsx src/app/\(dashboard\)/settings/settings-b.tsx src/__tests__/components/settings/CookieWithdrawPanel.test.tsx
git commit -m "feat(legal): in-app cookie-tilbagetrækning i Settings (GDPR art. 7 stk. 3)"
```

---

## Task 5: GdprPanel — verificér `role=alert` og tilføj manglende a11y-attribut

**Files:**

- Read + Modify: `src/components/persons/GdprPanel.tsx`
- Read: `src/__tests__/` (tjek om GdprPanel har test for role=alert)

**Hvad og hvorfor:** Roadmappen nævner `GdprPanel role=alert`. Den nuværende kode (linje 62–97) bruger `amber-bordered` panel men har IKKE `role="alert"`. Slettedialogen er kritisk — en bruger med skærmlæser bør høre at de er ved at udføre en irreversibel handling. Vi tilføjer `role="alert"` til advarselsboksen i dialogen.

- [ ] **Step 1: Skriv TDD-test**

Opret/udvid test-fil. Tjek om `src/__tests__/components/persons/GdprPanel.test.tsx` eksisterer:

```bash
ls src/__tests__/components/persons/
```

Hvis den IKKE eksisterer, opret `src/__tests__/components/persons/GdprPanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GdprPanel } from '@/components/persons/GdprPanel'

vi.mock('@/actions/gdpr', () => ({
  prepareGdprExport: vi.fn(),
  executeGdprDelete: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/accessible-dialog', () => ({
  AccessibleDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}))

describe('GdprPanel', () => {
  it('rendrer ikke når isAdmin=false', () => {
    const { container } = render(
      <GdprPanel personId="p-1" personFullName="Test Person" isAdmin={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('viser GDPR-panel når isAdmin=true', () => {
    render(<GdprPanel personId="p-1" personFullName="Test Person" isAdmin={true} />)
    expect(screen.getByText(/GDPR/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Find og ret advarselsboksen i dialogen**

I `src/components/persons/GdprPanel.tsx`, find linje 108-112 (advarselsboks):

```tsx
<div className="rounded-[4px] border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
  <strong>Advarsel: Denne handling kan ikke fortrydes.</strong> Al persondata pseudonymiseres og
  alle relationer afregistreres permanent (GDPR Art. 17). Audit-loggen bevares af juridiske hensyn.
</div>
```

Tilføj `role="alert"`:

```tsx
<div
  role="alert"
  className="rounded-[4px] border border-red-200 bg-red-50 p-3 text-[12px] text-red-700"
>
  <strong>Advarsel: Denne handling kan ikke fortrydes.</strong> Al persondata pseudonymiseres og
  alle relationer afregistreres permanent (GDPR Art. 17). Audit-loggen bevares af juridiske hensyn.
</div>
```

- [ ] **Step 3: Kør tests**

```bash
npx vitest run src/__tests__/components/persons/GdprPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/persons/GdprPanel.tsx src/__tests__/components/persons/GdprPanel.test.tsx
git commit -m "fix(a11y): GdprPanel slette-advarsel har nu role=alert"
```

---

## Task 6: Fuld test-suite kørsel + build-verifikation

**Files:** Ingen kodeændring.

- [ ] **Step 1: Kør alle tests**

```bash
npm test
```

Expected: alle eksisterende tests + de nye tests i denne stream er PASS. Ingen regression.

- [ ] **Step 2: Kør lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Kør build**

```bash
npm run build
```

Expected: Grøn build. Ingen Prisma-drift-fejl.

- [ ] **Step 4: Verificér migrations-rækkefølge er korrekt**

```bash
ls prisma/migrations/
```

Expected: `0_init/` + `<timestamp>_add_acceptance_tracking/`. Kun 2 mapper. `migration_lock.toml` eksisterer.

---

## Stream E exit-gate

- [ ] `prisma migrate deploy` grøn mod tom DB med begge migrationer (0_init + add_acceptance_tracking).
- [ ] `createAccount` uden `termsAccepted=true` returnerer fejl — verificeret af test.
- [ ] `createAccount` med begge accepted=true persisterer non-null `terms_accepted_at` + `dpa_accepted_at` — verificeret af test.
- [ ] `/signup`-siden rendrer to accept-checkboxe; submit-knap er disabled indtil begge er afkrydset.
- [ ] `/legal/privatliv` viser IKKE "CVR: [indsættes...]" — teksten eksisterer ikke i render-output.
- [ ] `CHAINHUB_CVR=12345678` i env → CVR vises korrekt på siden.
- [ ] `CookieWithdrawPanel` i Settings → Sikkerhed: viser correct status fra localStorage; tilbagekald-knap kalder `posthog.opt_out_capturing()` — verificeret af test.
- [ ] `GdprPanel` slette-advarsel har `role="alert"` — verificeret af test.
- [ ] `npm test`, `npm run lint`, `npm run build` alle grønne.

---

## Philip-afhængigheder (udenfor kode-scope)

1. **CVR-registrering** — sæt `CHAINHUB_CVR` (8 cifre, fx `12345678`) og `CHAINHUB_ADDRESS` (fx `Strandvejen 1, 2900 Hellerup`) i Vercel-env efter registrering. CVR vises automatisk på `/legal/privatliv` herefter.
2. **Jurist-vurdering** — klik-accept-mekanismen (checkbox + tidsstempel) er et robust GDPR art. 28-bevis for B2B; jurist bør dog bekræfte om B2B-DBA kræver separat underskrift frem for klik-accept. Koden understøtter begge scenarier (tidsstempel er dokumentation for klik-accept; separat underskrift-flow er fremtidigt scope).

---

## Self-review-noter

- **Spec-dækning:** Dækker alle 3 Stream E-items fra roadmappen (accept-sporing, cookie-tilbagetrækning, CVR-eksponering). ✅
- **Afhængighed:** Stream A (0_init) skal være merged INDEN Task 1 køres — migration builder oven på baseline.
- **Signup-flow-valg:** Accept er placeret i Step 1 (`/signup`, `createAccount`) frem for Step 2 (`/signup/organization`), fordi org'en **oprettes** i Step 1. Step 2 kan springes over, så accept i Step 2 giver ikke GDPR-garanti.
- **CVR-guard:** `z.literal(true)` på Zod-skemaet er strengere end `z.boolean()` — det er intentionelt, da `false` aldrig er et gyldigt input.
- **Cookie-panel placering:** Settings → Sikkerhed frem for Settings → Org, fordi det er en personlig (bruger-niveau) præference, ikke en org-niveau indstilling. Alternativ: en separat "Privatliv"-sektion.
- **Åbne valg til Philip:** (1) CVR Option A vs. B (anbefalt: A, koden implementerer A). (2) Klik-accept vs. jurist-underskrift til DBA. (3) Ønskes accept-checkbox ved Google OAuth-signup (koden dækker kun credentials-signup; Google-flow redirecter direkte til dashboard).
- **Ikke dækket (bevidst out-of-scope):** Eksisterende orgs mangler `terms_accepted_at` — disse NULL-orgs håndteres ikke med en "acceptér venligst vilkår"-gating ved login. Det kan tilføjes som P2 i et fremtidigt sprint.
