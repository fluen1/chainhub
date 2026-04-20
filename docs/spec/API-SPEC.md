# API-SPEC.md

# ChainHub — API-specifikation (LEGACY)

**Status:** Legacy / ikke autoritativ
**Opdateret:** 2026-04-20
**Vedligeholdes ikke som runtime-spec**

---

## Vigtigt

Denne fil er **ikke længere den autoritative beskrivelse af systemets aktuelle runtime-adfærd**.

Den er bevaret som historisk produkt- og designkontekst, men den afspejler ikke længere appen præcist nok til, at den bør bruges som beslutningsgrundlag ved implementering, review eller debugging.

Brug i stedet disse kilder som sandhedskilde:

1. `prisma/schema.prisma` — faktisk datamodel
2. `src/actions/*.ts` — faktisk forretningslogik og guards
3. `src/app/api/**/route.ts` — faktiske API-routes
4. `README.md` — aktiv onboarding og drift-kommandoer
5. `docs/status/PROGRESS.md` — aktuel leverancestatus
6. `docs/status/BLOCKERS.md` — åbne kendte problemer

---

## Kendte områder hvor denne legacy-spec afviger fra runtime

### 1. Upload-flow

Denne legacy-spec beskrev tidligere et to-trins flow, hvor klienten først uploadede filen og derefter oprettede et document-record separat.

Det er **ikke** den aktuelle runtime-adfærd.

Aktuel runtime-kilde:
- `src/app/api/upload/route.ts`

Aktuel adfærd i hovedtræk:
- route opretter selv `Document` i databasen
- route returnerer `{ data: document }`
- max filstørrelse er 10 MB
- tilladte filtyper inkluderer PDF, DOCX, PNG og JPEG
- `contractId` kan bruges til at køe extraction-job

### 2. Invitationer / onboarding / billing / Microsoft-integration

Tidligere sektioner i denne spec beskrev flows og endpoints, som enten har ændret sig væsentligt, aldrig blev realiseret som beskrevet, eller ikke længere bør læses som den operative implementering.

Derfor må denne fil **ikke** bruges som eneste kilde til at antage:
- hvilke actions der findes
- hvilke endpoints der findes
- hvilke guards der gælder
- hvilke side effects der faktisk udføres

### 3. Actions og returtyper

Denne fil beskrev tidligere mange actions som normative kontrakter. I praksis er det nu kildefilerne i `src/actions/` der gælder.

Hvis denne fil og runtime-koden er uenige, er det **altid runtime-koden** der har forrang.

---

## Brugsregel fremadrettet

Denne fil må kun bruges til:

- historisk kontekst
- produktintentioner
- idégrundlag for senere omskrivning til en ny, korrekt spec

Denne fil må **ikke** bruges alene til:

- implementering af nye features
- review af sikkerhed eller permissions
- antagelser om API-kontrakter
- testdesign uden krydstjek mod runtime-kode

---

## Næste skridt

Når der er tid til det, bør denne legacy-fil enten:

1. omskrives fra bunden til en kort, runtime-nær teknisk spec, eller
2. splittes op i mindre, vedligeholdelige modulspecs, eller
3. arkiveres permanent hvis kode + tests + schema er tilstrækkelig dokumentation

Indtil da gælder: **kode, schema og aktive statusdokumenter vinder over denne fil.**
