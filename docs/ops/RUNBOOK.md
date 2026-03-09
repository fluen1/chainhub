# ChainHub Operations Runbook
**Version:** 2.1 — Sprint 6 produktionsklar
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
12. [CI pipeline](#12-ci-pipeline)

---

## 1. Miljø-konfiguration

### Environment Variables

Alle environment variables er dokumenteret i `.env.example`. Ved deployment:

1. Kopiér `.env.example` til `.env.local` (lokal udvikling)
2. Sæt alle påkrævede variabler i Vercel dashboard (produktion)
3. `validate-env.ts` validerer ved startup og i CI — fejler hårdt ved manglende/ugyldige vars

### Kritiske variabler

| Variabel | Beskrivelse | Påkrævet |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) | Ja |
| `NEXTAUTH_URL` | App URL for NextAuth — `https://www.chainhub.dk` | Ja |
| `NEXTAUTH_SECRET` | Session encryption — **minimum 32 tegn** | Ja |
| `MICROSOFT_CLIENT_ID` | Azure AD Application (client) ID | Ja |
| `MICROSOFT_CLIENT_SECRET` | Azure AD client secret value | Ja |
| `MICROSOFT_TENANT_ID` | Azure AD Directory (tenant) ID | Ja |
| `STRIPE_SECRET_KEY` | Stripe API key | Prod |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Prod |
| `SENTRY_DSN` | Sentry error tracking (serverside) | Prod |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (klientside) | Prod |
| `SENTRY_AUTH_TOKEN` | Sentry source maps upload i CI | Prod |
| `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` | Vercel Analytics | Prod |
| `ALERT_EMAIL_TO` | Modtager af payment_failed alerts | Prod |
| `RESEND_API_KEY` | Transaktionel email via Resend | Prod |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (Upstash Redis) | Prod |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting auth token | Prod |

---

## 2. Kritiske advarsler

### ⚠️ KRITISK: Stripe Webhook URL SKAL have www-prefix

**Problem:** Stripe webhooks fejler STILLE hvis URL mangler `www`-prefix.

Stripe sender POST-request til den konfigurerede URL. Hvis `chainhub.dk` redirecter
til `www.chainhub.dk` via HTTP 301, modtager Stripe en redirect-response og
**opgiver øjeblikkeligt** — webhook markeres som fejlet uden at én linje applikationskode
nogensinde kører. Dette er en HTTP-protokol-begrænsning: POST-requests følger ikke
301-redirects automatisk.

**Konfigurér i Stripe Dashboard → Developers → Webhooks → Add endpoint:**

```
✅ KORREKT:  https://www.chainhub.dk/api/webhooks/stripe
❌ FORKERT:  https://chainhub.dk/api/webhooks/stripe
```

**Verifikation:**
1. Stripe Dashboard → Developers → Webhooks → vælg endpoint
2. Bekræft URL starter med `https://www.`
3. Klik "Send test event" → vælg `payment_intent.succeeded`
4. Verificér `200 OK` i Stripe event log inden for 5 sekunder
5. Verificér log-entry i Vercel function logs for `/api/webhooks/stripe`
6. Verificér Sentry ikke logger fejl

**Berørte webhook events (konfigurér alle i Stripe Dashboard):**
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

NextAuth afviser secrets kortere end 32 tegn. Resultatet er at **alle sessioner fejler**
og ingen brugere kan logge ind.

**Generér korrekt secret:**
```bash
openssl rand -base64 32
# Eksempel output: K8mP2xR7vN4jL9qA1eW5cY3uB6hD0sF8gZ==
```

**Validér længde:**
```bash
echo -n "din-secret-her" | wc -c
# Skal returnere ≥ 32
```

`validate-env.ts` validerer dette automatisk ved startup og i CI. En fejlet validering
stopper applikationen med en klar fejlbesked.

---

### ⚠️ KRITISK: STRIPE_WEBHOOK_SECRET — ingen trailing whitespace

Kopiér webhook secret præcis fra Stripe Dashboard. Trailing newlines eller spaces
forårsager stille signaturfejl — webhook modtages med HTTP 200 men HMAC-validering
fejler og eventet ignoreres.

Koden trimmer automatisk for at beskytte mod copy-paste fejl:
```typescript
process.env.STRIPE_WEBHOOK_SECRET?.trim()
```

Men den korrekte løsning er at sikre at `.env.local` og Vercel Dashboard ikke
har whitespace i secrets.

---

## 3. Fejlscenarie: Databasen er nede

### Symptomer
- HTTP 500 på alle sider undtagen statiske assets og `/api/health`
- Sentry alerts: `PrismaClientKnownRequestError`, `PrismaClientInitializationError` eller `Connection refused`
- Vercel function logs: database connection timeout efter ~10 sekunder
- Health endpoint returnerer `{ "database": "disconnected" }`

### Trin 1: Bekræft problemet

```bash
# Test database-forbindelse direkte fra terminal
psql "$DATABASE_URL" -c "SELECT 1 AS alive;"
# Forventet: alive: 1
# Fejl: "Connection refused" eller timeout

# Tjek Supabase platform-status
# → https://status.supabase.com/
# Kig efter "Database" eller "API" incidents

# Tjek app health endpoint
curl https://www.chainhub.dk/api/health
# Forventet: { "status": "ok", "database": "connected" }
# Ved fejl: { "status": "error", "database": "disconnected" }
```

### Trin 2: Tjek Supabase Dashboard

