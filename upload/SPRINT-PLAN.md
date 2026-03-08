# SPRINT-PLAN.md
# ChainHub — Byggeplan
**Opdateres af:** BA-01 (Orchestrator)
**Læses af:** Alle build-agenter inden session start

---

## Principper

```
1. Spec godkendes FØR kode skrives
   Alle DEA-challenge-runder på CONTRACT-TYPES.md og DATABASE-SCHEMA.md
   skal være afsluttet (DECISIONS.md: ingen KRITISK tilbage) inden
   Sprint 1 starter.

2. Tre gennemløb pr. modul
   Skeleton → Functionality → Polish
   Ingen modul erklæres færdigt efter ét gennemløb.

3. Fundament før features
   Auth, schema og permissions skal være produktionsklare
   inden første feature-modul påbegyndes.

4. Vertikal slice
   Hvert sprint leverer ét komplet, brugbart modul —
   ikke halvfærdige lag på tværs af moduler.
```

---

## Fase 0 — Spec (før kode)

```
[ ] CONTRACT-TYPES.md godkendt (DEA-challenge-runde gennemført)
[ ] DATABASE-SCHEMA.md udkast klar
[ ] DATABASE-SCHEMA.md godkendt (DEA-challenge-runde gennemført)
[ ] roller-og-tilladelser.md godkendt
[ ] UI-FLOWS.md udkast klar
[ ] API-SPEC.md udkast klar

Blokerer: alt i Sprint 1+
```

---

## Sprint 1 — Fundament

**Mål:** Systemet kan starte, brugere kan logge ind, databasen er klar.
**Agenter:** BA-02 (Schema), BA-03 (Auth), BA-08 (DevOps)

```
[ ] Projektopsætning
    Next.js 14 + TypeScript + Tailwind + shadcn/ui
    ESLint + Prettier + Husky pre-commit hooks

[ ] Database
    Prisma schema v1 (alle tabeller, enums, relationer)
    Migrations kørende
    Seed data (testorganisation, testbrugere, eksempeldata)

[ ] Auth
    NextAuth.js med email/password
    Microsoft OAuth (Azure AD)
    Session-håndtering
    Middleware til route-beskyttelse

[ ] Permissions
    user_role_assignments tabel
    canAccessCompany(), canAccessSensitivity(),
    canAccessModule(), getAccessibleCompanies()
    Unit tests på alle helpers

[ ] DevOps
    Vercel deployment (staging + produktion)
    Environment variables dokumenteret i .env.example
    Startup-validering af env vars
    GitHub Actions CI (lint + typecheck + test)

[ ] Dashboard shell
    Layout med sidebar og header (tom — ingen data endnu)
    Navigation til alle moduler
    Bruger-menu med logout

Succeskriterium: Bruger kan registrere sig, logge ind med
Microsoft og se et tomt dashboard.
```

---

## Sprint 2 — Kernobjekter

**Mål:** Selskaber og personer kan oprettes og administreres.
**Agenter:** BA-04 (UI), BA-05 (Feature), BA-07 (QA), BA-09 (Performance)

```
[ ] Selskabsprofil — Skeleton
    Tom side med korrekt URL-struktur og faner

[ ] Selskabsprofil — Functionality
    Stamdata (CVR, navn, adresse, status)
    Ejerskab (ejere med %, ejertype, dato)
    Governance (direktør, bestyrelse, tegningsberettigede)
    Ansatte (roller, ansættelsestype, kontrakt-reference)
    Aktivitetslog

[ ] Selskabsprofil — Polish
    Tomme states, loading states, fejlhåndtering
    Inline-redigering af stamdata

[ ] Persondatabase — Skeleton + Functionality + Polish
    Global kontaktbog på tværs af selskaber
    En person → flere selskaber med forskellige roller
    Outlook-import (Microsoft Graph API kontakter)

Succeskriterium: Bruger kan oprette selskab, tilføje ejere
og medarbejdere, og se personen gå igen på tværs af selskaber.
```

---

## Sprint 3 — Kontraktstyring

**Mål:** Kontrakter kan oprettes, styres og genererer advisering.
**Agenter:** BA-05 (Feature), BA-06 (Integration — advisering), BA-07 (QA)

