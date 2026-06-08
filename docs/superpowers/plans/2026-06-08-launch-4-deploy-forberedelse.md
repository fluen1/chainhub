# Launch plan 4/4 — Deploy-forberedelse

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gør ChainHub deploy-klar til chainhub.dk: prod-env-skabelon + env-hærdning, et sikkert prod-bootstrap-script (første org + GROUP_OWNER uden demo-data), `db:migrate`-script, og en komplet go-live-runbook med DNS/Sentry/BetterStack/R2-trin samt den samlede eksterne tjekliste.

**Architecture:** Kodebasen er allerede deploy-moden (R2-swap, Sentry og Prisma-migrations er kode-klare — venter kun på env-vars/secrets/infra). Denne plan lukker de sidste kode-huller (bootstrap-script, migrate-script, env-skabelon, env-validering af `STORAGE_PROVIDER`/`DIGEST_FROM_EMAIL`) og samler den operationelle viden i én runbook. Bootstrap-logikken lægges i et testbart modul (`src/lib/bootstrap.ts`) med en tynd CLI-runner (`scripts/bootstrap-prod.ts`).

**Tech Stack:** Next.js 16, Prisma (migrate deploy), bcryptjs, tsx (script-runner), Vitest, Cloudflare R2 (S3-kompatibel), Resend, Sentry, BetterStack, Vercel, Supabase.

**Spec:** `docs/superpowers/specs/2026-06-08-launch-readiness-design.md` (afsnit 7 "Deploy-forberedelse" + 8 "Eksterne actions")
**Branch:** `feat/launch-readiness` (plan 1+2+3+3b landet; HEAD `f3d6018`)

> ⚠️ **Scope-grænse — infra/eksterne handlinger eksekveres IKKE af denne plan.** Oprettelse af R2-bucket, DNS-records, BetterStack-monitor, domænekøb, konto-opgraderinger og kørsel af bootstrap/migrate MOD prod-databasen er udadvendte handlinger på Philips konti. Denne plan _forbereder og dokumenterer_ dem (runbook + tjekliste); de udføres af Philip (eller af Claude efter eksplicit bekræftelse). Alle tasks nedenfor er rene kode-/doc-ændringer i repoet.

---

## Verificeret deploy-readiness (2026-06-08)

| Område                                           | Status                                         | Mangler                                              |
| ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| Env-validering (`src/lib/env.ts`)                | Kode-klar (`requiredInProd`-system)            | `STORAGE_PROVIDER`+`DIGEST_FROM_EMAIL` ikke i schema |
| R2-storage-swap (`src/lib/storage/`)             | Kode-klar (`STORAGE_PROVIDER=r2` + 4 env-vars) | Bucket + env-vars (gated)                            |
| Sentry (`sentry.*.config.ts`)                    | Kode-klar                                      | DSN-env + alert-regler (gated)                       |
| Prisma-migrations (`prisma/migrations/`, 7 stk.) | Kode-klar                                      | `db:migrate`-script + `migrate deploy` ved deploy    |
| Bootstrap til prod                               | **Mangler**                                    | kun demo-`seed.ts` findes                            |
| Prod-env-skabelon                                | **Mangler**                                    | —                                                    |
| Deploy-runbook                                   | Delvis (`docs/ops/RUNBOOK.md`)                 | go-live-rækkefølge + DNS/BetterStack/R2-trin         |

**Faktiske modeller (fra `prisma/seed.ts`):** `organization` { id, name, cvr, plan, chain_structure } · `user` { id, organization_id, email, name, password_hash } (unik: organization_id+email) · `userRoleAssignment` { id, organization_id, user_id, role, scope, company_ids, created_by }. Password hashes med `bcryptjs` (`bcrypt.hash(pw, 10)`). Rolle for admin: `GROUP_OWNER`, scope `ALL`.

---

### Task 1: Env-hærdning + prod-skabelon + `db:migrate`-script

**Files:**

- Modify: `src/lib/env.ts`
- Create: `.env.production.example`
- Modify: `package.json`