1. Log ind på [app.supabase.com](https://app.supabase.com)
2. Vælg `chainhub-prod` projekt
3. Gå til **Reports → Database** — tjek CPU, memory, disk I/O
4. Gå til **Logs → Postgres** — søg efter ERROR eller FATAL
5. Gå til **Settings → Database** — tjek Database health og Connection pool status

### Trin 3: Diagnosticér connection pool

Supabase bruger PgBouncer som connection pooler. Overskredne connection limits
er hyppig årsag til fejl i serverless-miljøer:

```sql
-- Kør i Supabase SQL Editor (Settings → SQL Editor)

-- Antal aktive connections
SELECT COUNT(*) AS active_connections FROM pg_stat_activity WHERE state != 'idle';

-- Max connections sat på databasen
SHOW max_connections;

-- Connections per applikation
SELECT application_name, COUNT(*) AS count, state
FROM pg_stat_activity
GROUP BY application_name, state
ORDER BY count DESC;
```

**Hvis connection count er > 80% af max:**

1. Supabase → Settings → Database → Connection Pooling
2. Verificér **Pool Mode = Transaction** (påkrævet for serverless/Vercel)
3. Reducér `connection_limit` i DATABASE_URL:
   ```
   DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
   ```
4. Redeploy uden build cache

### Trin 4: Dræb hængende processer

```sql
-- Find processer der har kørt mere end 5 minutter
SELECT pid, query_start, state, query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';

-- Dræb specifikke processer (erstat PID med faktisk process-ID)
SELECT pg_terminate_backend(12345);

-- Dræb ALLE hængende processer (brug med forsigtighed)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes'
  AND pid != pg_backend_pid();
```

### Trin 5: Restart database (Supabase)

1. Supabase Dashboard → Settings → General
2. Scroll ned til **"Restart Database"**
3. Bekræft restart
4. **Forventet nedetid: ~30 sekunder**
5. Overvåg `/api/health` hvert 10. sekund til den returnerer `"database": "connected"`

### Trin 6: Failover ved regionalt outage (nedetid > 15 min)

1. Tjek [status.supabase.com](https://status.supabase.com) for regional incident
2. Kontakt Supabase support via [supabase.com/support](https://supabase.com/support) med:
   - Projekt-reference (find under Settings → General → Reference ID)
   - Tidspunkt for fejl (UTC)
   - Fejlbeskeder fra logs
3. Kommunikér status til brugere:
   - Opdater statusside (hvis implementeret)
   - Send email til primære kontakter i berørte organisationer

### Post-incident verifikation

```
□ psql $DATABASE_URL -c "SELECT 1;" returnerer svar
□ https://www.chainhub.dk/api/health → { "status": "ok", "database": "connected" }
□ Sentry viser ikke nye database-fejl (tjek 5 minutter frem)
□ Test: log ind med Microsoft og gennemfør én CRUD-operation
□ Tjek at cron jobs kører som normalt (Vercel → Cron Jobs)
□ Dokumentér incident i ops-log: tidspunkt, årsag, handling, varighed
```

---

## 4. Fejlscenarie: Stripe webhook fejler

### Symptomer
- Stripe Dashboard → Webhooks → endpoint viser fejlede events (rød status)
- Betalinger gennemføres i Stripe men abonnement aktiveres ikke i ChainHub
- Sentry alert: `payment_failed` webhook event logget
- Email-alert modtaget på `ops@chainhub.dk`
- Kunder rapporterer at de har betalt men ikke har adgang

### Trin 1: Identificér fejltype i Stripe Dashboard

1. Stripe Dashboard → Developers → Webhooks → vælg endpoint
2. Klik på det fejlede event
3. Se HTTP status i "Response" kolonnen:

| HTTP Status | Årsag | Trin |
|-------------|-------|------|
| Timeout / ingen response | URL-problem (www-prefix?) | Trin 2 |
| 400 / 401 | Signaturfejl — forkert webhook secret | Trin 3 |
| 404 | Forkert URL-sti | Trin 2 |
| 500 | Serverfejl i webhook-handler | Trin 4 |
| 503 | App nede eller overtastet | Trin 5 |

### Trin 2: Verificér www-prefix i webhook URL — KRITISK

Dette er den hyppigste årsag til tavse webhook-fejl.

```
Stripe SKAL kalde: https://www.chainhub.dk/api/webhooks/stripe
                                ^^^
                         www SKAL være her
```

**Verificér og ret:**
1. Stripe Dashboard → Webhooks → vælg endpoint → "Edit endpoint"
2. Tjek URL-feltet
3. Hvis URL er `https://chainhub.dk/...` → ret til `https://www.chainhub.dk/...`
4. Gem ændringen
5. Send test-event: klik "Send test event" → `payment_intent.succeeded`
6. Verificér `200 OK` i response

### Trin 3: Ret webhook signaturfejl (400/401)

Stripe signerer alle webhook-requests med `STRIPE_WEBHOOK_SECRET`. Mismatch giver
stille signaturvaliderings-fejl.

```bash
# Verificér at secret i Vercel matcher Stripe Dashboard
# Stripe Dashboard → Developers → Webhooks → vælg endpoint → "Reveal" ved Signing secret

# Trin:
# 1. Kopiér signing secret fra Stripe (starter med whsec_)
# 2. Vercel Dashboard → Project → Settings → Environment Variables
# 3. Find STRIPE_WEBHOOK_SECRET → Edit
# 4. Indsæt ny secret (UDEN trailing whitespace/newlines)
# 5. Save → Redeploy UDEN build cache
```

**Alternativt: rullér webhook secret:**
```
Stripe Dashboard → Webhooks → endpoint → "Roll secret"
→ Kopiér ny secret øjeblikkeligt (vises kun én gang)
→ Opdater STRIPE_WEBHOOK_SECRET i Vercel
→ Redeploy uden build cache
→ Send test-event og verificér 200
```

### Trin 4: Diagnosticér serverfejl (500)

```bash
# Tjek Vercel function logs for webhook-endpoint
# Vercel Dashboard → Project → Functions → /api/webhooks/stripe

# Eller via Vercel CLI:
vercel logs --prod --filter=/api/webhooks/stripe

# Tjek Sentry for stack trace
# Sentry Dashboard → Issues → filtrer på webhook

# Hyppige årsager:
# - Database nede (se §3)
# - Prisma timeout under event-behandling
# - Ukendt event-type ikke håndteret i switch-statement
# - Manglende environment variable (STRIPE_SECRET_KEY etc.)
```

### Trin 5: Tjek om app er nede

```bash
curl -I https://www.chainhub.dk/api/health
# Forventet: HTTP/2 200

# Hvis 503/504: se §3 (database) eller §10 (Vercel deployment)
```

### Trin 6: Genafspil fejlede events

Stripe gemmer alle events i 30 dage og tillader genafspilning:

1. Stripe Dashboard → Developers → Webhooks → endpoint
2. Klik på fejlet event → "Resend"
3. Verificér `200 OK` i response
4. Gentag for alle fejlede events

**VIGTIGT — Idempotens:** Webhook-handler skal tolerere at modtage samme event
flere gange. Kontrollér at `event.id` gemmes i database og dublet-tjekkes:

```typescript
// Pseudokode — verificér dette er implementeret i /api/webhooks/stripe/route.ts
const existingEvent = await prisma.stripeWebhookEvent.findUnique({
  where: { stripeEventId: event.id }
})
if (existingEvent) {
  return new Response('Already processed', { status: 200 })
}
```

### Trin 7: payment_failed — manuel opfølgning

Når `invoice.payment_failed` eller `payment_intent.payment_failed` modtages:

1. Email-alert er sendt automatisk til `ops@chainhub.dk`
2. Log ind på Stripe Dashboard → Customers → find kunden
3. Tjek årsag til fejl under "Payment method" (kort udløbet, insufficient funds etc.)
4. Stripe sender automatisk retry (standard: 3 forsøg over 7 dage med smart retry)
5. Kontakt kunden proaktivt ved 2. fejlede forsøg
6. Efter 3 fejlede forsøg: abonnement sættes til `past_due` → herefter `canceled`
7. Opdatér abonnements-status manuelt i ChainHub hvis sync er fejlet:

```sql
-- Kør i Supabase SQL Editor — erstat værdier
UPDATE subscriptions
SET status = 'past_due', updated_at = NOW()
WHERE stripe_customer_id = 'cus_XXXXXXXX';
```

### Post-incident verifikation

```
□ Stripe Dashboard viser 200 på seneste test-event
□ Alle fejlede events er genafspillet med 200 response
□ Abonnements-status i ChainHub database matcher Stripe Dashboard
□ Ingen aktive Sentry alerts for webhook-fejl
□ Email-alerting fungerer (test ved at sende mock payment_failed event)
□ Dokumentér incident i ops-log
```

---

## 5. Fejlscenarie: Migration fejler i produktion

### ⚠️ ADVARSEL: Tag ALTID backup FØR migration i produktion

**Obligatorisk procedure inden enhver produktions-migration:**
1. Tag manuel backup (se §8.2)
2. Notér præcist backup-tidspunkt (UTC)
3. Kør og test migration i lokalt miljø
4. Kør og test migration i staging-miljø
5. Deploy til produktion i lav-trafik periode (typisk kl. 02:00-06:00 CET)

### Symptomer
- CI/CD pipeline fejler på "Run database migrations" trin
- App returnerer `PrismaClientKnownRequestError: The column/table does not exist`
- Deployment fejler halvvejs — app er i inkonsistent tilstand
- `prisma migrate status` viser `❌ Failed` migration

### Trin 1: Tjek migration-status

```bash
# Forbind til produktionsdatabase og tjek status
DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate status

# Output-fortolkning:
# ✅ Applied      — migration kørt succesfuldt
# ⏳ Pending      — migration afventer kørsel
# ❌ Failed       — migration startede men fejlede
# ⚠️  Not in sync — lokale migrationer matcher ikke database
```

### Trin 2: Tjek for låste tabeller og hængende processer

```sql
-- Kør i Supabase SQL Editor
-- Find aktivt ventende processer (kan blokere migrations)
SELECT
  pid,
  now() - query_start AS duration,
  query,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Tjek for tabel-locks
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.query AS blocked_statement,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.pid != blocked_locks.pid
  AND blocking_locks.granted
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Dræb blokerende processer
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes'
  AND pid != pg_backend_pid();
```

### Trin 3: Manuel rollback

Prisma understøtter ikke automatisk rollback. Vælg strategi afhængigt af migrationstype:

**Strategi A — Migration tilføjede nye kolonner/tabeller (ingen data-tab):**
```sql
-- Kør i Supabase SQL Editor
-- Eksempel: fjern kolonne tilføjet af fejlet migration
ALTER TABLE contracts DROP COLUMN IF EXISTS new_column_name;
DROP TABLE IF EXISTS new_table_name;

-- Fjern migration fra Prismas tracking-tabel
DELETE FROM _prisma_migrations
WHERE migration_name = '20240115000000_add_new_column';

-- Verificér
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;
```

**Strategi B — Kompleks migration, destruktive ændringer, eller data er korrupt:**

Brug Point-in-Time Recovery (se §8.3).

```
1. Notér restore-tidspunkt: FØR migrationen startede (brug backup-tidspunktet fra forberedelsen)
2. Følg PITR-procedure i §8.3
3. Al data oprettet EFTER backup-tidspunktet går tabt — kommunikér til brugere
4. Ret migrationen og kør igen (se Trin 4)
```

### Trin 4: Ret og genimplementér migration

```bash
# ALDRIG: rediger en eksisterende migration-fil der har kørt i produktion
# ALTID: opret ny migration der retter fejlen

# Lokal reparation
npx prisma migrate dev --name fix_failed_migration_name
# Gennemgå den genererede SQL i /prisma/migrations/[timestamp]_fix_[name]/migration.sql

# Test i staging
DATABASE_URL="$STAGING_DATABASE_URL" npx prisma migrate deploy

# Deploy til produktion
DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate deploy

# Verificér
DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate status
# Alle migrationer skal vise ✅ Applied
```

### Sikker migrations-checkliste

```
□ Migration testet i lokalt miljø (npx prisma migrate dev)
□ Migration testet i staging-miljø (npx prisma migrate deploy)
□ Manuel database-backup taget og backup-tidspunkt noteret (UTC)
□ Migration er ikke destruktiv (fjerner ikke kolonner med eksisterende data)
□ Migration er idempotent (kan køres igen uden yderligere skade)
□ Rollback-plan klar og testet inden deploy starter
□ Deployment planlagt i lav-trafik periode
□ On-call person tilgængelig under deployment
□ App testet grundigt i staging EFTER migration
□ Monitorer Sentry og Vercel logs i 15 minutter post-deployment
```

---

## 6. Fejlscenarie: Bruger kan ikke logge ind med Microsoft

### Symptomer
- Bruger omdirigeres til Microsoft login men returneres med fejlside
- `AADSTS...`-fejlkoder vises i browseren eller URL
- NextAuth fejl i Sentry: `OAuthCallbackError`, `OAuthSignin` eller `Callback`
- Bruger sidder fast på `/api/auth/error?error=...`

### Trin 1: Identificér fejlkode

| Fejlkode | Årsag | Løsning |
|----------|-------|---------|
| `AADSTS50011` | Reply URL (redirect URI) ikke registreret i Azure | Trin 2 |
| `AADSTS700016` | Application (client) ID er forkert eller slettet | Trin 3 |
| `AADSTS7000215` | Client secret er udløbet | Trin 4 |
| `AADSTS65001` | Manglende admin-samtykke til app-permissions | Trin 5 |
| `AADSTS50020` | Bruger tilhører en anden Azure AD tenant | Trin 6 |
| `Configuration` | Manglende eller tomme environment variables | Trin 7 |
| `OAuthCallback` | NEXTAUTH_SECRET-fejl eller session-problem | Trin 8 |

### Trin 2: Reply URL matcher ikke (AADSTS50011)

Azure AD afviser login hvis callback-URL ikke er registreret i app-registreringen.

1. Azure Portal ([portal.azure.com](https://portal.azure.com))
2. Azure Active Directory → App registrations → ChainHub
3. Authentication → Redirect URIs
4. Verificér følgende URIs er registreret:
   ```
   https://www.chainhub.dk/api/auth/callback/microsoft-entra-id
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   ```
5. Tilføj manglende URI → Save
6. Ændringen træder i kraft øjeblikkeligt — test login igen

**OBS:** URLen skal matche præcist — inkl. protokol, domæne, sti og store/små bogstaver.

### Trin 3: Forkert Client ID (AADSTS700016)

```bash
# Verificér MICROSOFT_CLIENT_ID i Vercel:
# Vercel Dashboard → Project → Settings → Environment Variables → MICROSOFT_CLIENT_ID

# Sammenlign med Azure Portal:
# Azure Active Directory → App registrations → ChainHub
# → "Application (client) ID" under Overview

# De skal matche præcist (UUID-format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
```

### Trin 4: Udløbet Client Secret (AADSTS7000215)

Azure AD client secrets udløber (typisk efter 12-24 måneder afhængigt af konfiguration).

```
Trin 4a: Azure Portal → App registrations → ChainHub → Certificates & secrets
Trin 4b: Tjek "Expires" kolonne — er secret udløbet?
Trin 4c: "+ New client secret"
  → Description: "ChainHub Prod [ÅÅÅÅ-MM]"
  → Expires: "24 months" (anbefalet)
  → Add
Trin 4d: KOPIÉR "Value" kolonnen ØJEBLIKKELIGT
          (vises kun én gang — siden siden genindlæses er den væk)
Trin 4e: Vercel Dashboard → MICROSOFT_CLIENT_SECRET → Edit → indsæt ny value
Trin 4f: Save → Redeploy UDEN build cache
Trin 4g: Test login i incognito-vindue
Trin 4h: Slet gammelt secret i Azure Portal (valgfrit men god praksis)
Trin 4i: Tilføj kalenderpåmindelse: 30 dage inden nyt secrets udløb
```

### Trin 5: Manglende admin-samtykke (AADSTS65001)

Kræves når app bruger permissions der kræver administrator-godkendelse.

1. Azure Portal → Enterprise Applications → ChainHub
2. Permissions → "Grant admin consent for [tenant-navn]"
3. Log ind som Global Administrator og godkend
4. Test login med almindelig bruger

### Trin 6: Bruger fra forkert tenant (AADSTS50020)

ChainHub accepterer kun brugere fra den konfigurerede `MICROSOFT_TENANT_ID`.

```typescript
// Verificér i src/lib/auth/config.ts at tenant-check er aktivt:
if (account?.tenantId !== process.env.MICROSOFT_TENANT_ID) {
  return false  // Bruger fra anden tenant afvises
}
```

**Løsning:** Tilføj brugeren til den korrekte Azure AD tenant, eller kontakt Azure-administrator.

### Trin 7: Manglende environment variables

```bash
# Verificér at ALLE fire Microsoft-variabler er sat i Vercel:
MICROSOFT_CLIENT_ID     ← Azure Application (client) ID
MICROSOFT_CLIENT_SECRET ← Azure Client secret VALUE (ikke ID)
MICROSOFT_TENANT_ID     ← Azure Directory (tenant) ID
NEXTAUTH_URL            ← https://www.chainhub.dk (med www!)

# NEXTAUTH_URL uden www giver callback-fejl selv om Azure-config er korrekt
```

### Trin 8: NextAuth session fejl

```bash
# Tjek at NEXTAUTH_SECRET er identisk på alle Vercel-instanser
# Vercel Dashboard → Settings → Environment Variables → NEXTAUTH_SECRET
# Skal være sat til "Production" miljø

# Tjek at secret er minimum 32 tegn:
# Vercel → NEXTAUTH_SECRET → "reveal" → tæl tegn

# Generer ny secret hvis nødvendigt:
openssl rand -base64 32
# Opdater i Vercel → Redeploy uden build cache
```

### Post-incident verifikation

```
□ Testbruger kan gennemføre Microsoft login uden fejl
□ Omdirigering til /dashboard fungerer efter login
□ Session persisterer ved side-reload
□ Logout fungerer korrekt
□ Login igen fungerer efter logout
□ Ingen OAuthCallbackError i Sentry
□ Dokumentér incident: fejlkode, årsag, løsning
```

---

## 7. Secrets Rotation

### 7.1 NEXTAUTH_SECRET Rotation

**Krav:** Minimum 32 tegn. Kortere secrets afvises af NextAuth og bryder al auth.

**Effekt ved rotation:** Alle eksisterende bruger-sessioner invalideres øjeblikkeligt.
Alle brugere skal logge ind igen. Planlæg rotation i lav-trafik periode og kommunikér
til brugere i advance.

```bash
# Trin 1: Generér ny secret
openssl rand -base64 32
# Eksempel: K8mP2xR7vN4jL9qA1eW5cY3uB6hD0sF8gZ==

# Trin 2: Validér længde (SKAL være ≥ 32)
echo -n "K8mP2xR7vN4jL9qA1eW5cY3uB6hD0sF8gZ==" | wc -c
# Forventet: 44 (eller mere)
```

```
Trin 3: Opdater i Vercel Dashboard
  → Project → Settings → Environment Variables
  → NEXTAUTH_SECRET → Edit
  → Indsæt ny secret (tjek der ikke er leading/trailing spaces)
  → Vælg Environment: Production
  → Save

Trin 4: Redeploy UDEN build cache
  → Vercel Dashboard → Deployments → seneste → "..."
  → "Redeploy" → deaktivér "Redeploy with existing Build Cache"
  → Confirm

Trin 5: Vent på deployment (typisk 1-2 minutter)

Trin 6: Test i incognito-vindue
  → Åbn https://www.chainhub.dk i incognito
  → Gennemfør Microsoft login
  → Bekræft redirect til /dashboard
  → Bekræft session fungerer ved reload

Trin 7: Verificér ingen Sentry-fejl de næste 10 minutter
```

**Rotations-interval:** Mindst én gang om året. Obligatorisk ved mistanke om
kompromittering eller ved medarbejder-fratrædelse med adgang til Vercel.

---

### 7.2 STRIPE_WEBHOOK_SECRET Rotation

```
Trin 1: Stripe Dashboard → Developers → Webhooks → vælg endpoint
Trin 2: Klik "Roll secret" → bekræft i dialog

  OBS: Stripe accepterer BEGGE secrets (gammelt og nyt) i ~10 minutter
       under rotation. Deploy hurtigt for at minimere overlap.

Trin 3: Kopiér ny secret ØJEBLIKKELIGT
  → Starter med "whsec_"
  → Vises KUN én gang

Trin 4: Vercel Dashboard → STRIPE_WEBHOOK_SECRET → Edit
  → Indsæt ny secret
  → Tjek: ingen trailing spaces eller newlines
  → Save

Trin 5: Redeploy UDEN build cache

Trin 6: Verificér i Stripe Dashboard
  → Send test event: "payment_intent.succeeded"
  → Verificér 200 OK response

Trin 7: Overvåg Sentry i 10 minutter
  → Ingen nye webhook-signatur-fejl

Trin 8: Dokumentér rotation i ops-log (dato, udført af)
```

---

### 7.3 MICROSOFT_CLIENT_SECRET Rotation

```
Trin 1: Azure Portal → App registrations → ChainHub → Certificates & secrets
Trin 2: "+ New client secret"
  → Description: "ChainHub Prod [ÅÅÅÅ-MM] rotation"
  → Expires: 24 months
  → Add
Trin 3: KOPIÉR "Value" kolonnen ØJEBLIKKELIGT (vises kun én gang)

Trin 4: Vercel Dashboard → MICROSOFT_CLIENT_SECRET → Edit
  → Indsæt ny secret VALUE (ikke ID!)
  → Save

Trin 5: Redeploy UDEN build cache

Trin 6: Test login med Microsoft i incognito-vindue
  → Gennemfør fuldt login-flow
  → Bekræft session og dashboard-adgang

Trin 7: Slet GAMMELT secret i Azure Portal
  → Certificates & secrets → find gammelt secret → Delete

Trin 8: Sæt kalenderpåmindelse 30 dage inden nyt secrets udløb
Trin 9: Dokumentér rotation i ops-log
```

---

### 7.4 STRIPE_SECRET_KEY Rotation

**⚠️ KRITISK:** Rotation af Stripe secret key er destruktivt. Den gamle nøgle
holder op med at virke øjeblikkeligt. Brug KUN ved sikkerhedshændelse.

```
Trin 1: Informér on-call og afventende brugere om kort afbrydelse

Trin 2: Stripe Dashboard → Developers → API keys
  → "Roll key" ved Secret key
  → Bekræft — gammel nøgle virker IKKE mere efter dette punkt

Trin 3: Kopiér ny secret key (starter med "sk_live_")

Trin 4: Vercel Dashboard → STRIPE_SECRET_KEY → Edit
  → Indsæt ny key → Save

Trin 5: Redeploy UDEN build cache

Trin 6: Test betalingsflow med test-kort (i staging)
  → Verificér abonnements-oprettelse
  → Verificér abonnements-status kan hentes fra Stripe API

Trin 7: Overvåg Sentry og Vercel logs i 15 minutter

Trin 8: Dokumentér i ops-log med tidspunkt og årsag
```

---

### 7.5 Samlet Rotation Checkliste

```
□ Ny secret genereret med korrekt format og længde
□ Secret verificeret: ingen leading/trailing whitespace
□ Secret opdateret i Vercel Dashboard (korrekt environment: Production)
□ Redeploy udført UDEN build cache
□ Funktionalitet testet post-rotation (login / webhook / betaling)
□ Ingen nye Sentry-fejl 10 minutter efter rotation
□ Gammel secret invalideret/slettet (Azure / Stripe)
□ Rotation dokumenteret i ops-log: dato, udført af, årsag
□ Næste rotationsdato tilføjet til team-kalender
□ Berørte teammedlemmer notificeret om session-invalidering (NEXTAUTH_SECRET)
```

---

## 8. Database Backup og Point-in-Time Recovery

### 8.1 Supabase Automatisk Backup

Supabase tager automatiske daglige backups på alle betalte planer.

| Plan | Backup-frekvens | Retention | Point-in-time Recovery |
|------|----------------|-----------|------------------------|
| Free | Daglig | 7 dage | Nej |
| Pro | Daglig | 7 dage | Ja (7 dage) |
| Team | Daglig | 14 dage | Ja (14 dage) |
| Enterprise | Daglig | 30 dage | Ja (30 dage) |

**ChainHub produktion kræver minimum Pro plan.** Team plan anbefales for 14 dages PITR.

Backups gemmes i Supabase's infrastruktur (AWS S3, same region som projektet).
Backup-status kan verificeres under Supabase Dashboard → Settings → Backups.

---

### 8.2 Manuel Backup Procedure

**Udføres obligatorisk inden migrations og planlagt vedligeholdelse.**

```bash
# Metode 1: pg_dump (anbefalet — custom format for effektiv restore)
BACKUP_FILE="chainhub_backup_$(date -u +%Y%m%d_%H%M%S_UTC).dump"

pg_dump \
  --no-acl \
  --no-owner \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_FILE" \
  "$DATABASE_URL"

echo "Backup gemt: $BACKUP_FILE"

# Verificér backup-filen er gyldig og ikke tom
ls -lh "$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE" | head -20

# Upload til sikker opbevaring
aws s3 cp "$BACKUP_FILE" "s3://chainhub-backups/manual/$BACKUP_FILE"

# Notér tidspunkt og filnavn i ops-log
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) — Manuel backup: $BACKUP_FILE" >> ops-log.txt
```

```bash
# Metode 2: Supabase CLI (alternativ)
supabase db dump \
  --db-url "$DATABASE_URL" \
  -f "chainhub_backup_$(date -u +%Y%m%d_%H%M%S_UTC).sql"
```

---

### 8.3 Point-in-Time Recovery (PITR)

Supabase Pro+ understøtter PITR med op til 14 dages historik (Team plan).
PITR overskriver hele databasen — al data efter restore-tidspunktet går tabt.

**PITR restore-procedure:**

```
Trin 1: Identificér restore-tidspunkt
  → Notér tidspunktet FØR hændelsen opstod (fx FØR migration startede)
  → Tidspunkt skal angives i UTC
  → Eksempel: 2024-01-15T14:25:00Z
    (hvis migration startede kl. 14:30 UTC, vælg 14:25 for 5 minutters margin)

Trin 2: Kommunikér planlagt nedetid
  → Estimeret nedetid: 15-45 minutter afhængigt af database-størrelse
  → Notificér primære kontakter i alle organisationer

Trin 3: Sæt app i maintenance mode
  → Vercel Dashboard → Project → Settings → Domain
  → Eller: deploy en statisk maintenance-side midlertidigt

Trin 4: Start PITR restore
  → Supabase Dashboard → Project → Settings → Backups
  → Klik "Point in Time Recovery"
  → Vælg dato og klokkeslæt (UTC)
  → Klik "Review restore"
  → Gennemgå hvad der gendannes og hvad der mistes
  → Skriv projekt-navn for at bekræfte
  → Klik "Restore"

Trin 5: Overvåg restore-progress
  → Supabase viser fremgang i Dashboard
  → Du modtager email ved færdiggørelse
  → Typisk varighed: 10-30 minutter

Trin 6: Verificér database efter restore
  → psql $DATABASE_URL -c "SELECT COUNT(*) FROM companies;"
  → psql $DATABASE_URL -c "SELECT COUNT(*) FROM contracts WHERE deleted_at IS NULL;"
  → psql $DATABASE_URL -c "SELECT MAX(created_at) FROM users;"
  → Bekræft data ser korrekt ud for det valgte tidspunkt

Trin 7: Genstart applikationen
  → Vercel Dashboard → Deployments → seneste → Redeploy
  → Fjern maintenance mode

Trin 8: Post-restore verifikation
  → Test login og CRUD-operationer
  → Tjek Sentry for nye fejl
  → Kør npx prisma migrate status (verificér migrationer er synkroniserede)

Trin 9: Dokumentér i ops-log
  → Tidspunkt for hændelse, restore-tidspunkt valgt, varighed, data-tab estimat
```

---

### 8.4 Backup Verifikation (månedlig)

Backups er kun værdifulde hvis de faktisk kan gendannes. Verificér månedligt:

```bash
# Test restore til SEPARAT test-database (ALDRIG til produktion!)
# Opret midlertidig Supabase-database til test

TEST_DB_URL="postgresql://test_user:test_pass@test.supabase.co:5432/postgres"
BACKUP_FILE="chainhub_backup_YYYYMMDD.dump"

pg_restore \
  --dbname="$TEST_DB_URL" \
  --no-acl \
  --no-owner \
  --verbose \
  "$BACKUP_FILE"

# Kør sanity checks
psql "$TEST_DB_URL" <<'EOF'
SELECT 'companies' AS tabel, COUNT(*) AS antal FROM companies
UNION ALL
SELECT 'contracts', COUNT(*) FROM contracts WHERE deleted_at IS NULL
UNION ALL
SELECT 'cases', COUNT(*) FROM cases WHERE deleted_at IS NULL
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'audit_logs_newest', EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int FROM audit_logs;
EOF

# Slet test-database efter verificering
# Dokumentér i ops-log: dato, backup-fil testet, resultat
```

---

### 8.5 Backup Retention Policy

| Type | Frekvens | Retention | Placering |
|------|----------|-----------|-----------|
| Supabase automatisk backup | Daglig | 14 dage (Team plan) | Supabase infra (AWS S3) |
| Manuel backup (pre-migration) | Før hver migration | 90 dage | Cloudflare R2: `chainhub-backups/manual/` |
| Manuel backup (månedlig) | 1. dag i måneden | 12 måneder | Cloudflare R2: `chainhub-backups/monthly/` |
| PITR | Kontinuerlig | 14 dage (Team plan) | Supabase infra |

**Regler:**
- Slet **aldrig** pre-migration backups inden for 90 dage
- Månedlige backups slettes automatisk efter 12 måneder (lifecycle policy på R2)
- Backup-verifikation udføres den 1. i hver måned
- Backup-status og verifikation dokumenteres i ops-log

---

## 9. Monitoring og Alerting

### 9.1 Vercel Analytics

Vercel Analytics giver realtids-performance-metrics for alle sider og API routes.

**Setup i `src/app/layout.tsx`:**
```typescript
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="da">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Konfiguration (automatisk i Vercel-miljø):**
```bash
# .env.example (allerede dokumenteret)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="din-analytics-id"
```

**Metrics at overvåge (Vercel Dashboard → Analytics):**
- **Core Web Vitals:** LCP < 2.5s, CLS < 0.1, FID < 100ms
- **p95 load time** pr. side — mål: < 2 sekunder
- **API route response times** — mål: < 500ms for mutations
- **Function invocations og errors** — spike i errors = alarm
- **Bandwidth og request count** — uventet spike kan indikere angreb

---

### 9.2 Sentry Error Tracking

Sentry fanger alle uncaught exceptions på server og klient med full stack traces.

**Nødvendige pakker:**
```bash
npm install @sentry/nextjs
```

**`sentry.server.config.ts`:**
```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // 10% af requests trackes for performance (øg til 100% ved debugging)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Fjern PII fra fejlrapporter (GDPR)
  beforeSend(event) {
    if (event.user) {
      // Behold user ID til debugging, fjern identificerende info
      event.user = { id: event.user.id }
    }
    return event
  },

  // Ignorer støjende non-actionable fejl
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
  ],
})
```

**`sentry.client.config.ts`:**
```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    if (event.user) {
      event.user = { id: event.user.id }
    }
    return event
  },
})
```

**Alert-regler (konfigurér i Sentry Dashboard → Alerts):**

| Alert | Trigger | Handling |
|-------|---------|---------|
| Error spike | Error rate > 1% over 5 minutter | Email til ops@chainhub.dk |
| High latency | P95 > 3 sekunder | Email til ops@chainhub.dk |
| New issue | Ny unik fejltype opstår | Email til ops@chainhub.dk |
| payment_failed | Message contains "payment_failed webhook" | Email til ops@chainhub.dk + Slack |
| Database error | PrismaClientKnownRequestError > 10/min | Email til ops@chainhub.dk |

---

### 9.3 Alerting: payment_failed webhook

Når `invoice.payment_failed` eller `payment_intent.payment_failed` modtages
af webhook-handleren, sendes automatisk email-alert til ops-teamet.

**Implementering i `src/app/api/webhooks/stripe/route.ts`:**
```typescript
import * as Sentry from '@sentry/nextjs'
import { sendPaymentFailedAlert } from '@/lib/email/alerts'

