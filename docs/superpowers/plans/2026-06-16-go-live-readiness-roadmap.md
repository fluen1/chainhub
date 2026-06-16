# ChainHub Go-Live Readiness — Master Roadmap

> **For agentic workers:** Dette er et MASTER-KORT, ikke en eksekverbar enkelt-plan. Det dekomponerer go-live-arbejdet i 6 uafhængige work-streams + Philips eksterne spor. Hver work-stream får sin EGEN detaljerede TDD-plan (`docs/superpowers/plans/2026-06-16-stream-<X>-*.md`) skrevet lige før eksekvering, og implementeres via `superpowers:subagent-driven-development`.

**Goal:** Bringe ChainHub fra readiness 2/5 til "kan tage første betalende kunde" — lukke alle P0 og de go-live-kritiske P1.

**Architecture:** Next.js 16 App Router + Server Actions + Prisma 6/Supabase + Stripe + NextAuth 5. Arbejdet er rent kode + DB-migrationer i repoet; ingen deploy udføres af Claude (Philip ejer go-live-knappen).

**Kilde:** Modenheds-audit 2026-06-16 (14 agenter, 13 dimensioner). Overall readiness **2/5**. Svageste dimensioner: billing-stripe (2), deploy-infra (2), observability (2), docs-drift (2), authz-rbac (3).

---

## Go-live exit-gate (definition of done)

ChainHub er klar til første betalende kunde når ALLE disse er sande:

1. `prisma migrate deploy` kører grønt mod en frisk, tom DB (hele skemaet rejses).
2. Billing virker end-to-end: ægte checkout → webhook → korrekt plan i DB, dækket af tests.
3. Nul RBAC-bypass: AI-tools, CSV-eksport og dokumenter respekterer company-scope + sensitivity.
4. CI-gate er reel: `npm run lint` virker og fanger fejl; tests + build grønne; Node-version matcher prod.
5. Legal: rigtigt CVR + fysisk adresse live på legal-sider; vilkår/DBA-accept spores pr. organisation.
6. Observability: Sentry aktiv + uptime-monitor på `/api/health`.
7. Alle eksterne konti/secrets provisioneret (Philips spor).

---

## Owner-split

- **🔧 Claude (kode):** Streams A–F nedenfor.
- **🧍 Philip (eksternt):** Stream P — konti, DNS, CVR-registrering, Stripe-dashboard, jurist, observability-konti. Kan køre PARALLELT med Claudes streams; nogle Claude-tasks kan ikke verificeres i prod før Philips modsvarende eksterne action er gjort, men koden kan skrives+unit-testes uafhængigt.

---

## Afhængigheds-DAG (rækkefølge)

```
Stream A (deploy-baseline + CI-gate + docs-drift)   ← UNBLOCKER, gøres FØRST
        │  (baseline-migration skal eksistere før B/E kan tilføje nye migrationer ovenpå)
        ▼
   ┌────┴────┬─────────┬─────────┐
Stream B   Stream C  Stream D   (B, C, D indbyrdes uafhængige — vælg efter prioritet)
(billing)  (RBAC)    (input/AI)
   │          │
   ▼          ▼
Stream E (legal-kode: nye schema-felter → ny migration)
        │
        ▼
Stream F (performance + a11y + polish)   ← sidst; ingen blokerer go-live hårdt
```

**Anbefalet sekvens:** A → C → B → D → E → F.
Begrundelse: A låser alt op. C (RBAC-lækager) er produktets ikke-forhandlingsbare løfte og rene "kopiér mønster"-fixes — billig, høj risiko-reduktion. B (penge) kræver TDD og koordinering med Philips Stripe-setup, så den må gerne starte lige efter/parallelt. D, E, F er P1/P2-finish.

---

## Stream A — Deploy-baseline & CI-gate 🔧 Claude · UNBLOCKER

**Hvorfor først:** Uden en baseline-migration kan intet deployes eller prod-testes; uden en virkende lint-gate slipper fejl gennem CI; og en forældet `CLAUDE.md` vildleder hver agent der arbejder videre.

| Item                               | Sev   | Detalje                                                                                                                                                                                                      |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline Prisma-migration (squash) | P0    | `prisma/migrations/` har kun 7 AI-ALTER-migrationer, ingen `CREATE`-baseline, ingen `migration_lock.toml`. Squash til ét `0_init` fra `--from-empty → schema.prisma`; verificér `migrate deploy` mod tom DB. |
| Fix lint-script                    | P0    | `package.json:9` `"lint": "next lint"` → ugyldigt i Next 16; CI-lint-gate har aldrig kørt. Ret til `"lint": "eslint src"`.                                                                                   |
| 4 reelle ESLint-errors             | P1    | `dashboard/page.tsx:28` (Date.now i render), `persons-list-b.tsx:125` (setState i useEffect), `CreateContractForm.tsx:84` (setState i useEffect → useMemo), `PosthogIdentify.tsx:25` (manglende deps).       |
| Prettier + import-order            | P2/P3 | `npx prettier --write src` (10 filer); `npx eslint src --fix` (502 auto-fix import-order).                                                                                                                   |
| `vercel.json` crons                | P1    | Ingen `vercel.json` → `daily-digest` udløses aldrig i prod. Tilføj crons-blok.                                                                                                                               |
| Node-version i CI                  | P3    | `ci.yml` Node 20 vs lokal/prod 24 → bump til 22/24.                                                                                                                                                          |
| Docs-drift                         | P1    | `CLAUDE.md` (Next 14/React 18/Sprint 7 → 16/19), `AI-COST-MODEL.md` + `BLOCKERS.md` (Anthropic → OpenAI), forældet `RESUMPTION-PROMPT.md`.                                                                   |

