# DECISIONS.md — Arkitekturbeslutninger

---

## FASE 0 — SPEC-TILLAEG-v2 (2026-03-12)

---

### DEC-F0-001: Multi-tenancy på nye tabeller — ACCEPTED

**Indsigelse:** `visit_participants`, `task_comments`, `task_history`, `company_notes`
mangler eksplicit `organization_id` i schema-definitionen i SPEC-TILLAEG-v2.
**Beslutning:** ACCEPTED — ALLE nye tabeller i Sprint 8 SKAL have `organization_id UUID NOT NULL`
som første kolonne efter `id`.
**Konsekvens:** Schema-definitionen i SPEC-TILLAEG opdateres med `organization_id` på alle 4 tabeller.

---

### DEC-F0-002: Sensitivity på company_notes — ACCEPTED

**Indsigelse:** `company_notes` mangler `sensitivity SensitivityLevel`-kolonne.
Notater kan indeholde STRENGT_FORTROLIG information (fx ejerskifteplaner).
**Beslutning:** ACCEPTED — `company_notes` tilføjer `sensitivity SensitivityLevel @default(INTERN)`.
UI viser sensitivity-badge på noter. Adgangscheck som på kontrakter.
**Konsekvens:** Schema og UI opdateres. Default INTERN (konservativ).

---

### DEC-F0-003: task_comments mangler deleted_at — ACCEPTED

**Indsigelse:** `task_comments` har ingen `deleted_at` — GDPR-sletning af persondata
i kommentarer er ikke mulig.
**Beslutning:** ACCEPTED — `task_comments` tilføjer `deleted_at DateTime?` + `updated_at DateTime @updatedAt`.
**Konsekvens:** Soft delete pattern konsistent på alle tabeller.

---

### DEC-F0-004: VisitType OVERDRAGELSE tilføjes — ACCEPTED

**Indsigelse:** `VisitType`-enum i Modul A mangler `OVERDRAGELSE` som type.
Nye partnere der overtager klinik kræver et dedikeret første besøg.
**Beslutning:** ACCEPTED — `VisitType` enum: KVARTALSBESOEG | OPFOELGNING | AD_HOC | AUDIT | ONBOARDING | OVERDRAGELSE
**Konsekvens:** Schema opdateres. UI dropdown tilføjer "Overdragelse".

---

### DEC-F0-005: Dashboard urgency panel — "Klinikker ikke besøgt i 90+ dage" — ACCEPTED

**Indsigelse:** Urgency panel (§0.3) mangler signal: "Klinikker der ikke er besøgt i 90+ dage".
Dette er kritisk for kædeledere med 12+ klinikker.
**Beslutning:** ACCEPTED — Tilføjes som urgency-type i §0.3 spec:
`🟡 Klinikker uden besøg i 90+ dage: [Klinik Aarhus — sidst besøgt 14/11]`
Query: `SELECT company_id FROM visits WHERE visit_date < NOW() - INTERVAL '90 days'`

- selskaber der slet ingen visits har.
  **Konsekvens:** Dashboard urgency panel tilføjer denne query i Sprint 7.

---

### DEC-F0-006: Urgency panel viser SPECIFIKKE items — ikke counts — ACCEPTED

**Indsigelse:** Urgency panel §0.3 skriver "Forfaldne opgaver (X stk)". Ved klik
lander bruger på opgavelisten med 47 opgaver. De X forfaldne er ikke identificerede.
**Beslutning:** ACCEPTED — Urgency panel viser ALTID specifikke items (titel + selskab + dage),
IKKE counts. Max 10 items. Ingen "X stk" uden at linke til præcis det item.
**Konsekvens:** Urgency panel implementeres med individuelle links.

---

### DEC-F0-007: Global søgning flyttes til Sprint 7 (begrænset scope) — ACCEPTED