// Inde i switch-statement for Stripe events:
case 'invoice.payment_failed': {
  const invoice = event.data.object as Stripe.Invoice

  // Log til Sentry med høj prioritet
  Sentry.captureEvent({
    message: 'Stripe payment_failed webhook modtaget',
    level: 'warning',
    tags: {
      webhook_event: 'invoice.payment_failed',
      customer_id: invoice.customer as string,
      attempt_count: String(invoice.attempt_count ?? 0),
    },
    extra: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      attempt_count: invoice.attempt_count,
      next_payment_attempt: invoice.next_payment_attempt,
    },
  })

  // Send email-alert via Resend
  await sendPaymentFailedAlert({
    customerId: invoice.customer as string,
    invoiceId: invoice.id,
    amountDue: invoice.amount_due,
    currency: invoice.currency ?? 'dkk',
    attemptCount: invoice.attempt_count ?? 0,
    nextAttempt: invoice.next_payment_attempt,
  })

  // Opdatér abonnements-status i database
  await handlePaymentFailed(invoice)
  break
}

case 'payment_intent.payment_failed': {
  const paymentIntent = event.data.object as Stripe.PaymentIntent

  Sentry.captureEvent({
    message: 'Stripe payment_intent.payment_failed webhook modtaget',
    level: 'warning',
    tags: {
      webhook_event: 'payment_intent.payment_failed',
      customer_id: paymentIntent.customer as string,
    },
    extra: {
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      last_payment_error: paymentIntent.last_payment_error?.message,
    },
  })

  await sendPaymentFailedAlert({
    customerId: paymentIntent.customer as string,
    invoiceId: paymentIntent.id,
    amountDue: paymentIntent.amount,
    currency: paymentIntent.currency,
    attemptCount: 1,
    nextAttempt: null,
  })
  break
}
```

**Email-alert implementering (`src/lib/email/alerts.ts`):**
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface PaymentFailedAlertParams {
  customerId: string
  invoiceId: string
  amountDue: number
  currency: string
  attemptCount: number
  nextAttempt: number | null
}

export async function sendPaymentFailedAlert(
  params: PaymentFailedAlertParams
): Promise<void> {
  const alertTo = process.env.ALERT_EMAIL_TO ?? 'ops@chainhub.dk'
  const amountFormatted = (params.amountDue / 100).toFixed(2)
  const nextAttemptDate = params.nextAttempt
    ? new Date(params.nextAttempt * 1000).toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' })
    : 'Ingen automatisk gentagelse'

  await resend.emails.send({
    from: 'ChainHub Alerts <alerts@chainhub.dk>',
    to: alertTo,
    subject: `⚠️ Betaling fejlet — ${amountFormatted} ${params.currency.toUpperCase()}`,
    html: `
      <h2>Betaling fejlet</h2>
      <p>En betaling har fejlet i ChainHub.</p>
      <table>
        <tr><td><strong>Stripe Customer ID</strong></td><td>${params.customerId}</td></tr>
        <tr><td><strong>Invoice/PaymentIntent ID</strong></td><td>${params.invoiceId}</td></tr>
        <tr><td><strong>Beløb</strong></td><td>${amountFormatted} ${params.currency.toUpperCase()}</td></tr>
        <tr><td><strong>Forsøg nr.</strong></td><td>${params.attemptCount}</td></tr>
        <tr><td><strong>Næste forsøg</strong></td><td>${nextAttemptDate}</td></tr>
      </table>
      <p>
        <a href="https://dashboard.stripe.com/customers/${params.customerId}">
          Åbn i Stripe Dashboard
        </a>
      </p>
    `,
  })
}
```