**Success criteria:** `npx prisma migrate deploy` grøn mod tom DB; `npm run lint` kører og giver 0 errors; `npm run build` + `npm test` grønne; `CLAUDE.md` matcher `package.json`.

**Detaljeret plan:** `2026-06-16-stream-a-deploy-baseline.md` (skrives først).

---

## Stream B — Billing end-to-end 🔧 Claude (+ 🧍 Philip Stripe-dashboard)

**Hvorfor:** Den direkte pengestrøm og pt. mest broken kritiske dimension (score 2).

| Item                                | Sev | Detalje                                                                                                                                                                                                               |
| ----------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Price-IDs requiredInProd            | P0  | `STRIPE_BASIS/PLUS_PRICE_ID` er optional i `env.ts` → checkout-knapper lydløst døde i prod. Gør required når `NODE_ENV=production`.                                                                                   |
| priceId→plan mapping                | P0  | Webhook bruger `?? 'standard'` (route.ts:86) → forkert plan. Map fra price-ID/lookup_key til reel plan.                                                                                                               |
| `invoice.payment_succeeded`-handler | P0  | Mangler → `past_due` ryddes aldrig efter genbetaling.                                                                                                                                                                 |
| Webhook unit-tests                  | P0  | 0% dækning på alle 4 event-handlers. `src/__tests__/api/webhooks-stripe.test.ts`: mock `constructEvent` + prisma; test checkout.completed, subscription.deleted, payment_failed, payment_succeeded, ugyldig signatur. |
| `past_due` gater dashboard          | P1  | Manglende betaling skal begrænse adgang.                                                                                                                                                                              |
| Webhook-idempotens                  | P2  | `processed_stripe_events`-tabel mod dobbelt-processering (nyt schema-felt → migration).                                                                                                                               |

**Success criteria:** Test-mode checkout → webhook → korrekt `org.plan` i DB, verificeret af passerende unit-tests; ugyldig signatur → 400; `past_due` blokerer.
**Philip-afhængighed:** Live Stripe-produkter (lookup_key basis/plus) + registreret webhook-endpoint (Stream P).

---

## Stream C — RBAC & tenant-hardening 🔧 Claude · HØJESTE SIKKERHEDSPRIORITET

**Hvorfor:** Tre data-lækager bryder produktets ikke-forhandlingsbare 3-lags permission-løfte; alle er mekaniske "kopiér eksisterende mønster".

| Item                                       | Sev | Detalje                                                                                                                                                                             |
| ------------------------------------------ | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-assistent RBAC-bypass                   | P0  | `search-contracts/companies/persons.ts` filtrerer kun på `organization_id`. Inject `userId` i ToolContext; tilføj `getAccessibleCompanies` + `getAllowedSensitivityLevels` i WHERE. |
| CSV-eksport RBAC-bypass                    | P0  | `/api/export/[entity]` + `export.ts` sætter aldrig `visibleCompanyIds`/`maxSensitivity`. Injicér scope, eller gate eksport til GROUP_OWNER/ADMIN.                                   |
| Dokument-sensitivity                       | P0  | `documents.ts` importerer ikke `canAccessSensitivity`. Tilføj i list/delete/review/enrichment.                                                                                      |
| `organization_id` på updates               | P1  | ~19 update/soft-delete WHERE bruger kun `{ id }`: contracts (5), cases (4), tasks (5), persons (2), governance (1), ownership (2). Tilføj `organization_id` til DB-håndhævelse.     |
| Manglende permission-checks                | P1  | `updateCaseStatus` (company+sensitivity), `createCaseComment` (sensitivity), `createPerson`/`updatePerson` (canAccessModule).                                                       |
| `deleted_at:null` i deletePerson pre-check | P2  | `persons.ts:303`.                                                                                                                                                                   |
| JWT active-check                           | P2  | Deaktiverede brugere beholder adgang i op til 8h; DB-check i jwt-callback eller kortere maxAge.                                                                                     |

