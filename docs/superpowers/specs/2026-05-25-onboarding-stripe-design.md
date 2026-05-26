# ChainHub Self-Service Onboarding + Stripe Billing — Design Spec

**Dato:** 2026-05-25
**Status:** Godkendt

---

## 1. Onboarding Flow

### 2-Step Signup Wizard

**Step 1: Opret konto** (`/signup`)

- Felter: Fuldt navn, email, password (min 8 tegn)
- Validering: Zod, email-unikhed pr. organisation (ny org = altid unik)
- Action: Opretter `User` (rolle: GROUP_OWNER) + `Organization` i én transaktion
- Organization defaults: `plan_tier = STARTER`, `subscription_status = TRIALING`, `trial_ends_at = now + 14 dage`
- Auto-login efter oprettelse (NextAuth signIn)

**Step 2: Din organisation** (`/signup/organization`)

- Felter: Organisationsnavn (required), branche (valgfri dropdown), antal lokationer (valgfri: 1-5, 6-25, 26+)
- Action: Opdaterer Organization med navn + metadata
- Redirect til `/dashboard`

**Post-signup:**

- Dashboard viser `OnboardingPanel` (allerede bygget, skal bare mountes)
- Trial-banner i toppen: "Du har X dage tilbage af din gratis prøveperiode. [Vælg plan]"

### Datamodel-ændringer

Nye felter på `Organization`:

```prisma
plan_tier            PlanTier       @default(STARTER)
subscription_status  SubStatus      @default(TRIALING)
trial_ends_at        DateTime?
stripe_customer_id   String?        @unique
stripe_subscription_id String?      @unique
industry             String?
estimated_locations  String?
```

Nye enums:

```prisma
enum PlanTier {
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum SubStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  EXPIRED
}
```

---

## 2. Stripe Billing

### Prismodel

| Tier         | Lokationer | Brugere    | Pris/md          |
| ------------ | ---------- | ---------- | ---------------- |
| Starter      | 1-5        | 5          | 799 kr (~€107)   |
| Professional | 6-25       | Ubegrænset | 1.999 kr (~€268) |
| Enterprise   | 26+        | Ubegrænset | Kontakt          |

- 14 dages gratis trial, intet kreditkort ved signup
- AI, storage, emails inkluderet
- Valuta: DKK (Stripe støtter DKK)

### Stripe-setup

**Produkter i Stripe Dashboard (oprettes manuelt):**

- Product: "ChainHub Starter" — Price: 799 DKK/md (recurring)
- Product: "ChainHub Professional" — Price: 1.999 DKK/md (recurring)

**Stripe Checkout** bruges til plan-valg:

- Bruger klikker "Vælg plan" → server opretter Checkout Session → redirect til Stripe
- `trial_end` sættes til organisationens `trial_ends_at` (så trial ikke resetter)
- Success URL: `/billing?success=true`
- Cancel URL: `/billing`

**Stripe Customer Portal** bruges til selvbetjening:

- Faktura-historik, betalingsmetode, opsigelse
- Konfigureres i Stripe Dashboard
- Bruger tilgår via `/settings` → "Administrér abonnement"

### Webhook-endpoint

`/api/webhooks/stripe` — validerer Stripe signature, håndterer:

| Event                           | Handling                                                          |
| ------------------------------- | ----------------------------------------------------------------- |
| `checkout.session.completed`    | Gem `stripe_customer_id` + `stripe_subscription_id`, sæt `ACTIVE` |
| `customer.subscription.updated` | Opdatér `plan_tier` + `subscription_status`                       |
| `customer.subscription.deleted` | Sæt `CANCELED`                                                    |
| `invoice.payment_failed`        | Sæt `PAST_DUE`                                                    |

### Access Gate

**Middleware/layout-check:**

- `TRIALING` med `trial_ends_at > now` → fuld adgang, vis trial-banner
- `ACTIVE` → fuld adgang
- `TRIALING` med `trial_ends_at <= now` → sæt `EXPIRED`, redirect til `/billing`
- `PAST_DUE` → vis advarsel, tillad 3 dages grace period, derefter blokér
- `CANCELED` / `EXPIRED` → redirect til `/billing` med "Vælg plan for at fortsætte"

**Undtagelser fra gate:** `/api/health`, `/api/webhooks/stripe`, `/settings` (så bruger kan administrere), `/billing`

---

## 3. Billing Page

`/billing` — simpel side med:

- Nuværende plan + status
- Trial-countdown (hvis trialing)
- "Vælg Starter" / "Vælg Professional" knapper → Stripe Checkout
- "Kontakt os" for Enterprise
- "Administrér abonnement" → Stripe Customer Portal link

---

## 4. Invite-Flow (bonus, lavere prioritet)

Nuværende `createUser` i `src/actions/users.ts` opretter brugere med direkte password. Forbedring:

- Admin indtaster email + rolle
- System sender invite-email via Resend med token-link
- Inviteret bruger sætter selv password via `/invite?token=X`
- Token model: genbruger `PasswordResetToken` eller ny `InviteToken`

---

## 5. Filer der skal oprettes/ændres

### Nye filer:

- `src/app/(auth)/signup/page.tsx` — Step 1
- `src/app/(auth)/signup/organization/page.tsx` — Step 2
- `src/app/(dashboard)/billing/page.tsx` — Plan-valg + status
- `src/app/api/webhooks/stripe/route.ts` — Webhook endpoint
- `src/actions/signup.ts` — `createAccount()`, `updateOrganization()`
- `src/actions/billing.ts` — `createCheckoutSession()`, `createPortalSession()`
- `src/lib/stripe.ts` — Stripe client singleton
- `src/components/layout/TrialBanner.tsx` — Trial countdown banner

### Ændrede filer:

- `prisma/schema.prisma` — nye felter + enums
- `src/lib/env.ts` — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `src/app/(dashboard)/layout.tsx` — tilføj TrialBanner + subscription gate
- `src/app/(dashboard)/dashboard/page.tsx` — mount OnboardingPanel
- `src/middleware.ts` — billing-gate logik
- `package.json` — `stripe` package

---

## 6. Implementeringsrækkefølge

1. **Prisma schema + enums** (fundament)
2. **Signup wizard** (2 steps + auto-login)
3. **Mount OnboardingPanel** i dashboard
4. **Stripe integration** (checkout + webhooks + portal)
5. **Billing page** + trial banner
6. **Subscription gate** (middleware/layout)
7. **Invite-flow** (hvis tid)
