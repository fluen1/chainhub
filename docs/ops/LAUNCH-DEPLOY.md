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