**Success criteria:** Nye tenant-isolation + sensitivity-tests beviser at COMPANY_READONLY ikke kan læse/eksportere STRENGT_FORTROLIG via AI-chat, CSV eller dokumenter; cross-tenant update returnerer 0 rows.

---

## Stream D — Input-validering & AI-sikkerhed 🔧 Claude

| Item                                       | Sev | Detalje                                                                                                                   |
| ------------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------------- |
| Magic-bytes på file-upload                 | P1  | `upload/route.ts:54` stoler kun på browser-MIME. Verificér magic bytes via `file-type`.                                   |
| AI-features gated på plan                  | P1  | Basis må ikke aktivere Plus-only AI; cost-cap-check i assistant-orchestrator.                                             |
| `OPENAI_API_KEY` requiredInProd + cost-fix | P1  | Gør required; ret `estimateExtractionCost` til gpt-5-mini-priser (12× overestimering nu).                                 |
| Zod `.max()` + dato-regex                  | P2  | `person.phone/notes`, `contact.*`, `contract.notes`, dato-felter (`new Date()` på uvalideret streng → Invalid Date i DB). |

**Success criteria:** Upload af .exe maskeret som PDF afvises; basis-konto kan ikke trigge Plus-AI; ugyldig dato afvises af Zod.

---

## Stream E — Legal/compliance-kode 🔧 Claude (+ 🧍 Philip jurist/CVR)

**Afhænger af A** (tilføjer schema-felter → ny migration ovenpå baseline).

| Item                          | Sev       | Detalje                                                                                                            |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| Accept-sporing                | P1        | `Organization.terms_accepted_at`/`dpa_accepted_at` + obligatorisk accept-checkbox ved signup (GDPR art. 28-bevis). |
| In-app cookie-tilbagetrækning | P2        | GDPR art. 7 stk. 3 — mulighed for at trække samtykke i appen; `GdprPanel role=alert`.                              |
| CVR/adresse-felt              | P0→Philip | Selve værdien indsættes af Philip efter CVR-registrering; koden eksponerer feltet korrekt.                         |

**Success criteria:** Signup persisterer accept-tidsstempler; cookie-samtykke kan trækkes i appen.

---

## Stream F — Performance & polish 🔧 Claude · SIDST

| Item                           | Sev   | Detalje                                                                                                    |
| ------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------- |
| `getUserRoles` React `cache()` | P1    | 2–5 DB-kald/request pga. isolerede permission-helpers. Wrap med `cache()`.                                 |
| `getCasesPageData` pagination  | P1    | Overflødig ubegrænset CaseCompany-pre-fetch → brug `case_companies: { some: ... }` i WHERE.                |
| a11y quick-wins                | P2    | `aria-sort` på tabel-headers, role/aria på toggles/skeletons.                                              |
| Øvrige perf                    | P2/P3 | Lazy person-dropdown i kontrakt-detalje, peer-metrics cache, FinancialMetric-index, Task→Company-relation. |

**Success criteria:** Permission-waterfall elimineret (verificeret via query-count-assertion); a11y-axe grøn.

---

## Stream P — Philips eksterne actions 🧍 Philip · PARALLELT

1. **Registrér virksomhed/CVR** (ApS/enkeltmand) — påkrævet før første kunde (GDPR art. 13 + e-handelslov §11); indsæt CVR + fysisk adresse i legal-sider.
2. **Stripe live:** opret produkter med `lookup_key` basis/plus, kopiér price-IDs til Vercel-env, registrér webhook (`www.chainhub.dk/api/webhooks/stripe`) med events checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed, invoice.payment_succeeded.
3. **Eksterne konti:** chainhub.dk-domæne (simply.com) + DNS, Vercel Pro, Supabase Pro prod-projekt, Upstash Redis (required i prod), Cloudflare R2-bucket, Resend domæne-verifikation.
4. **GitHub-secrets:** `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` (orgId/projectId i `.vercel/project.json`).
5. **Observability:** Sentry-projekt (`SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` + alert-regler) + BetterStack uptime på `/api/health`.
6. **DNS/mail:** SPF → `include:spf.resend.com`, DMARC `p=quarantine`, `dmarc@chainhub.dk`-mailbox.
7. **AI-extraction-beslutning:** live ved launch → provisionér pg-boss worker-host (Railway/Fly/Render); ellers `AI_EXTRACTION_ENABLED=false` + dokumentér.
8. **Jurist:** koordinér DBA-accept-flow (klik-accept vs. underskrift) for B2B.
9. **OpenAI:** konto + API-key på rette tier (ANTHROPIC-referencer i docs er forældede — koden bruger OpenAI).

---

## Status-korrektion

`hq\STATUS.md` og `project_chainhub_launch.md` siger "launch-readiness komplet". Det er **misvisende** — det dækkede public/legal/docs/deploy-**prep**-laget, ikke den faktiske deploy-vej, billing eller den dybere sikkerhed. Begge opdateres til readiness 2/5 med denne roadmap som kilde.
