# API-SPEC.md

# ChainHub — API-specifikation (LEGACY)

**Status:** Legacy / ikke autoritativ
**Opdateret:** 2026-04-20
**Vedligeholdes ikke som runtime-spec**

---

## Vigtigt

Denne fil er **ikke længere den autoritative beskrivelse af systemets aktuelle runtime-adfærd**.

Den er bevaret som historisk produkt- og designkontekst, men den afspejler ikke længere appen præcist nok til, at den bør bruges som beslutningsgrundlag ved implementering, review eller debugging.

Brug i stedet disse kilder som sandhedskilde:

1. `prisma/schema.prisma` — faktisk datamodel
2. `src/actions/*.ts` — faktisk forretningslogik og guards
3. `src/app/api/**/route.ts` — faktiske API-routes
4. `README.md` — aktiv onboarding og drift-kommandoer
5. `docs/status/PROGRESS.md` — aktuel leverancestatus
6. `docs/status/BLOCKERS.md` — åbne kendte problemer

---

## Kendte områder hvor denne legacy-spec afviger fra runtime

### 1. Upload-flow

Denne legacy-spec beskrev tidligere et to-trins flow, hvor klienten først uploadede filen og derefter oprettede et document-record separat.

Det er **ikke** den aktuelle runtime-adfærd.

Aktuel runtime-kilde:

- `src/app/api/upload/route.ts`

Aktuel adfærd i hovedtræk:

- route opretter selv `Document` i databasen
- route returnerer `{ data: document }`
- max filstørrelse er 10 MB
- tilladte filtyper inkluderer PDF, DOCX, PNG og JPEG
- `contractId` kan bruges til at køe extraction-job

### 2. Invitationer / onboarding / billing / Microsoft-integration

Tidligere sektioner i denne spec beskrev flows og endpoints, som enten har ændret sig væsentligt, aldrig blev realiseret som beskrevet, eller ikke længere bør læses som den operative implementering.

Derfor må denne fil **ikke** bruges som eneste kilde til at antage:

- hvilke actions der findes
- hvilke endpoints der findes
- hvilke guards der gælder
- hvilke side effects der faktisk udføres

### 3. Actions og returtyper

Denne fil beskrev tidligere mange actions som normative kontrakter. I praksis er det nu kildefilerne i `src/actions/` der gælder.

Hvis denne fil og runtime-koden er uenige, er det **altid runtime-koden** der har forrang.

---

## Brugsregel fremadrettet

Denne fil må kun bruges til:

- historisk kontekst
- produktintentioner
- idégrundlag for senere omskrivning til en ny, korrekt spec

Denne fil må **ikke** bruges alene til:

- implementering af nye features
- review af sikkerhed eller permissions
- antagelser om API-kontrakter
- testdesign uden krydstjek mod runtime-kode

---

## Næste skridt

Når der er tid til det, bør denne legacy-fil enten:

1. omskrives fra bunden til en kort, runtime-nær teknisk spec, eller
2. splittes op i mindre, vedligeholdelige modulspecs, eller
3. arkiveres permanent hvis kode + tests + schema er tilstrækkelig dokumentation

Indtil da gælder: **kode, schema og aktive statusdokumenter vinder over denne fil.**

---

## Aktive runtime-endpoints (vedligeholdes)

Nedenstående endpoints er dokumenteret direkte fra kildekoden og er autoritative.

---

### POST /api/webhooks/stripe

**Kilde:** `src/app/api/webhooks/stripe/route.ts`
**Formål:** Modtager Stripe webhook-events og synkroniserer abonnementsstatus i databasen.

#### Signaturverifikation

Stripe signerer alle webhook-requests med en HMAC-SHA256-signatur i headeren `stripe-signature`. Serveren verificerer signaturen med `stripe.webhooks.constructEvent(body, signature, webhookSecret)` — hvis signaturen er ugyldig returneres HTTP 400.

`STRIPE_WEBHOOK_SECRET` skal matche det signing secret der er konfigureret for det specifikke webhook-endpoint i Stripe Dashboard.

#### Request

```
POST /api/webhooks/stripe
Content-Type: application/json
stripe-signature: t=<timestamp>,v1=<signature>

<Stripe event JSON payload>
```

#### Håndterede events

| Event                           | Handling                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed`    | Opretter eller opdaterer `Subscription`-record med `stripe_customer_id`, `stripe_subscription_id`, plan (fra `price.lookup_key`), status og periode. Opdaterer også `Organization.plan`. Kræver `session.mode === 'subscription'`. |
| `customer.subscription.updated` | Opdaterer `Subscription` status, periode og `trial_ends_at`. Opdaterer `Organization.plan` hvis `price.lookup_key` er tilgængeligt.                                                                                                |
| `customer.subscription.deleted` | Sætter `Subscription.status = 'canceled'` og `Organization.plan = 'canceled'`.                                                                                                                                                     |
| `invoice.payment_failed`        | Sætter `Subscription.status = 'past_due'`.                                                                                                                                                                                         |
| Alle andre events               | Ignoreres stille — returnerer `{ received: true }` med HTTP 200.                                                                                                                                                                   |

#### Responses

| Status | Body                                              | Årsag                                                        |
| ------ | ------------------------------------------------- | ------------------------------------------------------------ |
| 200    | `{ "received": true }`                            | Event modtaget og behandlet (eller ignoreret)                |
| 400    | `{ "error": "Manglende Stripe-signatur" }`        | `stripe-signature`-header mangler                            |
| 400    | `{ "error": "Ugyldig webhook-signatur" }`         | Signaturen matcher ikke `STRIPE_WEBHOOK_SECRET`              |
| 500    | `{ "error": "Stripe ikke konfigureret" }`         | `STRIPE_SECRET_KEY` mangler i miljø                          |
| 500    | `{ "error": "Webhook-hemmelighed mangler" }`      | `STRIPE_WEBHOOK_SECRET` mangler i miljø                      |
| 500    | `{ "error": "Intern fejl ved event-behandling" }` | Uventet fejl under DB-opdatering — logges via `captureError` |

#### Fejlhåndtering

Fejl under signaturverifikation returnerer HTTP 400. Fejl under event-behandling returnerer HTTP 500 og logges via `src/lib/logger.ts` (`captureError`) med `namespace: 'api:webhooks:stripe'` og event-type/ID som kontekst.

#### Opsætning

Se `docs/build/RUNBOOK.md#stripe-webhook-opsætning` for trin-for-trin opsætning inkl. Stripe CLI til lokal test.
