# AI Features Design — Smart Enrichment, Autofill, Alerts & Assistent

## Overblik

4 AI-features der automatiserer manuelt arbejde for kædegruppe-brugere, bygget som Unified AI Service Layer oven på eksisterende `src/lib/ai/` infrastruktur.

**Budget:** $20-50/org/måned (primært gpt-5-mini + nano)
**Build-rækkefølge:** Feature 1 → 2 → 3 → 4

---

## Feature 1: Smart Dokument-Enrichment

**Formål:** Når en bruger uploader et dokument, vises AI-ekstraherede felter som forslag i et sidepanel. Brugeren kopierer/bruger dem ved manuel oprettelse.

### Entity-routing

- Upload fra selskabs-kontekst → auto-link (implicit)
- Upload fra generel docs-side → AI matcher til selskab/person via CVR-nr, navne, adresser
- Viser top-3 matches med konfidenscore

### Enrichment-panel

- Sidepanel på dokument-detaljesiden med strukturerede felter (datoer, beløb, parter, klausuler)
- "Brug"-knapper der kopierer til clipboard eller åbner opret-formular med præ-udfyldte data
- Bygger på eksisterende review UI (`/documents/review/[id]`)

### Teknisk

- Udvidelse af `src/app/api/upload/route.ts` — efter pipeline completion, kør entity-matching
- Nyt: `src/lib/ai/pipeline/pass6-entity-matching.ts` — matcher ekstraherede navne/CVR mod `Company` og `Person` tabeller
- Nyt: `src/components/documents/EnrichmentPanel.tsx`
- Model: `gpt-5-nano` til entity-matching
- Kost: ~$0.01-0.03 ekstra per dokument

---

## Feature 2: Formular-Autofill

**Formål:** Når brugeren åbner en opret-formular (selskab, kontrakt, person), præ-udfyldes felter automatisk fra tre kilder.

### Datakilder (prioriteret)

1. **CVR API** — Virk.dk/CVR API v3. Når bruger taster CVR-nr → hent firmanavn, adresse, tegningsregel, kapital, stiftelsesdato
2. **Interne relationer** — Eksisterende data (fx "denne person er allerede registreret med disse kontaktoplysninger")
3. **Uploadede dokumenter** — AI-ekstraherede felter fra Feature 1

### UX-flow

1. Bruger åbner "Opret selskab" → taster CVR-nr
2. 500ms debounce → API-kald til CVR
3. Felter highlightes med lilla badge "Forslag fra CVR" — brugeren klikker for at acceptere
4. Hvis dokumenter med matching CVR allerede er uploadet → ekstra forslag fra AI-ekstraktion

### Teknisk

- Nyt: `src/lib/integrations/cvr/client.ts` — CVR API adapter
- Nyt: `src/lib/integrations/cvr/types.ts` — response-typer
- Nyt: `src/actions/autofill.ts` — `getAutofillSuggestions(entityType, partialData, orgId)`
- Nyt: `src/components/ui/AutofillField.tsx` — input med "AI-forslag" badge, click-to-accept
- Trigger: debounced on CVR-felt blur, eller on form-open hvis kontekst er kendt
- Kost: CVR API gratis. LLM kun ved dokument-matching (~$0.005 per opslag)

---

## Feature 3: Proaktive Alerts

**Formål:** Daglig automatisk scanning af alle selskaber/kontrakter. Prioriterede alerts i dashboard-widget og notification-ikon.

### Alert-typer

| Kategori   | Eksempler                                  |
| ---------- | ------------------------------------------ |
| Deadline   | "3 kontrakter udløber inden 30 dage"       |
| Mangler    | "Selskab X mangler forsikringspolice"      |
| Risiko     | "Ejerandele summer ikke til 100%"          |
| Compliance | "Bestyrelsesgodkendelse overskredet frist" |

### To-trins scanning

1. **Rule-based** (gratis): Deadline-beregning, completeness-check, sum-validering — ren SQL/logik
2. **AI-powered** (kun ved behov): Kryds-validering af kontrakt-indhold — `gpt-5-nano`

### Levering

- In-app kun: Dashboard AlertsWidget (top-5) + NotificationBell i sidebar med badge-count
- Ingen email eller Slack

### Teknisk

- Nyt: `src/lib/ai/jobs/portfolio-scan.ts` — PgBoss cron-job kl. 06:00 UTC dagligt
- Nyt: `Alert` Prisma-model — severity (critical/warning/info), category, entity_type, entity_id, message, dismissed_at
- Nyt: `src/actions/alerts.ts` — `getActiveAlerts()`, `dismissAlert()`, `getAlertStats()`
- Nyt: `src/components/dashboard/AlertsWidget.tsx`
- Nyt: `src/components/layout/NotificationBell.tsx`
- Invalidering: on-demand når data ændres via revalidatePath
- Kost: Rule-based = $0. AI krydsvalidering ~$0.02-0.10/org/dag

---

## Feature 4: Portfolio-AI-Assistent (Chat-panel)

