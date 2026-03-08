# PROJEKT-PROMPTS.md
# Prompts til input fra andre Claude-projekter
# Copy/paste disse direkte ind i henholdsvis tandlæge-projektet og Retsklar-projektet
**Version:** 0.2 — QA-rettet
**Status:** QA-RETTET

---

## PROMPT 1 — Til tandlæge-projektet (tandlaegen.dk / kædestrukturen)

```
Vi er ved at bygge et porteføljestyringssystem (arbejdstitel: ChainHub) til
kæder med delejede lokationsselskaber — præcis den struktur vi arbejder med
her. Systemet skal håndtere kontrakter, governance og kontaktstyring på tværs
af alle klinikker.

Jeg har brug for dit input til CONTRACT-TYPES.md — dokumentet der definerer
alle kontrakttyper systemet skal understøtte.

Det nuværende udkast indeholder disse 33 typer:

KATEGORI A — Ejerskab og selskabsret
KT-01  Ejeraftale
KT-02  Direktørkontrakt
KT-03  Overdragelsesaftale (anparter/aktier)
KT-04  Aktionærlåneaftale
KT-05  Pantsætningsaftale
KT-06  Vedtægter

KATEGORI B — Ansættelse og personale
KT-07  Ansættelseskontrakt — Funktionær
KT-08  Ansættelseskontrakt — Ikke-funktionær
KT-09  Vikaraftale
KT-10  Uddannelsesaftale (elev/EUD)
KT-11  Fratrædelsesaftale
KT-12  Konkurrenceklausulaftale
KT-13  Personalehåndbog

KATEGORI C — Lokaler og udstyr
KT-14  Lejekontrakt — Erhverv
KT-15  Leasingaftale

KATEGORI D — Kommercielle aftaler
KT-16  Leverandørkontrakt
KT-17  Samarbejdsaftale
KT-18  Fortrolighedsaftale (NDA)
KT-19  IT-/Systemaftale
KT-20  Databehandleraftale (DBA)

KATEGORI E — Forsikring og governance
KT-21  Forsikringsaftale
KT-22  Generalforsamlingsreferat
KT-23  Bestyrelsesreferat
KT-24  Forretningsorden for bestyrelse
KT-25  Direktionsinstruks

KATEGORI F — Kæde- og strukturspecifikke typer (Lag 2)
KT-26  Virksomhedsoverdragelsesaftale (VOA)
KT-27  Intern serviceaftale (Management Fee)
KT-28  Royalty-/Licensaftale
KT-29  Optionsaftale (andele)
KT-30  Tiltrædelsesdokument til ejeraftale
KT-31  Kassekreditaftale / Bankfacilitet
KT-32  Cash pool-aftale
KT-33  Intercompany-lån

Baseret på alt du ved om denne organisations struktur, aftaler og behov —
svar på disse spørgsmål så præcist som muligt:

1. MANGLENDE KONTRAKTTYPER
   Hvilke kontrakttyper eksisterer eller opstår typisk i denne organisation
   som IKKE er på ovenstående liste?
   Tænk på: kautionserklæringer, subordinationsaftaler, apotekssamarbejde,
   laboratorieaftaler, overenskomstaftaler med fagforeninger,
   patientfinansieringsaftaler, husorden, fuldmagter til tegningsret —
   eller andet du konkret kan se mangler.

2. GOVERNANCE-DOKUMENTER
   Ud over referater og vedtægter — hvilke dokumenter cirkulerer typisk
   i forbindelse med bestyrelsesarbejde og generalforsamlinger?
   (Fx: fuldmagter, stemmeaftaler, indkaldelser, årsberetninger som dokumenter)

3. RELATIONER MELLEM DOKUMENTER
   Er der aftaler eller dokumenter der typisk ophænger af hinanden på
   en måde vi bør modellere? (Fx: ejeraftalen styrer overdragelsesvilkårene,
   direktørkontrakten forudsætter bestyrelsesvedtagelse, etc.)

4. KRITISKE DEADLINES
   Hvilke kontrakttyper i denne organisation har deadlines der IKKE må
   overskrides — og hvad er konsekvensen hvis de gør?
   (Fx: lejekontrakt-opsigelse, forkøbsret-udøvelse, lånefornyelse)

5. HVAD FEJLER I DAG
   Hvad er de konkrete smertepunkter med kontraktstyring i den nuværende
   organisation? Hvad glemmes, hvad er svært at finde, hvad overses?

Svar så konkret og detaljeret som muligt — dit input bruges direkte
til at forbedre spec-dokumentet inden systemet bygges.
```

---

## PROMPT 2 — Til Retsklar-projektet