---

### 9.4 Monitoring Dashboard Oversigt

| Metric | Kilde | Alert-grænse | Modtager |
|--------|-------|-------------|----------|
| Error rate | Sentry | > 1% / 5 min | ops@chainhub.dk |
| P95 latency | Vercel Analytics | > 3 sekunder | ops@chainhub.dk |
| Database connections | Supabase Dashboard | > 80% af max | ops@chainhub.dk |
| Webhook fejlrate | Stripe Dashboard | Enhver fejl | ops@chainhub.dk |
| payment_failed events | Stripe + Sentry | Enhver hændelse | ops@chainhub.dk |
| Cron job fejl | Vercel Cron Logs | Enhver fejl | ops@chainhub.dk |
| Microsoft login fejl | Sentry | > 3 / 5 min | ops@chainhub.dk |
| Ny Sentry issue type | Sentry | Enhver ny | ops@chainhub.dk |

---

### 9.5 Cron Job Monitoring

Cron jobs konfigureret i `vercel.json`:

| Job | Schedule | Formål |
|-----|----------|--------|
| `/api/cron/task-digest` | `0 6 * * *` | Daglig opgave-digest email til brugere |
| `/api/cron/contract-expiry` | `0 7 * * *` | Varsel om udløbende kontrakter |
| `/api/cron/subscription-sync` | `0 */6 * * *` | Synkronisér abonnementsstatus med Stripe |