**Indsigelse:** Global søgning er NICE-TO-HAVE Sprint 9. For 15+ klinikker og 200+
kontrakter er det NEED-TO-HAVE. Churn-risiko.
**Beslutning:** ACCEPTED (begrænset) — Sprint 7 tilføjer global søgning i header:
søger kun på navn/CVR (selskaber) + titel (kontrakter, sager). Ingen fulltext index.
Simple PostgreSQL LIKE-query. Fulltext (Meilisearch) forbliver Fase 2.
**Konsekvens:** Sprint 7 scope udvides med minimal søgefunktion (2-3 timers arbejde).

---

### DEC-F0-008: Prøvetid-tracking i urgency panel — ACCEPTED

**Indsigelse:** `probation_end_date` fra KT-07 vises ikke i urgency panel. En kædeleder
bør se "⚠ Prøvetid udløber d. 15/3 for Jens Hansen" i urgency panelet.
**Beslutning:** ACCEPTED — Urgency panel tilføjer prøvetid som urgency-type (30 dage advarsel):
`🟡 Prøvetid udløber: [Jens Hansen — Tandlæge Østerbro — 15/3]`
Query: find kontrakter af type ANSÆTTELSE_FUNKTIONÆR/IKKE_FUNKTIONÆR/UDDANNELSESAFTALE
hvor `type_data->>'probation_end_date' BETWEEN NOW() AND NOW() + INTERVAL '30 days'`.
**Konsekvens:** Urgency panel spec §0.3 opdateres med prøvetid-signal.

---

### DEC-F0-009: Løbende kontrakter i urgency panel — ACCEPTED

**Indsigelse:** Urgency panel nævner "Kontrakter der udløber inden 14 dage" men løbende
kontrakter (expiry_date=NULL) med auto-renewal og review-dato mangler.
**Beslutning:** ACCEPTED — Urgency panel tilføjer:
`🟡 Løbende kontrakter med auto-renewal, opsigelsesvindue inden 30 dage`
Logik: kontrakter med `auto_renewal=true` og `expiry_date IS NOT NULL`
hvor `expiry_date - notice_period_days - 14 dage <= NOW()`.
**Konsekvens:** §0.3 urgency panel spec opdateres.

---

### DEC-F0-010: ChangeType vises i version-upload dialog — ACCEPTED

**Indsigelse:** `ChangeType` enum (REDAKTIONEL/MATERIEL/ALLONGE) eksisterer i schema
men mangler UI i version-upload dialog.
**Beslutning:** ACCEPTED — Version-upload dialog i Sprint 8 SKAL inkludere:
ChangeType dropdown (REDAKTIONEL | MATERIEL | ALLONGE) + change_note textarea (valgfrit).
**Konsekvens:** Sprint 8 scope for kontraktversioner opdateres.

---

### DEC-F0-011: Besøgsreferat — updated_at og versionsnotat — ACCEPTED

**Indsigelse:** `visits.summary` kan redigeres uden versionshistorik. Juridisk problematisk.
**Beslutning:** ACCEPTED (pragmatisk) — `visits` tabellen tilføjer `updated_at DateTime @updatedAt`
og `summary_updated_by UUID?`. UI viser "Referat sidst redigeret [dato] af [navn]" som
read-only info. Fuld versionshistorik for besøgsreferater er Fase 2.
**Konsekvens:** Schema tilføjer `updated_at` + `summary_updated_by` på `visits`.

---

### DEC-F0-012: Konsolideret økonomi-overblik på dashboard — WONT-FIX (Sprint 7-9)

**Indsigelse:** Manglende konsolideret EBITDA/omsætning på tværs af klinikker i dashboard.
**Beslutning:** WONT-FIX for Sprint 7-9. FinancialMetric-data er manuelt indskrevet
og aggregering giver ikke meningsfuldt konsolideret tal. Fase 2 med E-conomic-integration.
Sprint 9 tilføjer evt. simpel summering hvis tid tillader.

---

### DEC-F0-013: Onboarding "Kom godt i gang"-panel — ACCEPTED

**Indsigelse:** Ingen ny-bruger-sti. En kædeleder ser tomme lister ved første login.
**Beslutning:** ACCEPTED — Dashboard tilføjer "Kom godt i gang"-panel der vises
de første 14 dage (eller til 3 steps er gennemført):

