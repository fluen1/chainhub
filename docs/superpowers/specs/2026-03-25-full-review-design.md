# ChainHub — Komplet side-gennemgang

**Dato:** 2026-03-25
**Formål:** Sikre at alle sider er "tænkt til ende" — funktionelt, visuelt og arkitektonisk.

---

## Tilgang: To faser

### Fase 1: Konsolidering (teknisk fundament)
Ryd op i duplikeret kode, inkonsistente mønstre og manglende sikkerhed FØR vi laver UX-gennemgang. Ellers fikser vi det samme problem 10 gange.

### Fase 2: Side-for-side gennemgang
Tag hver side i rækkefølge. For hver side: spar om formål, gennemgå mod tjekliste, implementér rettelser, verificér med Playwright.

---

## Fase 1: Konsolidering — Scope

### 1A. Centralisér alle labels i labels.ts
10 sider har lokale hardcoded label-maps der duplikerer (eller afviger fra) labels.ts.

**Sider der skal migreres:**
- `companies/[id]/cases/page.tsx` — STATUS_LABELS, STATUS_STYLES
- `companies/[id]/contracts/page.tsx` — STATUS_LABELS, SENSITIVITY_LABELS
- `companies/[id]/employees/page.tsx` — ROLE_LABELS
- `companies/[id]/finance/page.tsx` — METRIC_LABELS, SOURCE_LABELS
- `companies/[id]/governance/page.tsx` — ROLE_LABELS
- `cases/page.tsx` — STATUS_LABELS, STATUS_STYLES, TYPE_LABELS
- `cases/[id]/page.tsx` — STATUS_LABELS, STATUS_STYLES, TYPE_LABELS, PRIORITY_LABELS
- `contracts/[id]/page.tsx` — STATUS_LABELS, STATUS_STYLES, SENSITIVITY_LABELS
- `tasks/page.tsx` — PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS
- `persons/[id]/page.tsx` — ROLE_LABELS

**Tilgang:**
1. Tilføj manglende labels til `src/lib/labels.ts` (case status/styles, case type, priority, roles, metric types, sources)
2. Fjern lokale label-maps fra alle 10 sider
3. Importér fra labels.ts i stedet

### 1B. Auth-check på alle "opret ny" sider
5 client-component sider mangler session-validering:
- `companies/new/page.tsx`
- `cases/new/page.tsx`
- `contracts/new/page.tsx`
- `tasks/new/page.tsx`
- `persons/new/page.tsx`

**Tilgang:** Konvertér til server component wrapper der tjekker auth + henter nødvendig data, og renderer client-form-component som child.

### 1C. Konsistente Zod-valideringer
- Fjern `z.string().uuid()` fra alle validerings-schemas (afviser seed-data UUIDs)
- Erstat med `z.string().min(1)`
- Tjek alle validerings-filer: company, contract, case, person, governance, ownership, user

---

## Fase 2: Side-for-side gennemgang — Struktur

### Tjekliste pr. side (12 punkter)

For HVER side gennemgås:

1. **Formål + brugerforventninger** — Hvad er sidens job? Hvad kommer brugeren for at gøre? Hvornår er de "færdige"?
2. **Auth + permissions** — Session-check, module/company/sensitivity-check
3. **Labels** — Alt via labels.ts, ingen hardcoded tekst
4. **Søgning + filtrering + pagination** — På alle listesider
5. **Tom state** — Meningsfuld besked + handlingsanvisning
6. **Fejlhåndtering** — Dansk, handlingsanvisende
7. **Visuelt hierarki** — Vigtigste info mest fremtrædende
8. **Interaktivitet** — Alle knapper/links virker, feedback via toast
9. **Responsivt** — Fungerer på tablet (iPad)
10. **Konsistens** — Samme mønstre, farver, spacing
11. **Skalerbarhed** — Fungerer med 56 lokationer × 25+ records
12. **Rolle-bevidsthed** — Viser kun handlinger brugeren har adgang til

### Side-rækkefølge (komplet — inkl. alle undersider)

Gennemgangen følger brugerrejsen. Hver underside gennemgås individuelt.

**Runde 1 — Auth + Dashboard:**
1. `/login` — Login-side
2. `/dashboard` — Portfolio-dashboard (urgency, KPI, selskabskort, kommende besøg)

**Runde 2 — Selskaber (9 undersider):**
3. `/companies` — Selskabsliste (card-grid, filtre, pagination)
4. `/companies/new` — Opret selskab
5. `/companies/[id]/overview` — Overblik (KPI, alerts, nøglepersoner)
6. `/companies/[id]/stamdata` — Stamdata (CVR, adresse, rediger)
7. `/companies/[id]/contracts` — Selskabets kontrakter
8. `/companies/[id]/cases` — Selskabets sager
9. `/companies/[id]/employees` — Ansatte
10. `/companies/[id]/governance` — Governance (direktør, bestyrelse)
11. `/companies/[id]/ownership` — Ejerskab (ejerandele, advarsler)
12. `/companies/[id]/finance` — Økonomi (nøgletal pr. år)
13. `/companies/[id]/documents` — Selskabets dokumenter
14. `/companies/[id]/log` — Aktivitetslog
15. `/companies/[id]/visits` — Selskabets besøg

**Runde 3 — Kontrakter (3 sider):**
16. `/contracts` — Kontraktliste (grupperet/flat, filtre)
17. `/contracts/new` — Opret kontrakt
18. `/contracts/[id]` — Kontraktdetalje (stamdata, parter, versioner, dokumenter)

**Runde 4 — Sager (3 sider):**
19. `/cases` — Sagsliste (grupperet/flat, filtre)
20. `/cases/new` — Opret sag
21. `/cases/[id]` — Sagsdetalje (opgaver, selskaber, kontrakter)

**Runde 5 — Opgaver (2 sider):**
22. `/tasks` — Opgaveliste (forfaldne/kommende, filtre)
23. `/tasks/new` — Opret opgave

**Runde 6 — Personer (3 sider):**
24. `/persons` — Persondatabase (card-grid, søgning)
25. `/persons/new` — Opret person
26. `/persons/[id]` — Persondetalje (roller, tilknytninger)

**Runde 7 — Dokumenter (1 side):**
27. `/documents` — Dokumentliste (upload, download, filtre)

**Runde 8 — Besøg (3 sider):**
28. `/visits` — Besøgsliste (filtre, pagination)
29. `/visits/new` — Planlæg besøg
30. `/visits/[id]` — Besøgsdetalje (noter, status, referat)

**Runde 9 — Støtte (2 sider):**
31. `/search` — Global søgning
32. `/settings` — Brugerstyring

**Total: 32 sider/undersider**

### Proces pr. side

```
1. Spar: Diskutér sidens formål med bruger (1 spørgsmål)
2. Audit: Gennemgå kode mod tjekliste
3. Design: Foreslå forbedringer (med Playwright screenshots/mockups)
4. Godkend: Bruger godkender rettelser
5. Implementér: Subagent udfører rettelser
6. Verificér: Playwright-test af færdig side
7. Næste side
```

---

## Hvad vi IKKE gør i denne gennemgang

- Nye features der ikke er specced (ingen nye moduler)
- Redesign af farvetema eller branding
- Performance-optimering (medmindre skalerbarhed kræver det)
- Refaktorering af server actions (de virker korrekt)
- Ændring af database-schema
