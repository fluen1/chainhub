# PROGRESS.md — ChainHub MABS

Opdateret: Sprint 1 af BA-01

## Fase 0 — Spec
- [x] CONTRACT-TYPES.md godkendt (DEA-challenge-runde gennemført)
- [x] DATABASE-SCHEMA.md godkendt (DEA-challenge-runde gennemført)
- [x] roller-og-tilladelser.md godkendt
- [x] kravspec-legalhub.md godkendt
- [x] UI-FLOWS.md godkendt
- [x] API-SPEC.md godkendt

## Sprint 1 — Fundament ✅
- [x] Projektopsætning (Next.js 14 + TypeScript + Tailwind)
- [x] Prisma schema v1 (alle tabeller, enums, relationer)
- [x] prisma generate OK
- [x] Auth (NextAuth.js med credentials provider)
- [x] Permissions (canAccessCompany, canAccessSensitivity, canAccessModule, getAccessibleCompanies)
- [x] Middleware (route-beskyttelse)
- [x] Dashboard shell (sidebar + header)
- [x] Alle route-sider (skeleton): /dashboard, /companies, /companies/[id], /contracts, /cases, /tasks, /persons, /documents, /settings
- [x] Login-side
- [x] Sprint-gate: npm install ✓ | prisma generate ✓ | tsc ✓ | next build ✓
- [ ] Database migration (BLOKERET — Supabase ikke tilgængelig, se BLK-001)
- [ ] Seed data (BLOKERET — venter på database)

## Sprint 2 — Kernobjekter
- [ ] Selskabsprofil — Skeleton
- [ ] Selskabsprofil — Functionality
- [ ] Selskabsprofil — Polish
- [ ] Persondatabase — Skeleton + Functionality + Polish

## Sprint 3 — Kontrakter
- [ ] Kontraktstyring — Skeleton
- [ ] Kontraktstyring — Functionality
- [ ] Kontraktstyring — Polish

## Sprint 4 — Sager
- [ ] Sagsstyring
- [ ] Opgavestyring

## Sprint 5 — Dashboard
- [ ] Portfolio-dashboard
- [ ] Økonomi-overblik

## Sprint 6 — Produktion
- [ ] Fuld testsuite
- [ ] Security pentest
- [ ] Stripe Billing
- [ ] Produktion

## Kendte blokkere
→ Se BLOCKERS.md
