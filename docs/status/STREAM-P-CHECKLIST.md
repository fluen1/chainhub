# Stream P — Philips go-live-tjekliste (klap af i ét hug)

> Alt herunder er **dine hænder** — eksterne konti, nøgler og knapper Claude ikke kan trykke på. Koden er klar; det er kun provisioneringen der mangler. Rækkefølgen er valgt så du kan tage det ovenfra og ned.

## 0. Tænd den synkrone AI (assistent + selskabs-indsigter) — hurtigst værdi

Disse kører inde i selve siden (ingen ekstra server). Når nøglen er sat, virker de straks.

- [ ] Opret en **OpenAI-konto** og lav en **API-nøgle** (platform.openai.com → API keys).
- [ ] Sæt i Vercel (Project → Settings → Environment Variables, Production):
  - `OPENAI_API_KEY` = din nøgle
  - `AI_EXTRACTION_ENABLED` = `true`
- [ ] Redeploy (Vercel gør det automatisk ved env-ændring, ellers tryk Redeploy).
- [ ] **Pas på:** Indsæt nøglen REN — ingen mellemrum, ingen usynlige tegn (vi er brændt på "BOM" før). Kopiér direkte fra OpenAI.

## 1. Tænd dokument-udlæsningen (AI-extraction) — kræver en separat lille server

Selve dokument-udlæsningen kører som en baggrundsproces der IKKE kan bo på Vercel. Den skal hostes for sig.

- [ ] Følg guiden **`docs/deploy/WORKER-HOSTING.md`** trin for trin (Render, gratis/billig "Background Worker").
- [ ] Kritiske punkter fra guiden: vælg **Background Worker** (ikke Web Service), brug **`DIRECT_URL` med port 5432** (ikke 6543), og bekræft at loggen siger `"Worker ready — waiting for jobs"` før du stoler på den.
- [ ] Sæt på worker-servicen: `DIRECT_URL`, `OPENAI_API_KEY`, `AI_EXTRACTION_ENABLED=true`.

## 2. Betaling (Stripe) — før første betalende kunde

- [ ] I Stripe: opret to produkter med **lookup_key** `basis` og `plus`. Kopiér deres price-ID'er.
- [ ] Sæt i Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BASIS_PRICE_ID`, `STRIPE_PLUS_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- [ ] Registrér webhook i Stripe → `https://<dit-domæne>/api/webhooks/stripe` med events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`.
- [ ] **Sidste skridt før kunde:** Bed Claude sætte `STAGED_LAUNCH = false` (i `src/lib/env.ts`) — så håndhæves Stripe-nøglerne og den staged-tilstand slukkes.

## 3. Juridisk (lovkrav før første kunde)

- [ ] Registrér virksomhed/CVR (ApS eller enkeltmand).
- [ ] Sæt i Vercel: `CHAINHUB_CVR` (8 cifre) + `CHAINHUB_ADDRESS` (fysisk adresse) — vises automatisk på de juridiske sider når de er sat.
- [ ] Afklar med jurist hvordan databehandleraftalen accepteres (klik-accept vs. underskrift) for B2B.

## 4. Domæne + mail

- [ ] Køb **chainhub.dk** (fx simply.com) + sæt DNS mod Vercel.
- [ ] Sæt `NEXTAUTH_URL` = `https://chainhub.dk` i Vercel.
- [ ] Resend: verificér domænet; sæt SPF (`include:spf.resend.com`) + DMARC (`p=quarantine`, `dmarc@chainhub.dk`).

## 5. Overvågning (så du ved når noget brænder)

- [ ] Opret Sentry-projekt → sæt `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` i Vercel (fejl-rapportering er allerede indbygget, tænder når DSN sættes).
- [ ] Sæt en uptime-monitor (fx BetterStack) på `https://<dit-domæne>/api/health` — den svarer allerede `{"status":"ok"}`.

## 6. (Valgfrit, til automatisk deploy af worker via GitHub)

- [ ] GitHub-secrets hvis du vil auto-deploye: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (org/projekt-ID ligger i `.vercel/project.json`).

---

### Hurtig "minimum for at vise AI frem i en demo"

Kun trin **0** (OpenAI-nøgle + `AI_EXTRACTION_ENABLED=true`). Så virker assistent + selskabs-indsigter med det samme. Dokument-udlæsning (trin 1) og betaling (trin 2) kan vente til rigtig lancering.