- [ ] **Step 1: Tilføj `STORAGE_PROVIDER` + `DIGEST_FROM_EMAIL` til Zod-schemaet** i `src/lib/env.ts` (begge optional, så intet eksisterende brydes; enum'en fanger typo'er ved prod-boot). Tilføj i schema-objektet (fx efter `RESEND_API_KEY`/`CONTACT_TO_EMAIL`):

```ts
  STORAGE_PROVIDER: z.enum(['local', 'r2']).optional().default('local'),
  DIGEST_FROM_EMAIL: z.string().optional(),
```

- [ ] **Step 2: Opret `.env.production.example`** (skabelon — ingen rigtige hemmeligheder):

```
# ── ChainHub production env-skabelon ───────────────────────────────────────
# Kopiér til Vercel project env vars (Production). Udfyld alle påkrævede.
# Påkrævet i prod (appen nægter at starte uden):

DATABASE_URL=            # Supabase Transaction Pooler (port 6543, ?pgbouncer=true)
DIRECT_URL=              # Supabase Direct Connection (port 5432) — til migrate deploy
NEXTAUTH_SECRET=         # openssl rand -base64 32
NEXTAUTH_URL=https://www.chainhub.dk
DIGEST_CRON_SECRET=      # openssl rand -base64 32
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Stærkt anbefalet (kernefunktioner):
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_BASIS_PRICE_ID=
STRIPE_PLUS_PRICE_ID=
RESEND_API_KEY=
DIGEST_FROM_EMAIL=ChainHub <noreply@chainhub.dk>
CONTACT_TO_EMAIL=kontakt@chainhub.dk
OPENAI_API_KEY=

# Fillagring (R2 — sæt STORAGE_PROVIDER=r2 når bucket findes):
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=chainhub-documents

# Observability (valgfrit, men anbefalet i prod):
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

# OAuth (valgfrit — Google login):
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Bootstrap af første org (kun til engangs-kørsel af db:bootstrap, IKKE i Vercel):
BOOTSTRAP_ORG_NAME=
BOOTSTRAP_ORG_CVR=
BOOTSTRAP_ADMIN_EMAIL=
BOOTSTRAP_ADMIN_NAME=
BOOTSTRAP_ADMIN_PASSWORD=
```

- [ ] **Step 3: Tilføj `db:migrate`-script** i `package.json` (under de øvrige db-relaterede scripts):

```json
    "db:migrate": "prisma migrate deploy",
```

- [ ] **Step 4: Verificér**

Run: `npx tsc --noEmit`
Expected: 0 fejl.

Run: `npx next build`
Expected: GRØN (env-schemaet validerer stadig på build-maskine uden secrets, jf. `isBuildPhase`-undtagelsen).

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/lib/env.ts .env.production.example package.json
git -C C:\Users\birke\Projects\chainhub commit -m "chore(deploy): env-haerdning + .env.production-skabelon + db:migrate-script"
```

---

### Task 2: Prod-bootstrap-script (TDD)

Skab den FØRSTE organisation + en `GROUP_OWNER`-admin i en tom prod-database — uden demo-data. Logikken er testbar (`src/lib/bootstrap.ts`); CLI-runneren (`scripts/bootstrap-prod.ts`) læser env og kører den. Scriptet afbryder sikkert, hvis databasen allerede indeholder en organisation.

**Files:**

- Create: `src/lib/bootstrap.ts`
- Create: `src/__tests__/bootstrap-prod.test.ts`
- Create: `scripts/bootstrap-prod.ts`
- Modify: `package.json`

- [ ] **Step 1: Skriv fejlende test `src/__tests__/bootstrap-prod.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bootstrapProd, type BootstrapPrisma } from '@/lib/bootstrap'

function makeMockPrisma(opts: { existingOrg?: boolean } = {}): BootstrapPrisma {
  return {
    organization: {
      findFirst: vi.fn().mockResolvedValue(opts.existingOrg ? { id: 'existing' } : null),
      create: vi.fn().mockResolvedValue({ id: 'org-new' }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'user-new' }),
    },
    userRoleAssignment: { create: vi.fn().mockResolvedValue({ id: 'role-new' }) },
  }
}

