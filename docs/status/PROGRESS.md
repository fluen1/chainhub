# PROGRESS.md

# ChainHub — Byggestatus

**Opdateres af:** BA-01 (Orchestrator) efter hver session
**Format:** [ ] ikke startet [~] i gang [x] færdigt [!] blokeret

## Fase 0 — Spec

[x] kravspec-legalhub.md v2.1 — QA-rettet
[x] CONTRACT-TYPES.md v0.5 — DEA-challenge-rettet
[x] DATABASE-SCHEMA.md v0.4 — DEA-challenge-rettet
[x] roller-og-tilladelser.md v0.2 — QA-rettet
[x] UI-FLOWS.md v0.3 — QA-rettet
[x] API-SPEC.md v0.3 — QA-rettet
[x] CONVENTIONS.md v0.3 — QA-R2-rettet
[x] DEA-challenge-runde gennemført — ingen KRITISK uresolveret
[x] CONTRACT-TYPES.md — godkendt efter DEA-challenge
[x] DATABASE-SCHEMA.md — godkendt efter DEA-challenge

## Sprint 1 — Fundament

[x] Projektopsætning
[x] Database (Prisma schema + migrations + seed)
[ ] Auth (NextAuth + Microsoft OAuth)
[ ] Permissions (helpers + unit tests)
[ ] DevOps (Vercel + CI + .env.example)
[ ] Dashboard shell

## Sprint 2 — Kernobjekter

[ ] Selskabsprofil (skeleton + functionality + polish)
[ ] Persondatabase (skeleton + functionality + polish)

## Sprint 3 — Kontraktstyring

[ ] Kontraktstyring (skeleton + functionality + polish)
[ ] Dokumenthåndtering (grundlæggende)

## Sprint 4 — Sager og opgaver

[ ] Sagsstyring (skeleton + functionality + polish)
[ ] Opgavestyring (skeleton + functionality + polish)

## Sprint 5 — Dashboard og økonomi

[ ] Portfolio-dashboard
[ ] Økonomi-overblik

## Sprint 6 — Produktion

[ ] Testsuite komplet
[ ] Security pentest
[ ] Stripe Billing
[ ] ChainHub DPA-template (DEC-018)
[ ] Anonymiserings-cron (DEC-015)
[ ] Produktion klar

## Seneste opdatering

Dato: 2026-03-08
Af: BA-02 (Schema) via BA-01 (Orchestrator)
Note: Prisma schema v1 færdig — prisma validate OK.
      20 modeller, 30 enums, alle DEC-beslutninger indarbejdet.
      DEC-008: MetricType/PeriodType/MetricSource enums
      DEC-016: organization_id på junction-tabeller
      DEC-019: Organization-relationer på FinancialMetric/TimeEntry
      Seed: DentGroup testorganisation med 3 selskaber, 5 kontrakter.
      Migration afventer DATABASE_URL (PostgreSQL).