**Verificér at cron jobs kører:**
1. Vercel Dashboard → Project → Cron Jobs
2. Tjek "Last run" og "Status" for hvert job
3. Klik på job for at se execution logs
4. Mål: alle jobs viser grøn status og "Last run" < 25 timer siden

**Fejlhåndtering i cron jobs:**
```typescript
// Alle cron-handlers skal:
// 1. Logge start og slut til Sentry
// 2. Fange og rapportere fejl uden at crashe
// 3. Returnere 200 selv ved delfejl (Vercel markerer job som fejlet ved non-200)

export async function GET(request: Request) {
  // Verificér Vercel cron-header (sikkerhed)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  Sentry.addBreadcrumb({ message: 'Cron job startet', category: 'cron' })

  try {
    await runCronLogic()
    Sentry.addBreadcrumb({ message: 'Cron job fuldført', category: 'cron' })
    return Response.json({ ok: true })
  } catch (error) {
    Sentry.captureException(error, { tags: { cron: 'task-digest' } })
    return Response.json({ ok: false, error: 'Cron job fejlede' }, { status: 200 })
    // Status 200 så Vercel ikke markerer som fejlet og sender spam-alerts
  }
}
```

---

## 10. Vercel Deployment

### 10.1 Standard deployment

```bash
# Automatisk deployment sker ved push til main-branch
git push origin main

# Manuel deployment via Vercel CLI
npx vercel --prod
```