const validInput = {
  orgName: 'Min Kæde A/S',
  orgCvr: '12345678',
  adminEmail: 'admin@minkaede.dk',
  adminName: 'Admin Adminsen',
  adminPassword: 'hemmeligt123',
}

describe('bootstrapProd', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opretter org + GROUP_OWNER-admin i tom database', async () => {
    const prisma = makeMockPrisma()
    const result = await bootstrapProd(prisma, validInput)
    expect(result.created).toBe(true)
    expect(prisma.organization.create).toHaveBeenCalledOnce()
    expect(prisma.user.create).toHaveBeenCalledOnce()
    expect(prisma.userRoleAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'GROUP_OWNER', scope: 'ALL' }),
      })
    )
  })

  it('hasher adgangskoden (gemmer aldrig plaintext)', async () => {
    const prisma = makeMockPrisma()
    await bootstrapProd(prisma, validInput)
    const userArg = (prisma.user.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const hash: string = userArg.data.password_hash
    expect(hash).not.toBe(validInput.adminPassword)
    expect(hash.startsWith('$2')).toBe(true) // bcrypt-prefix
  })

  it('afbryder sikkert hvis databasen allerede har en organisation', async () => {
    const prisma = makeMockPrisma({ existingOrg: true })
    const result = await bootstrapProd(prisma, validInput)
    expect(result.created).toBe(false)
    expect(prisma.organization.create).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('afviser ugyldig e-mail', async () => {
    const prisma = makeMockPrisma()
    await expect(
      bootstrapProd(prisma, { ...validInput, adminEmail: 'ikke-email' })
    ).rejects.toThrow()
    expect(prisma.organization.create).not.toHaveBeenCalled()
  })

  it('afviser for kort adgangskode (< 8 tegn)', async () => {
    const prisma = makeMockPrisma()
    await expect(bootstrapProd(prisma, { ...validInput, adminPassword: 'kort' })).rejects.toThrow()
    expect(prisma.organization.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Kør testen — verificér fejl**

Run: `npx vitest run src/__tests__/bootstrap-prod.test.ts`
Expected: FAIL — `Cannot find module '@/lib/bootstrap'`.

- [ ] **Step 3: Skriv `src/lib/bootstrap.ts`**

```ts
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

export type BootstrapInput = {
  orgName: string
  orgCvr?: string
  plan?: string
  adminEmail: string
  adminName: string
  adminPassword: string
}

export type BootstrapResult =
  | { created: true; organizationId: string; userId: string }
  | { created: false; reason: string }

// Minimal strukturel type for de Prisma-delegater vi bruger — gør logikken testbar
// uden en rigtig PrismaClient. CLI-runneren caster en ægte klient hertil.
export type BootstrapPrisma = {
  organization: {
    findFirst(args?: unknown): Promise<{ id: string } | null>
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
  user: {
    findFirst(args?: unknown): Promise<{ id: string } | null>
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
  userRoleAssignment: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
}

export async function bootstrapProd(
  prisma: BootstrapPrisma,
  input: BootstrapInput
): Promise<BootstrapResult> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.adminEmail)) {
    throw new Error('Ugyldig admin-e-mail')
  }
  if (input.adminPassword.length < 8) {
    throw new Error('Admin-adgangskode skal være mindst 8 tegn')
  }

  // Sikkerhed: bootstrap kun en TOM database. Findes der allerede en organisation, afbryd
  // (nye kunder oprettes via self-service signup, ikke via dette script).
  const existing = await prisma.organization.findFirst()
  if (existing) {
    return {
      created: false,
      reason: 'Databasen indeholder allerede en organisation — bootstrap springes over',
    }
  }

  const organizationId = randomUUID()
  await prisma.organization.create({
    data: {
      id: organizationId,
      name: input.orgName,
      cvr: input.orgCvr,
      plan: input.plan ?? 'trial',
      chain_structure: true,
    },
  })

  const passwordHash = await bcrypt.hash(input.adminPassword, 10)
  const userId = randomUUID()
  await prisma.user.create({
    data: {
      id: userId,
      organization_id: organizationId,
      email: input.adminEmail,
      name: input.adminName,
      password_hash: passwordHash,
    },
  })

  await prisma.userRoleAssignment.create({
    data: {
      id: randomUUID(),
      organization_id: organizationId,
      user_id: userId,
      role: 'GROUP_OWNER',
      scope: 'ALL',
      company_ids: [],
      created_by: userId,
    },
  })

  return { created: true, organizationId, userId }
}
```

- [ ] **Step 4: Kør testen — verificér grøn**

Run: `npx vitest run src/__tests__/bootstrap-prod.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Skriv CLI-runneren `scripts/bootstrap-prod.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import { bootstrapProd, type BootstrapInput, type BootstrapPrisma } from '../src/lib/bootstrap'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Mangler env-var ${name}`)
  return value
}

async function main() {
  const input: BootstrapInput = {
    orgName: requireEnv('BOOTSTRAP_ORG_NAME'),
    orgCvr: process.env.BOOTSTRAP_ORG_CVR,
    plan: process.env.BOOTSTRAP_PLAN,
    adminEmail: requireEnv('BOOTSTRAP_ADMIN_EMAIL'),
    adminName: requireEnv('BOOTSTRAP_ADMIN_NAME'),
    adminPassword: requireEnv('BOOTSTRAP_ADMIN_PASSWORD'),
  }

  const prisma = new PrismaClient()
  try {
    // PrismaClient er strukturelt kompatibel med BootstrapPrisma; cast ved seam'en.
    const result = await bootstrapProd(prisma as unknown as BootstrapPrisma, input)
    if (result.created) {
      console.log(
        `✓ Bootstrap fuldført — organisation ${result.organizationId}, admin ${input.adminEmail} (GROUP_OWNER).`
      )
    } else {
      console.log(`⊘ ${result.reason}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Bootstrap fejlede:', error)
  process.exit(1)
})
```

- [ ] **Step 6: Tilføj `db:bootstrap`-script** i `package.json`:

```json
    "db:bootstrap": "tsx scripts/bootstrap-prod.ts",
```

- [ ] **Step 7: Verificér typecheck**

Run: `npx tsc --noEmit`
Expected: 0 fejl.

- [ ] **Step 8: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/lib/bootstrap.ts src/__tests__/bootstrap-prod.test.ts scripts/bootstrap-prod.ts package.json
git -C C:\Users\birke\Projects\chainhub commit -m "feat(deploy): prod-bootstrap-script (foerste org + GROUP_OWNER, ingen demo-data)"
```

---

### Task 3: Go-live-runbook

Saml den operationelle viden i én ordnet runbook, inkl. de gated infra-/eksterne handlinger.

**Files:**

- Create: `docs/ops/LAUNCH-DEPLOY.md`

- [ ] **Step 1: Skriv `docs/ops/LAUNCH-DEPLOY.md`**

```markdown
# ChainHub — go-live-runbook (chainhub.dk)

Status: forberedt 2026-06-08 (launch plan 4). Kode er deploy-klar; nedenstående er
de operationelle + eksterne trin. ⚠️-trin udføres på Philips konti.

## 0. Forudsætninger (eksterne — Philip)

- [ ] Domæne **chainhub.dk** købt (simply.com, ~130 kr./år)
- [ ] Vercel Pro ($20/md) · Supabase Pro ($25/md)
- [ ] OpenAI/Anthropic-tier til prod-AI · Upstash Redis · Stripe live-nøgler
- [ ] Cloudflare-konto (til R2) · BetterStack-konto (gratis tier)
- [ ] Orientering af Alexander + René (launch = bibeskæftigelse)

## 1. Database (Supabase)

- [ ] Opret prod-projekt; notér `DATABASE_URL` (Transaction Pooler, port 6543, `?pgbouncer=true`) og `DIRECT_URL` (Direct, port 5432)
- [ ] `npm run db:migrate` (kører `prisma migrate deploy` mod prod) ⚠️

## 2. Fillagring (Cloudflare R2) ⚠️

- [ ] Opret R2-bucket `chainhub-documents` (Cloudflare dashboard eller MCP)
- [ ] Opret R2 API-token (Object Read & Write) → `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`
- [ ] Notér `R2_ACCOUNT_ID`; sæt `STORAGE_PROVIDER=r2`

## 3. E-mail (Resend + DNS på chainhub.dk) ⚠️

- [ ] Tilføj domænet i Resend → Domains → chainhub.dk
- [ ] Tilsæt DNS-records hos domæneudbyder:
  - SPF (TXT): `v=spf1 include:amazonses.com ~all`
  - DKIM (CNAME): de 3 records Resend viser i dashboardet
  - DMARC (TXT): `v=DMARC1; p=none; rua=mailto:dmarc@chainhub.dk`
- [ ] Afvent Resend-verifikation; ellers falder afsendelse tilbage til resend.dev

## 4. Observability

- [ ] Sentry: opret prod-projekt → sæt `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Sentry alert-regler (opret i dashboard når DSN er sat):
  - Ny issue (level=error) → e-mail straks
  - Issue-frekvens > 10/min → alert
  - Crash-free sessions < 99% → daglig digest
- [ ] BetterStack: opret uptime-monitor på `https://www.chainhub.dk/api/health` ⚠️
- [ ] BetterStack: aktivér offentlig status-side (lukker A.7) ⚠️
- [ ] PostHog (valgfrit): sæt `NEXT_PUBLIC_POSTHOG_KEY` (analytics aktiveres kun ved samtykke)

## 5. Vercel

- [ ] Importér repo; sæt alle env-vars fra `.env.production.example` (Production)
- [ ] `NEXTAUTH_URL=https://www.chainhub.dk`
- [ ] Stripe webhook-endpoint: `https://www.chainhub.dk/api/webhooks/stripe` → `STRIPE_WEBHOOK_SECRET`
- [ ] Deploy

## 6. Bootstrap (engangs — første org) ⚠️

- [ ] Sæt `BOOTSTRAP_ORG_NAME`, `BOOTSTRAP_ORG_CVR`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD`
- [ ] `npm run db:bootstrap` (afbryder sikkert hvis DB ikke er tom)
- [ ] Log ind som admin, skift adgangskode

## 7. Smoke-verifikation

- [ ] Forside, /pricing, /kontakt, /legal/\*, /docs loader uden login
- [ ] Login virker; dashboard loader; upload et dokument (R2 virker)
- [ ] Kontaktformular sender (tjek Resend + indbakke)
- [ ] `/api/health` 200; Sentry modtager test-event; BetterStack grøn

## 8. Efter launch

- [ ] Pilot-outreach (A.8) · CVR-felt i privatlivspolitik udfyldt
- [ ] Overvej omdøbning af "Klinik…"-roller (ikke-dental ICP)
```

- [ ] **Step 2: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add docs/ops/LAUNCH-DEPLOY.md
git -C C:\Users\birke\Projects\chainhub commit -m "docs(deploy): go-live-runbook med DNS/Sentry/BetterStack/R2 + ekstern tjekliste"
```

---

### Task 4: Fuld kvalitetsgate

⛔ **Forbud:** ingen `git stash`/`reset`/`checkout -f`/`restore`.

- [ ] **Step 1: Format** — `npx prettier --check` på de nye/ændrede filer (`src/lib/env.ts`, `src/lib/bootstrap.ts`, `scripts/bootstrap-prod.ts`, `src/__tests__/bootstrap-prod.test.ts`, `.env.production.example`, `package.json`, `docs/ops/LAUNCH-DEPLOY.md`). `--write` + commit `style(deploy): prettier` hvis nødvendigt. (Bemærk: `.env.production.example` + `.md` er muligvis ikke omfattet af prettier — det er fint.)
- [ ] **Step 2: Lint** — `npx eslint src --ext ts,tsx`. Antal IKKE over baseline (4), ingen i plan-4-filer (`src/lib/bootstrap.ts`, `src/lib/env.ts`). Fix kun nye. (`scripts/` er muligvis uden for eslint-scope — verificér.)
- [ ] **Step 3: TypeScript** — `npx tsc --noEmit` → 0 fejl.
- [ ] **Step 4: Unit (fuld)** — `npm test` → faktiske tal; baseline + bootstrap-test (5) grønne, 0 failed.
- [ ] **Step 5: Build** — `npx next build` → grøn.
- [ ] **Step 6: E2e (fuld)** — `npx playwright test` → faktiske tal, alle grønne. (Plan 4 rører ikke UI — bør være uændret grøn.)
- [ ] **Step 7: Fejler noget → fix** minimalt + commit `fix(deploy): …`. Præeksisterende/urelaterede NOTERES. **Fail loud.**

---

### Task 5: Status + afsluttende handoff

**Files:**

- Modify: `docs/status/PROGRESS.md`

- [ ] **Step 1: Opdatér `docs/status/PROGRESS.md`** — match plan 1-3b-stilen. Ny sektion "Launch-readiness plan 4 (2026-06-08)": env-hærdning + `.env.production.example`; prod-bootstrap-script (testbar `src/lib/bootstrap.ts` + CLI); `db:migrate` + `db:bootstrap`-scripts; go-live-runbook (`docs/ops/LAUNCH-DEPLOY.md`). Markér at hele launch-readiness-tracket (plan 1-4) nu er **kode-komplet**; resterende er gated infra/eksterne handlinger (runbook) + PR til Rico. Gate-tal.

- [ ] **Step 2: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add docs/status/PROGRESS.md
git -C C:\Users\birke\Projects\chainhub commit -m "docs: PROGRESS opdateret efter launch-readiness plan 4 — tracket kode-komplet"
```

- [ ] **Step 3: Handoff** — meld tilbage til Philip: plan 4 leveret, hele launch-tracket kode-komplet. Præsentér de **gated infra-/eksterne handlinger** (runbook-trin med ⚠️) til hans go-ahead: R2-bucket (kan oprettes via Cloudflare MCP efter bekræftelse), DNS-records, BetterStack, Sentry-alerts, Vercel-env, migrate + bootstrap, domæne/konto-opgraderinger, orientering af Alexander+René. **Næste skridt = PR til Rico** (CopenAI-regel) — tilbyd at åbne den.

---

## Self-review mod spec (afsnit 7-8)

- **R2-bucket kode-klar + swap (afsnit 7):** verificeret kode-klar; env-skabelon + runbook-trin (Task 1, 3); bucket-oprettelse gated ✓
- **Env-tjekliste / `.env.production`-skabelon (afsnit 7):** Task 1 — alle påkrævede vars + env-validering af STORAGE_PROVIDER/DIGEST_FROM_EMAIL ✓
- **Resend DNS (afsnit 7):** SPF/DKIM/DMARC dokumenteret i runbook (Task 3) ✓
- **BetterStack uptime + status-side (afsnit 7):** runbook-trin (Task 3) ✓
- **Bootstrap-script (afsnit 7):** Task 2 — sikker, testbar, ingen demo-data, idempotent-guard ✓
- **Sentry-alerts (afsnit 7):** alert-regler dokumenteret i runbook (Task 3) ✓
- **Ekstern tjekliste (afsnit 8):** samlet i runbook §0 + handoff (Task 3, 5) ✓
- **Migrations til prod:** `db:migrate`-script (Task 1) + runbook-rækkefølge ✓
- **No-placeholder:** al kode komplet; `.env.production.example` er bevidst en skabelon (tomme værdier) ✓
- **Type-konsistens:** `BootstrapInput`/`BootstrapResult`/`BootstrapPrisma` delt mellem modul, test og CLI ✓
- **Uden for scope (gated, ikke auto-eksekveret):** faktisk oprettelse af R2/DNS/BetterStack/konti + kørsel mod prod-DB — dokumenteret, overladt til Philip ✓
- **Afslutning:** efter plan 4 → PR til Rico (Trello-opdatering + afstemning) ✓
