# Goal 3: Første Betalende Kunde — Checkout Polish + Onboarding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polér de sidste rå kanter i checkout-flow og onboarding, så den første betalende kunde har en glat oplevelse.

**Architecture:** Minimal ændringer — billing-siden skal reagere på `?success=1` / `?canceled=1` query params. Google OAuth signup skal redirecte til org-trin. Ingen nye modeller eller actions.

**Tech Stack:** Next.js searchParams, Server Actions, React components

**Revideret scope:** Stripe checkout og webhooks virker allerede. Hovedflows (dashboard, companies, contracts) er polerede. De eneste gaps er: (1) manglende success/cancel-besked på billing, (2) Google OAuth springer org-trin over.

---

### Task 1: Billing success/cancel feedback

**Files:**

- Modify: `src/app/(dashboard)/billing/page.tsx` (server component — læser searchParams)
- Modify: `src/app/(dashboard)/billing/billing-client.tsx` (client component — viser besked)

- [ ] **Step 1: Læs billing page.tsx og billing-client.tsx**

Forstå hvordan searchParams sendes til client component.

- [ ] **Step 2: Tilføj success/cancel prop til client**

I `page.tsx`, parse searchParams:

```typescript
const success = searchParams?.success === '1'
const canceled = searchParams?.canceled === '1'
```

Send som props til `BillingClient`.

- [ ] **Step 3: Vis feedback i client component**

Øverst i `BillingClient`, tilføj betinget banner:

```typescript
{success && (
  <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
    <strong>Betaling gennemført!</strong> Dit abonnement er nu aktivt. Det kan tage et øjeblik at opdatere.
  </div>
)}
{canceled && (
  <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
    Betalingen blev annulleret. Du kan prøve igen når du er klar.
  </div>
)}
```

- [ ] **Step 4: Test i browser**

Naviger til `/billing?success=1` og `/billing?canceled=1`, verificér bannerne vises.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/billing/
git commit -m "feat: success/cancel feedback på billing-side efter checkout"
```

---

### Task 2: Google OAuth → org-trin redirect

**Files:**

- Modify: `src/lib/auth/index.ts` (signIn callback eller redirect callback)

- [ ] **Step 1: Læs auth/index.ts signIn callback**

Find hvor Google OAuth brugere redirectes efter første signup. Identificér logikken der afgør om det er en ny bruger (first login) vs. returning user.

- [ ] **Step 2: Redirect nye Google-brugere til /signup/organization**

I `signIn` eller `jwt` callback, tjek om brugerens organization mangler navn (stadig `{efternavn} Holding` default). Hvis ja, sæt en `needsOrgSetup: true` flag i token/session.

I `redirect` callback eller middleware, redirect til `/signup/organization` hvis `needsOrgSetup` er true.

```typescript
// I jwt callback:
if (trigger === 'signIn' && account?.provider === 'google') {
  const org = await prisma.organization.findFirst({
    where: { id: token.organizationId },
    select: { onboarding_completed: true },
  })
  if (!org?.onboarding_completed) {
    token.needsOrgSetup = true
  }
}

// I redirect callback:
if (token.needsOrgSetup && url !== '/signup/organization') {
  return '/signup/organization'
}
```

- [ ] **Step 3: Verificér at /signup/organization accepterer allerede-autentificerede brugere**

Sørg for at `/signup/organization` page.tsx tjekker session og lader autentificerede brugere udfylde org-data.

- [ ] **Step 4: Test i browser med Google OAuth**

1. Opret ny bruger via Google OAuth
2. Verificér redirect til `/signup/organization`
3. Udfyld org-navn
4. Verificér redirect til `/dashboard`
5. Verificér at returning Google-bruger IKKE redirectes til org-trin

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/
git commit -m "feat: Google OAuth redirect til org-opsætning ved første login"
```

---

### Task 3: Stripe price IDs i produktion

**Files:**

- Reference: Vercel dashboard (env vars)

- [ ] **Step 1: Verificér at env vars er dokumenteret**

Tjek `src/lib/env.ts` for `STRIPE_STARTER_PRICE_ID` og `STRIPE_PROFESSIONAL_PRICE_ID`. Sørg for at `.env.example` eller dokumentation nævner disse.

- [ ] **Step 2: Opret Stripe Products + Prices i Stripe Dashboard**

I Stripe Dashboard (live mode):

- Product: "ChainHub Starter" — 799 kr/md
- Product: "ChainHub Professional" — 1.999 kr/md
- Kopier price IDs (`price_xxx`)

- [ ] **Step 3: Sæt env vars i Vercel**

I Vercel project settings → Environment Variables:

- `STRIPE_STARTER_PRICE_ID` = `price_xxx`
- `STRIPE_PROFESSIONAL_PRICE_ID` = `price_xxx`
- `STRIPE_WEBHOOK_SECRET` = `whsec_xxx` (fra Stripe webhook endpoint)

- [ ] **Step 4: Test checkout end-to-end i preview deployment**

1. Deploy til Vercel preview
2. Klik "Vælg Starter" på billing-side
3. Gennemfør checkout med test-kort
4. Verificér redirect til `/billing?success=1`
5. Verificér webhook modtages og subscription oprettes

- [ ] **Step 5: Commit evt. .env.example ændringer**

```bash
git add .env.example
git commit -m "docs: Stripe price ID env vars dokumenteret"
```