### 10.2 Ved ændring af environment variables

**⚠️ VIGTIGT:** Vercel cacher build-output og environment variables. Ændringer
kræver ALTID redeploy UDEN build cache for at træde i kraft.

```
Trin 1: Vercel Dashboard → Project → Settings → Environment Variables
Trin 2: Find variabel → Edit → opdatér værdien → Save
Trin 3: Vercel Dashboard → Project → Deployments
Trin 4: Find seneste deployment → "..." (tre prikker) → "Redeploy"
Trin 5: VIGTIGT: deaktivér "Redeploy with existing Build Cache"
Trin 6: Confirm Redeploy
Trin 7: Vent på deployment (~1-2 minutter) og verificér app virker
```

### 10.3 Rollback procedure

Brug ved kritiske fejl i ny deployment:

```
Trin 1: Vercel Dashboard → Project → Deployments
Trin 2: Find seneste FUNGERENDE deployment (grøn checkmark)
         (ikke den nye fejlede)
Trin 3: Klik "..." → "Promote to Production"
Trin 4: Bekræft — tager ~30 sekunder
Trin 5: Verificér: https://www.chainhub.dk/api/health → 200 OK
Trin 6: Test kritisk bruger-flow (login → dashboard → CRUD)
Trin 7: Undersøg fejlede deployment i Vercel logs + Sentry
```

