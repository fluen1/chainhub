# ChainHub Operations Runbook

## Miljø-konfiguration

### Environment Variables

Alle environment variables er dokumenteret i `.env.example`. Ved deployment:

1. Kopiér `.env.example` til `.env.local` (lokal udvikling)
2. Sæt alle påkrævede variabler i Vercel dashboard (produktion)

### Kritiske variabler

| Variabel | Beskrivelse | Påkrævet |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Ja |
| `NEXTAUTH_URL` | App URL for NextAuth | Ja |
| `NEXTAUTH_SECRET` | Session encryption (min 32 tegn) | Ja |
| `MICROSOFT_CLIENT_ID` | Azure AD app ID | Ja |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app secret | Ja |
| `STRIPE_SECRET_KEY` | Stripe API key | Prod |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Prod |

---

## ⚠️ KRITISK: Stripe Webhook URL

### Problem
Stripe webhooks fejler STILLE hvis URL ikke har `www`-prefix.

### Løsning
Webhook URL SKAL være:
```
https://www.chainhub.dk/api/webhooks/stripe
```

**IKKE:**
```
https://chainhub.dk/api/webhooks/stripe  ❌ FEJLER
```

### Verifikation
1. Gå til Stripe Dashboard → Developers → Webhooks
2. Tjek at endpoint URL starter med `https://www.`
3. Send test-event og verificér 200 response

---

## Vercel Deployment

### Ved ændring af environment variables

**VIGTIGT:** Vercel cacher environment variables ved build.

Efter ændring af env vars i Vercel dashboard:

1. Gå til Vercel → Project → Deployments
2. Find seneste deployment
3. Klik "..." → "Redeploy"
4. Vælg "Redeploy with existing Build Cache" = **NEJ**
5. Bekræft redeploy

### Health checks

Efter deployment, verificér:
- [ ] App loader: `https://www.chainhub.dk`
- [ ] API health: `https://www.chainhub.dk/api/health`
- [ ] Auth flow: Login → Dashboard → Logout

---

## Environment Validation

`validate-env.ts` kører automatisk ved:
- `npm run dev`
- `npm run build`
- CI pipeline

### Fejlbeskeder

| Fejl | Årsag | Løsning |
|------|-------|---------|
| `NEXTAUTH_SECRET is X characters` | For kort secret | Generér ny: `openssl rand -base64 32` |
| `STRIPE_WEBHOOK_URL MUST have www prefix` | Mangler www | Ret URL til `https://www.` |
| `X is required but not set` | Manglende var | Tilføj i .env |

---

## Changelog

| Dato | Ændring |
|------|---------|
| 2024-01-XX | Initial RUNBOOK oprettet |