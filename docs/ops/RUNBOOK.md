# RUNBOOK.md — ChainHub Operations

**Version 1.0**
**Opdateret:** Sprint 6

---

## Opsætning af lokalt udviklingsmiljø

### Forudsætninger

- Node.js 18+
- npm 9+
- PostgreSQL (Supabase eller lokal)

### Trin 1 — Klon og installer

```bash
git clone https://github.com/your-org/chainhub.git
cd chainhub
npm install --legacy-peer-deps
```

### Trin 2 — Miljøvariabler

```bash
cp .env.example .env.local
# Udfyld alle værdier i .env.local
```

**Påkrævede vars for lokal dev:**

- `DATABASE_URL` — PostgreSQL connection string
- `DIRECT_URL` — Samme som DATABASE_URL for lokal dev
- `NEXTAUTH_SECRET` — minimum 32 tegn (generer: `openssl rand -base64 32`)
- `NEXTAUTH_URL` — `http://localhost:3000`

### Trin 3 — Database

```bash
# Kør migrationer
npx prisma migrate dev

# Generer Prisma client
npx prisma generate

# Seed testdata (når migration er klar)
# npx prisma db seed
```

### Trin 4 — Start dev-server

```bash
npm run dev
# Åbn http://localhost:3000
```

---

## Supabase-opsætning

### Connection strings

Supabase leverer to URL-typer — **begge skal sættes**:

| Env var        | URL type           | Port | Bruges af             |
| -------------- | ------------------ | ---- | --------------------- |
| `DATABASE_URL` | Transaction Pooler | 6543 | Applikation (runtime) |
| `DIRECT_URL`   | Direct Connection  | 5432 | `prisma migrate dev`  |

Find dem i Supabase dashboard → Settings → Database → Connection strings.

**DATABASE_URL skal have `?pgbouncer=true` som query param.**

### Hvis databasen er "paused"

Supabase pauser projekter efter inaktivitet (free tier).

1. Gå til app.supabase.com
2. Find dit projekt
3. Klik "Restore project"
4. Vent 1-2 minutter

---

## Deployment (Vercel)

### Første deployment

```bash
# Installer Vercel CLI
npm i -g vercel

# Deploy til staging
vercel --env DATABASE_URL=... --env DIRECT_URL=... --env NEXTAUTH_SECRET=...

# Deploy til produktion
vercel --prod
```

### Environment variables i Vercel

Sæt alle vars fra `.env.example` i Vercel dashboard → Settings → Environment Variables.

**VIGTIGT:** Vercel kræver manuel redeploy efter env var-ændringer.

### Webhook URL

Stripe webhook skal altid bruge **www-prefix**:

```
https://www.chainhub.dk/api/webhooks/stripe
```

---

## Sprint-gate (kør inden hvert deployment)

```bash
npm install --legacy-peer-deps
npx prisma generate
npx tsc --noEmit
npm run build
npm test
```

Alle trin skal være grønne. Stop ved første fejl.

---

## Monitoring og alerting

### Fejllogning

- Vercel Functions logs: Vercel dashboard → Deployments → Functions
- Database queries: Supabase dashboard → Database → Query Performance

### Hvornår skal man handle

| Symptom                               | Handling                                                |
| ------------------------------------- | ------------------------------------------------------- |
| `P1001` — kan ikke nå database        | Tjek om Supabase er paused. Tjek DATABASE_URL.          |
| `P2002` — unique constraint violation | Duplikat CVR eller email. Check applikationslogik.      |
| Auth-fejl ved login                   | Tjek NEXTAUTH_SECRET er korrekt sat og har min. 32 tegn |
| Stripe webhook fejler                 | Tjek STRIPE_WEBHOOK_SECRET er uden trailing newline     |
| `prisma generate` fejler              | Tjek for Æ/Ø/Å i enum-navne — brug ASCII + @map()       |

---

## Secrets-rotation

| Secret                  | Rotation-plan       | Procedure                                                                        |
| ----------------------- | ------------------- | -------------------------------------------------------------------------------- |
| `NEXTAUTH_SECRET`       | Hvert år            | Generer nyt → opdater Vercel → redeploy → alle sessions invalideres              |
| Supabase password       | Hvert år            | Supabase dashboard → Settings → Database → Reset password → opdater begge URL'er |
| `STRIPE_WEBHOOK_SECRET` | Ved kompromittering | Stripe dashboard → Webhooks → Roll secret                                        |
| Microsoft OAuth secret  | Hvert 2 år          | Azure AD → App registrations → Certificates & secrets                            |

---

## Backup-strategi

Supabase leverer automatisk:

- Point-in-time recovery (PITR) på Pro-plan
- Daglige backups på Free-plan (7 dages historik)

Manuel backup:

```bash
pg_dump $DIRECT_URL > backup_$(date +%Y%m%d).sql
```

---

## Changelog

```
v1.0 — Sprint 6:
  Initial RUNBOOK oprettet.
  Dækker: lokal opsætning, Supabase, Vercel, sprint-gate, secrets-rotation
```
