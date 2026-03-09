# ChainHub Operations Runbook
**Version:** 2.0 — Sprint 6 produktionsklar
**Opdateret:** BA-08 (DevOps-agent)
**Klassifikation:** INTERN

---

## Indholdsfortegnelse

1. [Miljø-konfiguration](#1-miljø-konfiguration)
2. [Kritiske advarsler](#2-kritiske-advarsler)
3. [Fejlscenarie: Databasen er nede](#3-fejlscenarie-databasen-er-nede)
4. [Fejlscenarie: Stripe webhook fejler](#4-fejlscenarie-stripe-webhook-fejler)
5. [Fejlscenarie: Migration fejler i produktion](#5-fejlscenarie-migration-fejler-i-produktion)
6. [Fejlscenarie: Bruger kan ikke logge ind med Microsoft](#6-fejlscenarie-bruger-kan-ikke-logge-ind-med-microsoft)
7. [Secrets rotation](#7-secrets-rotation)
8. [Database backup og point-in-time recovery](#8-database-backup-og-point-in-time-recovery)
9. [Monitoring og alerting](#9-monitoring-og-alerting)
10. [Vercel deployment](#10-vercel-deployment)
11. [Health checks](#11-health-checks)

---

## 1. Miljø-konfiguration

### Environment Variables

Alle environment variables er dokumenteret i `.env.example`. Ved deployment:

1. Kopiér `.env.example` til `.env.local` (lokal udvikling)
2. Sæt alle påkrævede variabler i Vercel dashboard (produktion)

### Kritiske variabler

| Variabel | Beskrivelse | Påkrævet |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) | Ja |
| `NEXTAUTH_URL` | App URL for NextAuth — `https://www.chainhub.dk` | Ja |
| `NEXTAUTH_SECRET` | Session encryption — **minimum 32 tegn** | Ja |
| `MICROSOFT_CLIENT_ID` | Azure AD app ID | Ja |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app secret | Ja |
| `STRIPE_SECRET_KEY` | Stripe API key | Prod |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Prod |
| `SENTRY_DSN` | Sentry error tracking | Prod |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (klientside) | Prod |
| `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` | Vercel Analytics | Prod |

---

## 2. Kritiske advarsler

### ⚠️ KRITISK: Stripe Webhook URL skal have www-prefix

**Problem:** Stripe webhooks fejler STILLE hvis URL mangler `www`-prefix.
Stripe sender POST-request til den konfigurerede URL. Hvis `chainhub.dk` redirecter
til `www.chainhub.dk` via HTTP 301, modtager Stripe en redirect og **opgiver** —
webhook markeres som fejlet uden at kode nogensinde kører.

**Konfigurér i Stripe Dashboard → Developers → Webhooks:**

```
✅ KORREKT:  https://www.chainhub.dk/api/webhooks/stripe
❌ FORKERT:  https://chainhub.dk/api/webhooks/stripe
```

**Verifikation:**
1. Gå til Stripe Dashboard → Developers → Webhooks
2. Bekræft endpoint URL starter med `https://www.`
3. Klik "Send test event" → vælg `payment_intent.succeeded`
4. Verificér `200 OK` i Stripe event log
5. Verificér log-entry i Sentry / Vercel function logs

**Berørte webhook events (minimum konfigureret):**
```
payment_intent.succeeded
payment_intent.payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

---

### ⚠️ KRITISK: NEXTAUTH_SECRET minimum 32 tegn

Kortere secrets afvises af NextAuth og resulterer i at alle sessioner fejler.

**Generér ny secret:**
```bash
openssl rand -base64 32
```

**Validering sker automatisk** i `validate-env.ts` ved startup og CI.

---

### ⚠️ KRITISK: STRIPE_WEBHOOK_SECRET — ingen trailing whitespace

Kopiér webhook secret præcis fra Stripe Dashboard. Trailing newlines eller spaces
giver stille signaturfejl — webhook modtages men valideres aldrig.

Koden trimmer automatisk: `process.env.STRIPE_WEBHOOK_SECRET?.trim()`

---

## 3. Fejlscenarie: Databasen er nede

### Symptomer
- HTTP 500 på alle sider undtagen statiske assets
- Sentry alerts: `PrismaClientKnownRequestError` eller `Connection refused`
- Vercel function logs viser database connection timeout

### Trin 1: Bekræft problemet

```bash
# Test database-forbindelse direkte
psql $DATABASE_URL -c "SELECT 1;"

# Tjek Supabase status
# → https://status.supabase.com/
```

### Trin 2: Tjek Supabase Dashboard

1. Log ind på [app.supabase.com](https://app.supabase.com)
2. Vælg `chainhub-prod` projekt
3. Gå til **Settings → Database**
4. Tjek **Database health** og **Connection pool**
5. Tjek **Logs → Database** for fejlbeskeder

### Trin 3: Tjek connection pool

Supabase bruger PgBouncer. Overskredne connection limits giver forbindelsesfejl:

```sql
-- Kør i Supabase SQL Editor
SELECT count(*) FROM pg_stat_activity;
SELECT max_conn, used, res_for_super FROM pg_stat_database WHERE datname = 'postgres';
```

Hvis connection count er tæt på max:
1. Gå til Supabase → Settings → Database → Connection Pooling
2. Verificér **Pool Mode = Transaction** (anbefalet for serverless)
3. Overvej at sænke `connection_limit` i `DATABASE_URL`:
   ```
   DATABASE_URL="...?pgbouncer=true&connection_limit=1"
   ```

### Trin 4: Restart database (Supabase)

1. Supabase Dashboard → Settings → General
2. Scroll ned til **Restart Database**
3. Bekræft restart — **forventer ~30 sekunders nedetid**
4. Overvåg at app kommer online igen

### Trin 5: Failover (kritisk nedetid > 15 min)

Hvis Supabase har regionalt outage:
1. Tjek [status.supabase.com](https://status.supabase.com)
2. Kontakt Supabase support med projekt-ID
3. Kommunikér status til brugere via statusside

### Genopretning

- [ ] Database svarer på `SELECT 1`
- [ ] App health endpoint returnerer 200: `https://www.chainhub.dk/api/health`
- [ ] Sentry viser ikke nye database-fejl
- [ ] Test login og CRUD-operation

---

## 4. Fejlscenarie: Stripe webhook fejler

### Symptomer
- Stripe Dashboard viser fejlede webhook events (status ≠ 200)
- Betalinger gennemføres i Stripe men abonnement aktiveres ikke i app
- Sentry alert: `payment_failed` webhook modtaget
- Email-alert fra alerting-system (se §9)

### Trin 1: Identificér fejltype i Stripe Dashboard

1. Stripe Dashboard → Developers → Webhooks → vælg endpoint
2. Klik på det fejlede event
3. **HTTP status 4xx:** Applikationsfejl — se Trin 2
4. **HTTP status 5xx:** Serverfejl — se Trin 3
5. **Ingen response / timeout:** URL-problem — se Trin 4

### Trin 2: Applikationsfejl (4xx)

**401 Unauthorized / 400 Bad Request — signatur-fejl:**
```bash
# Tjek at STRIPE_WEBHOOK_SECRET matcher Stripe Dashboard
# Stripe Dashboard → Developers → Webhooks → Signing secret

# Generer ny secret i Stripe og opdater Vercel:
# Stripe Dashboard → Webhook → Roll secret → Kopiér ny secret
# Vercel Dashboard → Project → Settings → Environment Variables
# STRIPE_WEBHOOK_SECRET = [ny secret]
# Klik Redeploy (UDEN build cache)
```

**Verificér trimming:**
```bash
# I Vercel function logs — tjek at secret ikke har whitespace
echo -n "$STRIPE_WEBHOOK_SECRET" | wc -c  # Skal matche Stripe's secret-længde
```

### Trin 3: Serverfejl (5xx)

1. Tjek Vercel function logs for `/api/webhooks/stripe`
2. Tjek Sentry for den præcise fejl og stack trace
3. Mest sandsynlige årsager:
   - Database nede (se §3)
   - Kodefejl i webhook-handler
   - Prisma-timeout

### Trin 4: URL-problem (ingen response)

**Verificér www-prefix — KRITISK:**
```
Stripe skal kalde: https://www.chainhub.dk/api/webhooks/stripe
                                ^^^
                         www SKAL være her
```

Hvis URL er forkert:
1. Stripe Dashboard → Webhooks → vælg endpoint → Edit endpoint
2. Ret URL til `https://www.chainhub.dk/api/webhooks/stripe`
3. Send test-event og verificér 200 response

### Trin 5: Genafspil fejlede events

Stripe gemmer alle events og tillader genafspilning:

1. Stripe Dashboard → Developers → Webhooks → vælg endpoint
2. Find fejlede events (rød status)
3. Klik på event → **"Resend"**
4. Verificér at event nu modtages med 200

**VIGTIGT:** Webhook-handler skal være **idempotent** — samme event kan modtages flere gange.
Kontrollér at handler tjekker om event allerede er behandlet før mutation.

### Trin 6: payment_failed alerting

Når `payment_intent.payment_failed` eller `invoice.payment_failed` modtages:
1. Sentry logger event automatisk (se §9)
2. Email-alert sendes til `ops@chainhub.dk`
3. Manuelle trin:
   - Tjek om kunden har opdateret betalingsmetode i Stripe Dashboard
   - Stripe sender automatisk retry (standard: 3 forsøg over 7 dage)
   - Efter 3 fejlede forsøg: abonnement sættes til `past_due` → `canceled`

### Genopretning

- [ ] Stripe Dashboard viser 200 på seneste test-event
- [ ] Alle fejlede events er genafspillet
- [ ] Abonnements-status i database matcher Stripe
- [ ] Ingen aktive Sentry alerts for webhook-fejl

---

## 5. Fejlscenarie: Migration fejler i produktion

### ⚠️ ADVARSEL: Kør aldrig `prisma migrate deploy` uden backup

**Før enhver migration i produktion:**
1. Tag manuel backup (se §8 — Point-in-time recovery)
2. Notér præcist tidspunkt for backup
3. Kør migration i staging-miljø først

### Symptomer
- CI/CD pipeline fejler på migration-trin
- App fejler med `PrismaClientKnownRequestError: Table does not exist`
- Deployment fejler halvvejs — app er i inkonsistent tilstand

### Trin 1: Stop igangværende migration

```bash
# Tjek migration-status
npx prisma migrate status

# Output viser:
# ✅ Applied — migrationer der er kørt
# ⏳ Pending — migrationer der venter
# ❌ Failed  — fejlede migrationer
```

### Trin 2: Diagnosticér fejlen

```bash
# Se fejlbesked fra Prisma
npx prisma migrate status --schema=prisma/schema.prisma

# Tjek Supabase SQL Editor for låste tabeller:
SELECT pid, query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state != 'idle';

# Dræb evt. hængende processer:
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < NOW() - INTERVAL '5 minutes';
```

### Trin 3: Manuel rollback

Prisma understøtter ikke automatisk rollback. Fremgangsmåde:

**A) Simpel rollback — migration tilføjede kolonner/tabeller:**
```sql
-- Kør i Supabase SQL Editor
-- Eksempel: fjern kolonne tilføjet af fejlet migration
ALTER TABLE contracts DROP COLUMN IF EXISTS new_column;

-- Marker migration som rolled back i _prisma_migrations:
DELETE FROM _prisma_migrations WHERE migration_name = '20240115_add_new_column';
```

**B) Kompleks rollback — brug point-in-time recovery:**
1. Se §8 for fuld restore-procedure
2. Restore til tidspunkt FØR migrationen startede
3. **OBS:** Al data oprettet efter backup-tidspunkt går tabt

### Trin 4: Ret migrationen

```bash
# ALDRIG: rediger eksisterende migration-fil
# ALTID: opret ny migration der retter fejlen

# Opret korrigerende migration:
npx prisma migrate dev --name fix_failed_migration

# Test lokalt og i staging FØR produktion
```

### Trin 5: Kør migration sikkert

```bash
# Deploy til produktion
npx prisma migrate deploy

# Verificér
npx prisma migrate status
# Alle migrationer skal vise ✅ Applied
```

### Checkliste for sikre migrations

```
□ Migration testet i lokal miljø
□ Migration testet i staging-miljø
□ Manuel database-backup taget inden deploy
□ Backup-tidspunkt noteret
□ Migration er ikke destruktiv (fjerner ikke kolonner med data)
□ Migration er idempotent (kan køres igen uden fejl)
□ Rollback-plan klar inden deploy starter
□ Deployment klar til at ske i lav-trafik periode
```

---

## 6. Fejlscenarie: Bruger kan ikke logge ind med Microsoft

### Symptomer
- Bruger omdirigeres til Microsoft login men returneres med fejl
- Fejlbeskeder: `AADSTS...` fejlkoder fra Microsoft
- NextAuth fejl i Sentry: `OAuthCallbackError`
- Bruger sidder fast på `/api/auth/error`

### Trin 1: Identificér fejltype

| Fejlkode | Årsag | Løsning |
|----------|-------|---------|
| `AADSTS50011` | Reply URL matcher ikke | Trin 2 |
| `AADSTS700016` | Client ID er forkert/ugyldigt | Trin 3 |
| `AADSTS7000215` | Client secret er udløbet | Trin 4 |
| `AADSTS65001` | App mangler bruger-samtykke | Trin 5 |
| `AADSTS50020` | Bruger er i anden tenant | Trin 6 |
| `Configuration` | Manglende env vars | Trin 7 |

### Trin 2: Reply URL matcher ikke (AADSTS50011)

Azure AD afviser login hvis callback-URL ikke er registreret.

1. Azure Portal → App Registrations → ChainHub
2. Authentication → Redirect URIs
3. Verificér at følgende URIs er registreret:
   ```
   https://www.chainhub.dk/api/auth/callback/microsoft-entra-id
   http://localhost:3000/api/auth/callback/microsoft-entra-id  (kun dev)
   ```
4. Tilføj manglende URI og gem
5. Test login igen (ændring træder i kraft øjeblikkeligt)

### Trin 3: Forkert Client ID (AADSTS700016)

```bash
# Verificér MICROSOFT_CLIENT_ID i Vercel
# Vercel Dashboard → Project → Settings → Environment Variables
# Sammenlign med:
# Azure Portal → App Registrations → ChainHub → Application (client) ID
```

### Trin 4: Udløbet Client Secret (AADSTS7000215)

Client secrets i Azure AD udløber (typisk 1-2 år).

1. Azure Portal → App Registrations → ChainHub → Certificates & secrets
2. Tjek udløbsdato på eksisterende secret
3. Opret ny secret: **+ New client secret**
4. Kopiér den nye secret **øjeblikkeligt** (vises kun én gang)
5. Opdater i Vercel: `MICROSOFT_CLIENT_SECRET = [ny secret]`
6. Redeploy (uden build cache)

**Sæt påmindelse:** Tilføj kalenderpåmindelse 30 dage inden udløb.

### Trin 5: Manglende samtykke (AADSTS65001)

Hvis app kræver admin-samtykke:
1. Azure Portal → Enterprise Applications → ChainHub → Permissions
2. Klik **"Grant admin consent for [tenant]"**
3. Log ud og ind igen som testbruger

### Trin 6: Bruger fra anden tenant

Per default accepterer ChainHub kun brugere fra den konfigurerede `MICROSOFT_TENANT_ID`.

Tjek i `src/lib/auth/config.ts`:
```typescript
// Verify tenant matches expected tenant
if (account?.tenantId !== process.env.MICROSOFT_TENANT_ID) {
  return false  // Afvis bruger fra anden tenant
}
```

Hvis bruger legitimt skal have adgang: tilføj dem til Azure AD tenanten.

### Trin 7: Manglende environment variables

```bash
# Verificér alle tre Microsoft-variabler er sat i Vercel:
MICROSOFT_CLIENT_ID     ← Azure Application (client) ID
MICROSOFT_CLIENT_SECRET ← Azure Client secret value
MICROSOFT_TENANT_ID     ← Azure Directory (tenant) ID

# NEXTAUTH_URL skal pege på www-domæne:
NEXTAUTH_URL="https://www.chainhub.dk"
```

### Trin 8: NextAuth session fejl

Hvis brugere er logget ind men mister session uventet:

```bash
# Tjek at NEXTAUTH_SECRET er identisk på tværs af alle Vercel-instanser
# Alle serverless functions SKAL bruge samme secret
# Verificér i Vercel → Settings → Environment Variables
```

### Genopretning

- [ ] Testbruger kan logge ind med Microsoft
- [ ] Session persisterer efter login (reload siden)
- [ ] Bruger omdirigeres korrekt til `/dashboard`
- [ ] Ingen `OAuthCallbackError` i Sentry

---

## 7. Secrets Rotation

### 7.1 NEXTAUTH_SECRET Rotation

**Påkrævet:** Minimum 32 tegn. Kortere secrets afvises.

**Rotation-procedure:**

```bash
# Trin 1: Generér ny secret
openssl rand -base64 32
# Output eksempel: K8mP2xR7vN4jL9qA1eW5cY3uB6hD0sF8

# Trin 2: Verificér længde (skal være ≥ 32 tegn)
echo -n "K8mP2xR7vN4jL9qA1eW5cY3uB6hD0sF8" | wc -c
```

```
Trin 3: Opdater i Vercel Dashboard
  → Project → Settings → Environment Variables
  → NEXTAUTH_SECRET → Edit
  → Indsæt ny secret
  → Save

Trin 4: Redeploy
  → Deployments → seneste deployment → ... → Redeploy
  → "Redeploy with existing Build Cache" = NEJ

Trin 5: Verificér
  → Åbn app i incognito-vindue
  → Gennemfør Microsoft login
  → Bekræft session fungerer

OBS: Rotation invaliderer ALLE eksisterende sessioner.
     Alle brugere skal logge ind igen.
     Planlæg rotation i lav-trafik periode.
```

**Rotation-interval:** Mindst én gang om året, eller ved mistanke om kompromittering.

---

### 7.2 STRIPE_WEBHOOK_SECRET Rotation

```
Trin 1: Stripe Dashboard → Developers → Webhooks → vælg endpoint
Trin 2: Klik "Roll secret" → bekræft
Trin 3: Kopiér ny secret ØJEBLIKKELIGT (vises kun én gang)
Trin 4: Opdater STRIPE_WEBHOOK_SECRET i Vercel (ingen trailing spaces/newlines)
Trin 5: Redeploy uden build cache
Trin 6: Send test-event fra Stripe og verificér 200 response
Trin 7: Verificér ingen fejl i Sentry de næste 10 minutter

VIGTIGT: Stripe accepterer kortvarigt BEGGE secrets under rotation
         (gammelt og nyt secret er begge gyldige i ~10 minutter).
         Deploy hurtigt for at minimere nedetid.
```

---

### 7.3 MICROSOFT_CLIENT_SECRET Rotation

```
Trin 1: Azure Portal → App Registrations → ChainHub → Certificates & secrets
Trin 2: "+ New client secret" → vælg udløb (24 måneder anbefalet)
Trin 3: Kopiér secret VALUE (ikke ID) øjeblikkeligt
Trin 4: Opdater MICROSOFT_CLIENT_SECRET i Vercel
Trin 5: Redeploy uden build cache
Trin 6: Test login med Microsoft i incognito-vindue
Trin 7: Slet gammelt secret i Azure Portal
Trin 8: Sæt kalenderpåmindelse 30 dage inden nyt secrets udløb
```

---

### 7.4 STRIPE_SECRET_KEY Rotation

```
Trin 1: Stripe Dashboard → Developers → API keys → "Roll key"
         OBS: Dette er destruktivt — gammel nøgle virker ikke mere
Trin 2: Kopiér ny secret key
Trin 3: Opdater STRIPE_SECRET_KEY i Vercel
Trin 4: Redeploy uden build cache
Trin 5: Test betalingsflow i staging med test-kort
Trin 6: Verificér abonnements-status kan hentes fra Stripe API

KRITISK: Rotation af Stripe secret key afbryder alle igangværende
         API-kald. Udfør kun ved sikkerhedshændelse.
```

---

### 7.5 Rotation Checkliste

```
□ Ny secret genereret med korrekt længde/format
□ Secret kopieret præcist (ingen trailing whitespace)
□ Secret opdateret i Vercel Dashboard (korrekt miljø: Production)
□ Redeploy udført UDEN build cache
□ Funktion testet (login / webhook / betaling)
□ Ingen nye Sentry-fejl efter rotation
□ Gammel secret slettet (Azure) / invalideret
□ Rotation dokumenteret i ops-log (dato + udført af)
□ Næste rotations-dato tilføjet til kalender
```

---

## 8. Database Backup og Point-in-Time Recovery

### 8.1 Supabase Automatisk Backup

Supabase tager automatiske backups på alle betalte planer.

| Plan | Backup-frekvens | Retention | Point-in-time |
|------|----------------|-----------|---------------|
| Free | Daglig | 7 dage | Nej |
| Pro | Daglig | 7 dage | Ja (7 dage) |
| Team | Daglig | 14 dage | Ja (14 dage) |
| Enterprise | Daglig | 30 dage | Ja (30 dage) |

**ChainHub produktion kører på Pro eller Team plan minimum.**

Backups gemmes i Supabase's infrastruktur (AWS S3, same region).

---

### 8.2 Manuel Backup Procedure

**Brug inden migrations og vedligeholdelse:**

```bash
# Metode 1: pg_dump via Supabase connection string
pg_dump \
  --no-acl \
  --no-owner \
  --format=custom \
  --compress=9 \
  --file="chainhub_backup_$(date +%Y%m%d_%H%M%S).dump" \
  "$DATABASE_URL"

# Verificér backup-fil
pg_restore --list chainhub_backup_*.dump | head -20

# Metode 2: Supabase CLI
supabase db dump --db-url "$DATABASE_URL" -f chainhub_backup_$(date +%Y%m%d).sql

# Upload backup til sikker lokation
# Eksempel: Cloudflare R2 eller AWS S3
aws s3 cp chainhub_backup_*.dump s3://chainhub-backups/manual/
```

---

### 8.3 Point-in-Time Recovery (PITR)

Supabase Pro+ understøtter PITR med op til 14 dages historik (Team plan).

**PITR restore procedure:**

```
Trin 1: Identificér restore-tidspunkt
  → Notér præcist tidspunkt i UTC FØR hændelsen opstod
  → Eksempel: 2024-01-15T14:30:00Z (5 minutter FØR migration kørte)

Trin 2: Supabase Dashboard → Project → Settings → Backups
  → Klik "Point in Time Recovery"
  → Vælg dato og tidspunkt (UTC)
  → Klik "Review restore" → gennemgå hvad der gendannes

Trin 3: Bekræft restore
  → Supabase advarer: "This will replace your current database"
  → Skriv projekt-navn for at bekræfte
  → Klik "Restore"
  → Forventet varighed: 10-30 minutter afhængigt af database-størrelse

Trin 4: Overvåg restore
  → Supabase viser progress i dashboard
  → Du modtager email når restore er færdigt

Trin 5: Verificér database
  → psql $DATABASE_URL -c "SELECT COUNT(*) FROM companies;"
  → psql $DATABASE_URL -c "SELECT MAX(created_at) FROM contracts;"
  → Bekræft data ser fornuftigt ud for det valgte tidspunkt

Trin 6: Genstart app
  → Vercel Dashboard → Deployments → seneste → Redeploy
  → Bekræft app starter og kan tilgå database
```

**⚠️ ADVARSEL:** PITR overskriver HELE databasen. Al data oprettet
efter restore-tidspunktet går tabt. Kommunikér til brugere ved nedetid > 15 min.

---

### 8.4 Backup Verifikation

Verificér månedligt at backups kan gendannes:

```bash
# Test restore til separat database (IKKE produktion)
pg_restore \
  --dbname="postgresql://user:pass@localhost:5432/chainhub_restore_test" \
  --no-acl \
  --no-owner \
  chainhub_backup_YYYYMMDD.dump

# Kør basic sanity checks
psql $TEST_DATABASE_URL <<EOF
SELECT COUNT(*) as companies FROM companies;
SELECT COUNT(*) as contracts FROM contracts WHERE deleted_at IS NULL;
SELECT COUNT(*) as users FROM users;
SELECT MAX(created_at) as newest_record FROM audit_logs;
EOF
```

**Backup-log:** Dokumentér i ops-log at restore-test er gennemført.

---

### 8.5 Backup Retention Policy

| Type | Retention | Placering |
|------|-----------|-----------|
| Supabase automatisk backup | 14 dage (Team plan) | Supabase infra |
| Manuel backup (pre-migration) | 90 dage | Cloudflare R2 `chainhub-backups/manual/` |
| Manuel backup (månedlig) | 12 måneder | Cloudflare R2 `chainhub-backups/monthly/` |
| PITR | 14 dage | Supabase infra |

**Slet aldrig** pre-migration backups inden for 90 dage — de er eneste
mulighed for recovery hvis migration-fejl opdages sent.

---

## 9. Monitoring og Alerting

### 9.1 Vercel Analytics

Vercel Analytics giver performance-metrics for alle sider og API routes.

**Konfiguration:**
```bash
# .env.example (allerede dokumenteret)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="din-vercel-analytics-id"
```

**Setup i kode:**
```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Overvåg:**
- Core Web Vitals (LCP, FID, CLS)
- p95 load time pr. side (mål: < 2 sekunder)
- API route response times
- Function invocation counts og errors

---

### 9.2 Sentry Error Tracking

Sentry fanger alle uncaught exceptions på server og klient.

**Konfiguration:**
```bash
# .env.example
SENTRY_DSN="https://xxx@oyyy.ingest.sentry.io/zzz"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@oyyy.ingest.sentry.io/zzz"
SENTRY_ORG="chainhub"
SENTRY_PROJECT="chainhub-prod"
SENTRY_AUTH_TOKEN="sntrys_..."  # Til source maps upload i CI
```

**Sentry konfiguration (sentry.server.config.ts):**
```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,       // 10% af requests trackes
  profilesSampleRate: 0.1,
  beforeSend(event) {
    // Fjern PII fra fejlrapporter
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
    }
    return event
  },
})
```

**Overvåg i Sentry:**
- Alerts: Error rate > 1% → email til `ops@chainhub.dk`
- Alerts: P95 latency > 3s → email til `ops@chainhub.dk`
- Issues grupperes automatisk pr. fejltype

---

### 9.3 Alerting: payment_failed webhook

Når `invoice.payment_failed` eller `payment_intent.payment_failed` modtages,
sendes email-alert til ops-teamet.

**Implementation i webhook-handler:**
```typescript
// src/app/api/webhooks/stripe/route.ts (relevant uddrag)
case 'invoice.payment_failed': {
  const invoice = event.data.object as Stripe.Invoice

  // Log til Sentry med høj prioritet
  Sentry.captureEvent({
    message: 'Stripe payment_failed webhook modtaget',
    level: 'warning',
    tags: {
      webhook_event: 'invoice.payment_failed',
      customer_id: invoice.customer as string,
    },
    extra: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      attempt_count: invoice.attempt_count,
    },
  })

  // Send email-alert via Resend/SMTP
  await sendPaymentFailedAlert({
    customerId: invoice.customer as string,
    invoiceId: invoice.id,
    amountDue: invoice.amount_due,
    attemptCount: invoice.attempt_count ?? 0,
  })

  // Opdater abonnements-status i database
  await handlePaymentFailed(invoice)
  break
}
```

**Email-alert konfiguration:**
```bash
# .env.example (tilføj)
ALERT_EMAIL_TO="ops@chainhub.dk"
RESEND_API_KEY="re_..."  # Eller brug SMTP
```

**Sentry alert-regler (konfigurér i Sentry Dashboard):**
```
Alert: payment_failed
Trigger: Event message contains "payment_failed webhook"
Action: Send email to ops@chainhub.dk
Frequency: For every occurrence
```

---

### 9.4 Monitoring Dashboard

| Metric | Kilde | Alert-grænse | Modtager |
|--------|-------|-------------|----------|
| Error rate | Sentry | > 1% / 5 min | ops@chainhub.dk |
| P95 latency | Vercel Analytics | > 3 sekunder | ops@chainhub.dk |
| Database connections | Supabase Dashboard | > 80% af max | ops@chainhub.dk |
| Webhook fejlrate | Stripe Dashboard | Enhver fejl | ops@chainhub.dk |
| payment_failed | Stripe + Sentry | Enhver hændelse | ops@chainhub.dk |
| Cron job fejl | Vercel Cron Logs | Enhver fejl | ops@chainhub.dk |

---

### 9.5 Cron Job Monitoring

Cron jobs konfigureret i `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/task-digest", "schedule": "0 6 * * *" },
    { "path": "/api/cron/contract-expiry", "schedule": "0 7 * * *" },
    { "path": "/api/cron/subscription-sync", "schedule": "0 */6 * * *" }
  ]
}
```

**Verificér cron jobs kører:**
1. Vercel Dashboard → Project → Cron Jobs
2. Tjek "Last execution" og "Status" for hvert job
3. Ved fejl: tjek Vercel function logs for det specifikke cron-endpoint

---

## 10. Vercel Deployment

### 10.1 Standard deployment

```bash
# Deployment sker automatisk ved push til main
git push origin main

# Manuel deployment
vercel --prod
```

### 10.2 Ved ændring af environment variables

**VIGTIGT:** Vercel cacher environment variables ved build.

```
Trin 1: Vercel Dashboard → Project → Settings → Environment Variables
Trin 2: Rediger/tilføj variabel → Save
Trin 3: Vercel Dashboard → Project → Deployments
Trin 4: Find seneste deployment → "..." → "Redeploy"
Trin 5: "Redeploy with existing Build Cache" = NEJ (KRITISK)
Trin 6: Bekræft redeploy
```

### 10.3 Rollback procedure

```
Trin 1: Vercel Dashboard → Project → Deployments
Trin 2: Find seneste fungerende deployment (grøn status)
Trin 3: Klik "..." → "Promote to Production"
Trin 4: Bekræft — tager ~30 sekunder
Trin 5: Verificér app fungerer korrekt
```

---

## 11. Health Checks

### Automatisk health check endpoint

```
GET https://www.chainhub.dk/api/health
```

Returnerer:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T14:30:00Z",
  "database": "connected",
  "version": "1.0.0"
}
```

### Post-deployment tjekliste

```
□ App loader: https://www.chainhub.dk
□ Health endpoint: https://www.chainhub.dk/api/health → 200 OK, database: connected
□ Auth flow: Login med Microsoft → Dashboard → Logout → Login igen
□ Stripe webhook: Send test-event fra Stripe Dashboard → 200 OK
□ Cron jobs synlige i Vercel → Cron Jobs
□ Sentry modtager events (Sentry Dashboard → Issues)
□ Vercel Analytics viser trafik
□ Ingen røde alerts i monitoring-dashboard
```

---

## Changelog

| Dato | Version | Ændring |
|------|---------|---------|
| 2024-01-15 | 2.0 | Fuld Sprint 6 revision — alle fejlscenarier, PITR, secrets rotation, monitoring |
| 2024-01-01 | 1.0 | Initial RUNBOOK oprettet |