**Formål:** Slide-out chat-panel i højre side. Brugeren stiller spørgsmål i fritekst, AI svarer med data og kan udføre handlinger med bekræftelse.

### Tools (AI capabilities)

| Tool                     | Beskrivelse                       | Kræver bekræftelse |
| ------------------------ | --------------------------------- | ------------------ |
| `search_contracts`       | Søg/filtrer kontrakter            | Nej                |
| `search_companies`       | Søg selskaber, hent detaljer      | Nej                |
| `search_persons`         | Find personer, roller, relationer | Nej                |
| `get_alerts`             | Hent aktive alerts                | Nej                |
| `generate_report`        | Opsummér data som tekst/tabel     | Nej                |
| `create_task`            | Opret opgave                      | Ja                 |
| `create_case`            | Opret sag/tvist                   | Ja                 |
| `update_contract_status` | Ændr kontrakt-status              | Ja                 |
| `create_reminder`        | Opret påmindelse                  | Ja                 |

### UX-flow

1. Chat-ikon i sidebar → panel slider ud (400px bredde)
2. Velkomstbesked med eksempler
3. Bruger skriver → AI kalder tools → svarer med formateret data (tabeller, links)
4. Write-handlinger: preview + Bekræft/Annullér

### Teknisk

- Nyt: `src/lib/ai/assistant/orchestrator.ts` — modtager besked, router til tools, sammensætter svar
- Nyt: `src/lib/ai/assistant/tools/` — én fil per tool
- Nyt: `src/lib/ai/assistant/context.ts` — system-prompt med org-kontekst
- Nyt: `src/actions/assistant.ts` — `sendMessage()`, `confirmAction()`, `getConversationHistory()`
- Nyt: Prisma-modeller: `Conversation`, `Message`, `PendingAction`
- Nyt: `src/components/assistant/ChatPanel.tsx`
- Nyt: `src/components/assistant/ActionConfirmCard.tsx`
- Model: `gpt-5-mini` for chat, `gpt-5-nano` for tool-routing
- Rate limit: 50 beskeder/time per bruger
- Kost: ~$0.02-0.08/besked → $10-35/org/måned ved normal brug

### Sikkerhed

- Alle tools kalder eksisterende actions → permission-checks håndhæves
- Write-handlinger kræver altid bruger-bekræftelse
- Conversation scoped til org via organization_id
- AI kan aldrig auto-execute destruktive handlinger

---

## Fælles Infrastruktur (eksisterende, udvides)

- **Cost caps:** Eksisterende `src/lib/ai/cost-cap.ts` — udvides med per-feature budgets
- **Rate limiting:** Eksisterende token-bucket — ny limiter for chat (50/time/bruger)
- **Feature flags:** Eksisterende `src/lib/ai/feature-flags.ts` — nye flags: `entity_matching`, `autofill`, `alerts`, `assistant`
- **Usage logging:** Eksisterende `AIUsageLog` — nye feature-typer registreres
- **OpenAI Client:** Eksisterende `src/lib/ai/client/` — ingen ændringer

## Nye DB-modeller (samlet)

```prisma
model Alert {
  id              String    @id @default(cuid())
  organization_id String
  severity        AlertSeverity  // CRITICAL, WARNING, INFO
  category        AlertCategory  // DEADLINE, MISSING, RISK, COMPLIANCE
  entity_type     String         // company, contract, person
  entity_id       String
  message         String
  details         Json?
  dismissed_at    DateTime?
  dismissed_by    String?
  created_at      DateTime  @default(now())
  organization    Organization @relation(fields: [organization_id], references: [id])
}

model Conversation {
  id              String    @id @default(cuid())
  organization_id String
  user_id         String
  title           String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  messages        Message[]
  organization    Organization @relation(fields: [organization_id], references: [id])
}

model Message {
  id              String    @id @default(cuid())
  conversation_id String
  role            MessageRole  // USER, ASSISTANT, SYSTEM
  content         String
  tool_calls      Json?
  tool_results    Json?
  tokens_used     Int?
  cost_usd        Decimal?
  created_at      DateTime  @default(now())
  conversation    Conversation @relation(fields: [conversation_id], references: [id])
}

model PendingAction {
  id              String    @id @default(cuid())
  conversation_id String
  action_type     String    // create_task, create_case, update_contract_status, create_reminder
  payload         Json
  status          PendingActionStatus  // PENDING, CONFIRMED, REJECTED, EXPIRED
  created_at      DateTime  @default(now())
  resolved_at     DateTime?
}
```

## Kost-oversigt

| Feature                | Model               | Estimat/måned       |
| ---------------------- | ------------------- | ------------------- |
| 1. Dokument enrichment | gpt-5-mini + nano   | $2-8                |
| 2. Formular-autofill   | nano + CVR (gratis) | $0.50-2             |
| 3. Proaktive alerts    | rule-based + nano   | $1-3                |
| 4. Chat-assistent      | gpt-5-mini          | $10-35              |
| **Total**              |                     | **$13.50-48/måned** |
