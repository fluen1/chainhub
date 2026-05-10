# ChainHub Master Review — Design (2026-05-10)

**Type:** Audit + fix-runde. Producer ét samlet review-dokument der besvarer "er ChainHub klar til pilot-kunde, og hvor halter den?" på fem akser: side-for-side, UI/UX, kommercielt, redundans, arkitektur. Følges af målrettede fixes.

**Trigger:** Bruger ønsker at "komme i mål" med programmet. Tidligere page-audit fra 2026-04-18 (`docs/status/PAGE-AUDIT-2026-04.md`, 687 linjer) er tech-fokuseret og forældet efter Mobile + Empty-states-track + Compliance + Onboarding + R2 + axe-core leverancer.

**Mål:** Bruger får (1) ét beslutnings-dokument der klart siger "send til pilot" eller "fix X først", (2) konkrete quick wins er allerede fixet, (3) større tasks står klar i en prioriteret liste til næste session.

---

## Leverance-struktur

### Dokument 1: `docs/status/MASTER-REVIEW-2026-05.md`

```
1. Eksekutiv opsummering
   - Pilot-readiness gennemsnit + top 3 spærrere
   - Kommercielt billede pr. tier (Basis/Plus/Enterprise)
   - Top 3 redundans-fund
   - Fixes leveret denne session (commits-link)

2. Arkitektonisk overblik
   - src/-træ med 1-linjes formål pr. mappe
   - ASCII data-flow: request → action → permission → prisma → revalidate → UI
   - Navigations-træ: sidebar groupings + URL-mønster

3. Side-for-side review (~25 sider)
   For hver:
     - Formål (1 sætning) + primær rolle (GROUP_OWNER/LEGAL/FINANCE/MANAGER)
     - Tier-relevans: Basis ✅ / Plus ➕ / Enterprise ➕➕
     - Pilot-readiness 1-5 + gap til 5/5
     - UI/UX-status (kort, opdateret efter siden)
     - Kommerciel rolle: "wow" | "nyttig" | "infrastruktur" | "skjult"
     - Redundans-flag (hvis siden overlapper med anden)

4. Redundans-katalog
   - Komponent-overlap (samme mønster i 2+ filer)
   - Action-overlap (query-shape duplikeret)
   - Død kode (filer ikke importeret)
   - Konkurrerende UI-mønstre (3 forskellige måder at gøre samme ting)

5. Fix-prioritering
   - P0: Pilot-blockers
   - P1: Quick wins (<30 min, høj værdi)
   - P2: Næste sprint
   - P3: Nice-to-have
```

### Side-inventar (forventet ~25 ruter)

Top-level i `src/app/(dashboard)/`:
calendar, cases, cases/new, cases/[id], companies, companies/new, companies/[id],
contracts, contracts/new, contracts/[id], dashboard, documents, documents/review/[id],
persons, persons/new, persons/[id], search, settings, settings/users, settings/ai-usage,
tasks, tasks/new, tasks/[id], visits/new, visits/[id]

Calendar erstatter `/visits`-listen (slettet i Plan 4D).

---

## Fix-runde — afgrænsning

**Inkluderet i denne session:**

- P1 quick wins fixes løbende (dead code, hardcoded labels, navigation-fejl, åbenlyse redundans-konsolideringer)
- Hver fix får sin egen commit
- Hard limit: maks 10 fix-commits

**Ikke inkluderet (parkeres som tasks i dokumentet):**

- P0 og P2: dokumenteres med konkret fix-plan, men implementeres KUN hvis bruger eksplicit godkender efter review
- Større refactors (mere end ~50 linjer)
- Schema-ændringer

**Test-gate efter alle fixes:** `npm test` + `npm run build` + `npx tsc --noEmit` skal være grønne før session afsluttes.

---

## Scoring-rubric (Pilot-readiness 1-5)

| Score | Betydning                                                                  |
| ----- | -------------------------------------------------------------------------- |
| 5     | Send-it. Pilot-kunde bruger den uden friktion.                             |
| 4     | Næsten klar. Mindre kosmetik eller én lille bug.                           |
| 3     | Funktionel men har et tydeligt hul (mobile, empty state, language).        |
| 2     | Risiko. Pilot-kunde vil støde på det og spørge "hvorfor virker det ikke?". |
| 1     | Skjul indtil fixet.                                                        |

## Kommerciel rolle

| Rolle             | Eksempel                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| **wow**           | Side der overbeviser i demo (urgency-dashboard, AI-extractions-review) |
| **nyttig**        | Side der bruges dagligt men ikke wow'er (kontrakt-liste)               |
| **infrastruktur** | Sjældent åbnet, skal bare fungere (settings, GDPR)                     |
| **skjult**        | Bag detail-sider, tæller ikke som demo (visits/new)                    |

---

## Procesplan

1. Arkitektur-map (læs src/-struktur, byg træ + data-flow)
2. Navigations-træ (sidebar + URL-mønster)
3. Side-for-side: pr. side læs page.tsx + score + flag fixes
4. Redundans-katalog (grep efter duplikerede patterns + dead-code-scan)
5. Konsolidér fix-prioritering
6. Eksekutiv opsummering (skrives sidst, opsamler alle fund)
7. Quick wins eksekveres løbende (commits)
8. Test-gate
9. Final commit af review-dokument

---

## Out of scope

- Performance-måling (Lighthouse) — egen sessions, kræver dev/prod-server
- E2E-test-tilføjelse — separate session
- WCAG 2.2 AA-delta — separat axe-core-eksekvering
- Deploy-arbejde (Vercel, Resend, Supabase Pro) — Gate 2-track
- Nye features

Alle disse markeres i fix-prioriteringen, men implementeres ikke nu.