1. "Opret dit første selskab" → link til opret-wizard
2. "Tilføj din første kontrakt" → link til ny kontrakt
3. "Invitér en kollega" → link til /settings/users
   Panel skjules automatisk når alle 3 steps er gennemført.
   Implementeres i Sprint 7.
   **Konsekvens:** Sprint 7 scope tilføjer onboarding-panel.

---

### DEC-F0-014: Email-digest flyttes til Sprint 8 — ACCEPTED

**Indsigelse:** Email-advisering er Fase 2. Men systemet vil ikke erstatte
Excel/email-workflow uden minimum én notifikation. Churn-risiko.
**Beslutning:** ACCEPTED (begrænset) — Sprint 8 implementerer daglig email-digest
via Resend (ikke Microsoft Graph). Kl. 07:00: send til bruger hvis de har forfaldne
opgaver eller kontrakter der udløber inden 7 dage. Intet opret-konto krav.
Resend tilføjes som ny dependency i Sprint 8.
**Konsekvens:** Sprint 8 scope tilføjer simpel email-digest.

---

### DEC-F0-015: Besøgshandlingspunkter — inline oprettelse — ACCEPTED

**Indsigelse:** Handlingspunkter fra besøg kræver modal/slide-over — unødvendig friktion.
**Beslutning:** ACCEPTED — Besøgsdetaljeside bruger inline input for handlingspunkter:
`[+] Skriv handlingspunkt og tryk Enter` — opretter Task direkte med `source_type=BESOEG`.
Trello-stil. Ingen modal. Samme mønster som GitHub Issues quick-add.
**Konsekvens:** Inline task-oprettelse implementeres på besøgsdetaljeside.

---

### DEC-F0-016: Besøgs-kilde synlig i opgavelisten — ACCEPTED

**Indsigelse:** Handlingspunkter fra besøg drukner i opgavelisten (50+ opgaver).
Kildeinformation mangler synlighed.
**Beslutning:** ACCEPTED — Opgaveliste viser kilde-badge pr. opgave:
`[📍 Besøg Østerbro 14/2]` som klikbart badge → navigerer til besøget.
Filtermulighed: "Vis kun fra besøg" toggle i opgaveliste.
**Konsekvens:** Opgaveliste opdateres i Sprint 8 med kilde-badge og filter.

---

### DEC-F0-017: UI-løsninger godkendt som implementeringsguide — ACCEPTED

**Indsigelse:** (Ingen indsigelse — positivt fund)
**Beslutning:** ACCEPTED — Konkrete layout-beskrivelser (Tailwind-klasser)
bruges som bindende implementeringsguide i Sprint 7:

- Card-grid layout (DEC-F0-017a)
- Urgency panel layout (DEC-F0-017b)
- Overbliksfane layout (DEC-F0-017c)
- Persondatabase cards (DEC-F0-017d)
- Sidebar med counts (DEC-F0-017e)
  Se Tailwind-specifikationer i de respektive beslutninger.

---

### DEC-F0-018: Cloudflare R2 — mock i Sprint 8, reel integration Sprint 9 — ACCEPTED

**Indsigelse:** R2-integration kan blokere Sprint 8.
**Beslutning:** ACCEPTED — Sprint 8 implementerer upload med lokal tmp-storage
(Next.js `/public/uploads/` eller lignende) med korrekt interface (presigned URL pattern).
R2 swappes ind i Sprint 9 med én linje konfigurationsskift.
UNDTAGELSE: Hvis R2-integration er <4 timer ekstraarbejde,
implementeres det direkte i Sprint 8.
**Konsekvens:** Sprint 8 er ikke blokeret af R2-konto/credentials.

---

## KRITISKE INDSIGELSER — OPSUMMERING

```
TOTAL KRITISKE: 0
TOTAL ACCEPTED: 16
TOTAL WONT-FIX: 1 (DEC-F0-012)

Ingen kritiske indsigelser der blokerer Sprint 7.
Fase 0 kan afsluttes.
```