```
[ ] Kontraktstyring — Skeleton
[ ] Kontraktstyring — Functionality
    Opret kontrakt (alle 33 system_types, bruger-defineret display_name)
    Lag 2-typer aktiveres kun ved kæde-struktur
    Status-flow (UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV →
                 UDLØBET / OPSAGT / FORNYET / ARKIVERET)
    Sensitivity-minimum håndhæves
    Parter og underskrivere
    Fil-upload (PDF/DOCX) + preview
    Versionsstyring
    Relationer (parent_contract_id, triggered_by_id)

[ ] Kontraktstyring — Polish
    Adviseringslogik (90/30/7 dage)
    Løbende kontrakter: advis baseret på notice_period_days
    ABSOLUT deadline-register: røde advarsler
    Auto-renewal logik for leverandørkontrakter

[ ] Dokumenthåndtering (grundlæggende)
    Upload, preview, download
    Tilknytning til selskab og kontrakt

Succeskriterium: Bruger kan oprette en ejeraftale, uploade PDF,
tilknytte parter — og modtager email-advis 90 dage før udløb.
```

---

## Sprint 4 — Sager og opgaver

**Mål:** Sager og opgaver kan oprettes og styres.
**Agenter:** BA-05 (Feature), BA-07 (QA)

```
[ ] Sagsstyring — Skeleton + Functionality + Polish
    Sagstyper (M&A, Tvist, Compliance, Kontraktforhandling...)
    Tilknytning til selskaber, kontrakter, personer
    Opgave-liste pr. sag
    Frister og ansvarlige
    Email-sync via BCC (Microsoft Graph)

[ ] Opgavestyring — Skeleton + Functionality + Polish
    Kanban / liste / kalendervisning
    Daglig email-digest
    Outlook Calendar push for deadlines

Succeskriterium: Bruger kan oprette en M&A-sag, tilknytte
relevante kontrakter og modtage daglig opgave-digest på email.
```

---

## Sprint 5 — Dashboard og økonomi

**Mål:** Portfolio-overblik og økonomi-modul.
**Agenter:** BA-05 (Feature), BA-09 (Performance), BA-07 (QA)

```
[ ] Portfolio-dashboard
    Overblik over alle selskaber
    Status, ejerandel, aktive sager, udløbende kontrakter
    Filtrering (status, region, ejerandel, sagstype)
    Performance: aggregerede counts — ikke N+1

[ ] Økonomi-overblik (light)
    Nøgletal pr. selskab (manuelt/importeret)
    Tidsregistrering fra sager
    Intern fakturaoversigt
    Udbyttenotering

Succeskriterium: Bruger med 10 selskaber ser komplet overblik
på under 2 sekunder (BA-09 validerer query-tid).
```

---

## Sprint 6 — Produktion og sikkerhed

**Mål:** Systemet er produktionsklart.
**Agenter:** BA-08 (DevOps), BA-10 (Test), BA-11 (Pentest), BA-07 (QA)

```
[ ] Fuld testsuite
    Unit tests på alle permissions helpers
    Integration tests på tenant isolation
    E2E tests på kritiske flows (Playwright)

[ ] Security pentest
    Tenant isolation verifikation
    IDOR-test på alle endpoints
    Privilege escalation forsøg
    Input validation

[ ] Stripe Billing
    Per-seat subscriptions
    Trial-periode (14 dage)
    Webhook (www-prefix — ikke-forhandlingsbart)

[ ] Produktion
    Runbook (/docs/ops/RUNBOOK.md)
    Monitoring og alerting
    Backup-strategi

Succeskriterium: BA-11 finder ingen KRITISKE sikkerhedshuller.
Alle ikke-forhandlingsbare tests er grønne.
```

---

## Tidsoversigt

```
Fase 0 — Spec          Igangværende
Sprint 1 — Fundament   ~2 uger
Sprint 2 — Kernobjekter ~2 uger
Sprint 3 — Kontrakter  ~2 uger
Sprint 4 — Sager       ~1,5 uger
Sprint 5 — Dashboard   ~1,5 uger
Sprint 6 — Produktion  ~1 uge
─────────────────────────────────
Total                  ~10 uger intensivt
```

---

## Changelog

```
v0.2 (QA-rettet):
  [K1] Forældet tabel-navn rettet (linje 68):
       user_roles → user_role_assignments
  [K2] Kontraktstatus-flow udbygget til fuld model (linje 131):
       UDKAST → AKTIV  →
       UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV →
       UDLØBET / OPSAGT / FORNYET / ARKIVERET
       (matcher API-SPEC.md v0.3 updateContractStatus-transitioner)
  [M1] Filnavn rettet (linje 37):
       ROLLER-OG-TILLADELSER.md → roller-og-tilladelser.md

v0.1:
  Første udkast
```