```
Vi er ved at bygge et B2B porteføljestyringssystem (arbejdstitel: ChainHub)
til kæder med delejede lokationsselskaber — tandlægekæder, optikerkæder,
fysioterapeuter og lignende. Det er et selvstændigt produkt, ikke Retsklar,
men de to produkter komplementerer hinanden.

Jeg har brug for dit input fra et juridisk og compliance-perspektiv til
CONTRACT-TYPES.md — dokumentet der definerer alle kontrakttyper systemet
skal understøtte.

Systemets brugere er typisk: juridisk ansvarlig i gruppen/holdingselskabet,
CFO, kædeleder. De er ikke jurister men har brug for et system der holder
styr på komplekse kontraktporteføljer på tværs af 5-20 klinikselskaber.

Det nuværende udkast har 33 kontrakttyper fordelt i to lag:

Lag 1 (universelle typer): ejeraftale, direktørkontrakt, overdragelsesaftale,
aktionærlåneaftale, pantsætningsaftale, vedtægter, ansættelseskontrakter
(funktionær/ikke-funktionær), vikaraftale, uddannelsesaftale, fratrædelsesaftale,
konkurrenceklausulaftale, personalehåndbog, lejekontrakt, leasingaftale,
leverandørkontrakt, samarbejdsaftale, NDA, IT-/systemaftale,
databehandleraftale (DBA), forsikringsaftale, generalforsamlingsreferat,
bestyrelsesreferat, forretningsorden, direktionsinstruks.

Lag 2 (kæde-/strukturspecifikke): virksomhedsoverdragelsesaftale (VOA),
intern serviceaftale (management fee), royalty-/licensaftale,
optionsaftale (andele), tiltrædelsesdokument til ejeraftale,
kassekreditaftale/bankfacilitet, cash pool-aftale, intercompany-lån.

Fra dit juridiske perspektiv på dansk erhvervsret — svar på:

1. COMPLIANCE-RISICI
   Hvilke kontrakttyper eller dokumenter er ofte mangelvare i kædestrukturer
   med co-ownership — og hvad er den typiske konsekvens af at mangle dem?
   (Fx: manglende DBA med journalsystem, manglende opdateret ejerbog,
   manglende APV-dokumentation)

2. OPBEVARINGSPLIGT
   Hvilke dokumenttyper i en kædestruktur har lovpligtig opbevaringstid
   ud over bogføringslovens 5 år?
   (Fx: ansættelseskontrakter, generalforsamlingsreferater, vedtægter)

3. JURIDISKE DISTINKTIONER DER MANGLER
   Er der kontrakttyper i udkastet der juridisk set bør splittes i
   undertyper fordi de har fundamentalt forskellig retstilling?
   (Fx: KT-02 direktørkontrakt vs. ledende medarbejder,
   KT-07/08 funktionær vs. ikke-funktionær)

4. MANGLENDE TYPER
   Hvilke kontrakttyper ser du typisk i sundhedssektoren / tandlæge-kæder
   specifikt som ikke fremgår af listen?
   (Fx: overenskomstaftaler, behandlerforsikring, patientkontrakter,
   autorisation-dokumenter, hygiejnecertifikater som dokumenter)

5. ADVARSELSFLAG
   Hvilke kontraktsituationer bør systemet automatisk flagre som risiko?
   (Fx: ansættelseskontrakt uden DBA, direktørkontrakt uden NDA,
   ejeraftale ældre end 5 år uden genforhandling)

Svar præcist og uden forbehold — dit input bruges direkte i spec-dokumentet.
```

---

## Sådan bruger du svarene

Når du har fået svar fra begge projekter:

1. Kopier svarene ind i en ny chat her
2. Jeg konsoliderer input og opdaterer CONTRACT-TYPES.md
3. DEA-agenter reviewer den opdaterede version
4. Herefter starter DEA-challenge-runde på DATABASE-SCHEMA.md
   (DEA-04 Finansiel Controller + DEA-07 Sikkerhed & Compliance)
   — BA-02 (Schema-agent) må ikke starte før denne runde er afsluttet
   uden KRITISKE indsigelser i DECISIONS.md

---

## Næste dokument efter CONTRACT-TYPES.md er godkendt

```
DATABASE-SCHEMA.md  ← Schema-agenten kan ikke starte uden dette
                       + DEA-04/DEA-07 challenge-runde gennemført
CONVENTIONS.md      ← Kan laves parallelt nu
SPRINT-PLAN.md      ← Kan laves parallelt nu
```

---

## Changelog

```
v0.2 (QA-rettet):
  [K1] KT-katalog opdateret fra forældet 17-type draft til
       godkendt 33-type katalog (CONTRACT-TYPES.md v0.4):
       — Korrekt nummering (KT-01 til KT-33)
       — Korrekte navne (fx KT-03 = Overdragelsesaftale, ikke Ansættelseskontrakt)
       — Opdelt i seks kategorier svarende til CONTRACT-TYPES.md struktur
       (Prompt 1 og Prompt 2)
  [K2] "Tænk på"-listen i Prompt 1 renset for typer der allerede
       er godkendt og nummereret i CONTRACT-TYPES.md v0.4:
       — Fjernet: leasingaftaler (KT-15), IT-systemaftaler (KT-19),
         uddannelsesaftaler (KT-10), kassekreditaftaler (KT-31)
       — Erstattet med faktisk manglende typer: kautionserklæringer,
         overenskomstaftaler, patientfinansieringsaftaler m.fl.
  [K3] DPA → DBA igennem hele dokumentet (2 forekomster i Prompt 2):
       — "Databehandleraftale (DPA)" → "Databehandleraftale (DBA)"
       — "manglende DPA med journalsystem" → "manglende DBA med journalsystem"
       — "ansættelseskontrakt uden DPA" → "ansættelseskontrakt uden DBA"
       (match med CONTRACT-TYPES.md v0.4 KT-20 system_type: DBA)
  [K4] Workflow trin 4 præciseret:
       Tidligere: "Derefter er CONTRACT-TYPES.md klar til BA-02 (Schema-agent)"
       Nu: DEA-04/DEA-07 challenge-runde på DATABASE-SCHEMA.md
       er eksplicit krav inden BA-02 frigives
       (match med AGENT-ROSTER.md aktiveringstabel og SPRINT-PLAN.md Fase 0)
  [M1] Version-header og status tilføjet (match med alle andre spec-dokumenter)
  [M2] Changelog-sektion tilføjet

v0.1:
  Første udkast
```
