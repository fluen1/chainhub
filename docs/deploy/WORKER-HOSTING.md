# AI-worker: hvad den er, og hvordan du deployer den

## Hvad gør workeren?

ChainHub kan automatisk udlæse og analysere dokumenter ved hjælp af AI (OpenAI). Når du uploader et dokument, lægger appen en opgave i en jobkø (pg-boss). Workeren er det separate program der sidder og venter på de opgaver — og udfører selve AI-analysen.

Workeren kører én enkelt fil: `worker/index.ts`. Den startes med kommandoen `npm run worker`.

## Hvorfor kan workeren ikke køre på Vercel?

Vercel er bygget til kortlivede funktioner der svarer på et request og stopper igen (typisk inden for 10-30 sekunder). Workeren er det modsatte: den skal køre **konstant** og lytte efter nye jobs. Det kalder man en "always-on" eller "long-running" proces — og det understøtter Vercel ikke.

Derudover bruger workeren en direkte databaseforbindelse (port 5432) der holdes åben i lang tid. Vercels serverless-model lukker forbindelser efter hvert request, hvilket ville bryde pg-boss' interne tilstand.

**Konklusion:** Appen (Next.js) kører på Vercel. Workeren kører på en separat platform — vi har valgt Render.com.

## Alternativer til Render

Render er valgt fordi det er enkelt og billigt til netop dette mønster. Andre platforme der understøtter det samme:

- **Railway** (railway.app) — næsten identisk opsætning, lidt dyrere
- **Fly.io** — mere fleksibelt, kræver mere konfiguration

---

## Deploy-trin på Render.com

### Forudsætninger

- Du er logget ind på [render.com](https://render.com) med din konto
- ChainHub-repoet er pusheret til GitHub (f.eks. `fluen1/chainhub`)
- Du har din Supabase DIRECT_URL (port 5432) og din OpenAI API-nøgle klar

---

### Trin 1 — Opret en ny service

1. Gå til [dashboard.render.com](https://dashboard.render.com)
2. Klik på **"New +"** øverst til højre
3. Vælg **"Background Worker"**
4. Vælg **"Build and deploy from a Git repository"**
5. Forbind dit GitHub-repository (giv Render adgang hvis det ikke allerede er gjort)
6. Vælg `fluen1/chainhub` (eller hvad repoet hedder)

---

### Trin 2 — Konfigurér servicen

Udfyld felterne sådan:

| Felt                | Værdi                  |
| ------------------- | ---------------------- |
| **Name**            | `chainhub-ai-worker`   |
| **Region**          | Frankfurt (EU Central) |
| **Branch**          | `master`               |
| **Runtime**         | Docker                 |
| **Dockerfile Path** | `./Dockerfile.worker`  |
| **Plan**            | Starter (~$7/mdr.)     |

Render vil automatisk finde `Dockerfile.worker` i roden af repoet.

---

### Trin 3 — Sæt miljøvariabler

Under **"Environment Variables"** tilføjer du disse fire:

| Variabelnavn            | Værdi                                                                                         | Bemærkning                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `DIRECT_URL`            | `postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres` | Kopier fra Supabase → Settings → Database → Connection string (Direct, ikke pooler) |
| `OPENAI_API_KEY`        | `sk-proj-...`                                                                                 | Samme nøgle som i Vercel                                                            |
| `AI_EXTRACTION_ENABLED` | `true`                                                                                        | Slår AI-extraction til                                                              |
| `WORKER_RUNTIME`        | `true`                                                                                        | **KRITISK** — uden den crasher workeren ved opstart (se nedenfor)                   |

> **Hvorfor `WORKER_RUNTIME=true`?** Appen og workeren deler samme kode, og koden kræver normalt login-, rate-limit- og betalings-nøgler (NextAuth, Upstash, Stripe). Workeren bruger ingen af dem. `WORKER_RUNTIME=true` fortæller koden "dette er workeren — spring de krav over", så du kun behøver de fire variabler ovenfor i stedet for et helt sæt app-secrets.

> **Vigtigt om DIRECT_URL:** Brug porten **5432** (ikke 6543). 5432 er den direkte forbindelse; 6543 er PgBouncer-pooleren som ikke fungerer med pg-boss' langlivede forbindelser.

---

### Trin 4 — Deploy

Klik **"Create Background Worker"**. Render bygger nu Docker-imaget og starter workeren.

Det første build tager typisk 3-5 minutter (afhænger af internet og npm-pakker). Efterfølgende deploys er hurtigere.

---

### Trin 5 — Verificér at det virker

I Render-dashboardet under din service kan du se **"Logs"**. Når workeren starter korrekt, ser du noget i stil med:

```
{"level":"info","msg":"Worker starting"}
{"level":"info","msg":"pg-boss started"}
{"level":"info","registered_jobs":["extraction.full","alerts.portfolio-scan"],"msg":"Worker ready — waiting for jobs"}
```

Hvis du ser en fejl med `DIRECT_URL` eller `DATABASE_URL`, tjek at variabelnavnet er stavet korrekt og at URL'en er port 5432.

---

## Automatisk genstart

Render genstarter automatisk workeren hvis den crasher. Du behøver ikke gøre noget — det er en del af "Background Worker"-typen.

## Deploy ved kode-opdateringer

Hver gang du pusher til `main`-branchen vil Render automatisk bygge og deploye en ny version af workeren (med mindre du slår auto-deploy fra i dashboardet).

---

## Teknisk reference

- Worker-entry: `worker/index.ts`
- Start-kommando: `npm run worker` (= `tsx worker/index.ts`)
- Docker-image: `Dockerfile.worker` (multi-stage, node:24-slim base)
- Render-service-definition: `render.yaml` i repo-roden
- Relevant kode: `src/lib/ai/queue.ts` (pg-boss-konfiguration)
