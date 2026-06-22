# AI-extraction: pg-boss worker → Vercel Pro cron (2026-06-22)

> Philip valgte gratis Vercel-cron frem for betalt Render-worker. Arkitektur B (verificeret via kortlægning): drop pg-boss for extraction; cron poller pending docs via DocumentExtraction-status; hent fil fra storage; genbrug `extractDocument`-pipeline + OpenAI uændret.

## Verificerede fakta

- `DocumentExtraction` (schema.prisma:1105), `extraction_status` ("in_progress"/"completed"/"requires_manual_review"). Pending doc = `Document` uden extraction ELLER `extraction_status='in_progress'`.
- `extractDocument(payload)` (extract-document.ts) tager `file_buffer_base64`; henter IKKE fil selv. Idempotent (content-hash dedup + upsert på document_id).
- `storage.download(key)` → Buffer. Key = `${orgId}/${documentId}/${sanitizedFileName}` (upload/route.ts:96). BRUG IKKE `file_url` (R2 presigned, 24t udløb).
- AI-gate: `isAIEnabled('extraction')` + plan=plus (extract-document.ts håndterer internt → returnerer skipped/budget_denied uden at skrive række → re-polling er selvhelende).
- daily-digest auth: Bearer `CRON_SECRET || DIGEST_CRON_SECRET`. ⚠️ middleware `proxy.ts validateCronToken` kender KUN `DIGEST_CRON_SECRET` → SKAL acceptere begge (ellers afviser den Vercels auto-cron).
- Vercel cron kalder GET. `maxDuration` mangler overalt → sæt `export const maxDuration = 300`. Region fra1.

## Leverancer

1. **`extractDocumentById(documentId)`** — wrapper: slå Document op, rekonstruér storage-key, `storage.download(key)`, kald `extractDocument` med buffer. Rør IKKE extractDocument-kernen.
2. **`src/app/api/cron/extract-pending/route.ts`** — GET, `maxDuration=300`, auth (CRON_SECRET||DIGEST_CRON_SECRET), find pending docs (batch-loft ~3-5), gruppér pr. org, tjek AI-gate pr. org (skip hele org billigt hvis disabled), `extractDocumentById` pr. doc med fejl-fang, returnér JSON-summary.
3. **`src/app/api/cron/portfolio-scan/route.ts`** — GET, maxDuration, auth, kør `runPortfolioScan` for alle orgs (flyt worker-løkken).
4. **`proxy.ts validateCronToken`** — accepter `CRON_SECRET` ELLER `DIGEST_CRON_SECRET`.
5. **`upload/route.ts`** — FJERN hele pg-boss enqueue-blokken (~150-194). Upload skriver kun Document; cron samler op.
6. **`vercel.json`** — tilføj crons: extract-pending `*/2 * * * *`, portfolio-scan `5 6 * * *`.
7. **Oprydning:** fjern pg-boss PORTFOLIO_SCAN-scheduling (queue.ts:37); slet `worker/index.ts`, `Dockerfile.worker`, `render.yaml`, `docs/deploy/WORKER-HOSTING.md`; fjern `worker`/`worker:dev` scripts (package.json). BEHOLD `WORKER_RUNTIME` i env.ts (harmløs; undgå env-risiko).

## Tests (TDD)

- cron-routes: afvis uden/forkert token; kør med gyldig.
- extract-pending: finder pending, springer AI-disabled org over, kalder extraction pr. doc (mock extractDocumentById/storage).
- extractDocumentById: henter fra storage via rekonstrueret key, kalder extractDocument.
- middleware: CRON_SECRET accepteres nu på /api/cron.

## Verifikation

tsc + lint + tests grønt. DB-integrationstests kan fejle lokalt (ECIRCUITBREAKER) — verificér unit-niveau; CI kører DB. Efter merge: Philip sætter ingen ekstra env (CRON_SECRET injiceres af Vercel; sæt DIGEST_CRON_SECRET=CRON_SECRET ELLER middleware-fix dækker det).