### 10.4 Deployment Checkliste

```
Pre-deployment:
□ npm run lint           — ingen ESLint-fejl
□ npm run typecheck      — ingen TypeScript-fejl
□ npm run test           — alle tests grønne
□ npm run build          — successful build
□ Database-migration klar og testet (se §5)

Post-deployment:
□ https://www.chainhub.dk loader uden fejl
□ /api/health returnerer { "status": "ok", "database": "connected" }
□ Login med Microsoft virker
□ Stripe test-webhook returnerer 200
□ Vercel Cron Jobs viser korrekte schedules
□ Sentry modtager test-event (kan trigges manuelt)
□ Ingen røde alerts i Sentry de første 10 minutter
```

---

## 11. Health Checks

### Health check endpoint

```
GET https://www.chainhub.dk/api/health
```

Returnerer ved normal drift:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "database": "connected",
  "version": "1.0.0"
}
```

Returnerer ved fejl:
```json
{
  "status": "error",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "database": "disconnected",
  "error": "Database connection failed"
}
```

HTTP status: `200` ved ok, `503` ved fejl.

**Implementation (`src/app/api/health/route.ts`):**
```typescript
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString()

  try {
    await prisma.$queryRaw`SELECT 1`

    return Response.json({
      status: 'ok',
      timestamp,
      database: 'connected',
      version: process.env.npm_package_version ?? 'unknown',
    })
  } catch (error) {
    return Response.json(
      {
        status: 'error',
        timestamp,
        database: 'disconnected',
        error: 'Database connection failed',
      },
      { status: 503 }
    )
  }
}
```

### Post-deployment tjekliste

```
□ App loader:     https://www.chainhub.dk → 200 OK (ingen runtime-fejl)
□ Health check:   https://www.chainhub.dk/api/health → { "database": "connected" }
□ Auth flow:      Login med Microsoft → /dashboard → Logout → Login igen
□ Stripe webhook: Test-event fra Stripe Dashboard → 200 OK
□ Cron jobs:      Vercel Dashboard → Cron Jobs → alle jobs konfigurerede
□ Sentry:         Events modtages (Sentry Dashboard → Issues → Recent)
□ Analytics:      Vercel Analytics viser trafik
□ Ingen alerts:   Intet rødt i Sentry, Stripe eller Vercel Dashboard
```

---

## 12. CI Pipeline

### Oversigt

GitHub Actions CI kører ved alle pull requests og pushes til `main` og `develop`.

**Pipeline jobs:**

| Job | Afhænger af | Formål |
|-----|-------------|--------|
| `lint-typecheck-test` | — | ESLint, TypeScript, Prettier, Vitest |
| `build` | lint-typecheck-test | `next build` verificering |
| `security-check` | lint-typecheck-test | npm audit + secret scanning |

### Hvad CI validerer

```
✓ npm run lint          ESLint — ingen fejl tilladt
✓ npm run typecheck     tsc --noEmit — ingen TypeScript-fejl
✓ npm run format:check  Prettier — konsistent formatering
✓ npm run validate-env  validate-env.ts — alle env vars tilstede og gyldige
✓ npm run test          Vitest unit tests — alle grønne
✓ npm run build         next build — ingen build-fejl
✓ npm audit --high      Ingen kendte high/critical CVEs
✓ trufflehog            Ingen secrets i kode
```

### Krav til CI-bestående for merge til main

```
□ Alle CI jobs grønne (ingen røde krydser)
□ Ingen skippede kritiske trin
□ Test-coverage ikke faldet under grænse (konfigureret i vitest.config.ts)
□ Build-artefakt uploadet succesfuldt
```

### Lokalt: kør CI-tjek

```bash
# Kør alle CI-trin lokalt inden push
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run format:check  # Prettier
npm run test          # Vitest
npm run build         # Next.js build

# Alle skal køre uden fejl
```

---

## Changelog

| Dato | Version | Ændring |
|------|---------|---------|
| 2024-01-22 | 2.1 | Sprint 6: Tilføjet §12 CI pipeline, udvidet §9 med Sentry/Analytics kodeeksempler, tilføjet payment_failed email-implementation, udvidet post-incident tjeklister, tilføjet health check implementation |
| 2024-01-15 | 2.0 | Fuld Sprint 6 revision — alle fejlscenarier, PITR, secrets rotation, monitoring |
| 2024-01-01 | 1.0 | Initial RUNBOOK oprettet |