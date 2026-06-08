# Launch plan 3b/4 — Onboarding-dokumentation (/docs)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg et offentligt `/docs`-dokumentationslag med 7 onboarding-sider (dansk, du-form), en docs-sidebar med aktiv-markering, og aktivér Docs-linket i public-headeren — så nye kunder kan komme i gang uden support.

**Architecture:** Ny `(public)/docs/` route-group-undermappe med eget `layout.tsx` (docs-sidebar + indholdsområde), der nester under `PublicLayout` (arver PublicHeader/Footer). Sidebar-nav-data ligger i ét delt modul (`src/lib/docs-nav.ts`), brugt af både den client-baserede `DocsSidebar` (aktiv-markering via `usePathname`) og potentielt headeren. Indholdet er statiske server components stylet med B-tokens (samme konvention som legal-siderne). Ingen skærmbilleder i v1 (tekst-først — billeder er fragile og kan tilføjes senere).

**Tech Stack:** Next.js 16 (App Router, nested layout, `usePathname`), Tailwind (B-stil tokens), Vitest, Playwright (e2e + axe).

**Spec:** `docs/superpowers/specs/2026-06-08-launch-readiness-design.md` (afsnit 6 "Onboarding-dokumentation")
**Branch:** `feat/launch-readiness` (plan 1+2+3 landet; HEAD `15e38af`)
**Forudgående:** 3/4 legal+consent (leveret). **Efterfølgende:** 4/4 deploy-forberedelse.

---

## Faktuel grounding (verificeret mod appen 2026-06-08)

Indholdet SKAL matche appens faktiske labels. Nøgletermer:

- **Sidebar-grupper:** Overblik (Forside `/dashboard`, Kalender, Søg) · Portefølje (Selskaber, Kontrakter, Sager, Opgaver) · Ressourcer (Dokumenter, Personer, Indstillinger).
- **Selskaber:** "+ Opret selskab"; felter: Selskabsnavn, CVR (8 cifre, CVR-autofill ved blur), Selskabsform (ApS/A/S/I/S/Holding ApS/Andet), adresse. Sundhedsstatus: Kritisk/Opmærksomhed/OK. Visninger: Flat/Grupperet/Kanban. Detalje-paneler: Ejerskab, Personer, AI Insight (Plus), Kontrakter, Sager, Finans, Besøg, Dokumenter, Noter.
- **Ejerskab:** "+ Tilføj ejer"; typer Person/Holdingselskab/Andet selskab; ejerandel %; ejeraftale-status Aktiv/Udløbet.
- **Kontrakter:** "+ Opret kontrakt"; Tilknyttet selskab, Kontrakttype (mange, fx Ejeraftale/Lejekontrakt/Ansættelseskontrakt/NDA/DBA), Sensitivitetsniveau (Offentlig→Strengt fortrolig), navn, datoer, opsigelsesvarsel, advisering (90/30/7 dage før udløb). Statusser: Kladde/Til review/Til underskrift/Aktiv/Udløbet/Opsagt/Fornyet/Arkiveret.
- **AI-udlæsning:** upload dokument → AI analyserer → review-side (`/documents/review/[id]`) med paneler "AI-analyse" (dokumenttype + confidence), "Relationer", "Udtrukne felter". **AI-output kræver altid menneskelig godkendelse.** AI-features: Dokument-ekstraktion, Selskabs-insights, Portefølje-insights, Søg & Spørg, Kalender-events. AI-assistent = sparkles-ikon i sidebar.
- **Sager:** "+ Opret sag"; typer Transaktion/Tvist/Compliance/Kontrakt/Governance/Andet; statusser Ny/Aktiv/Afventer ekstern/Afventer klient/Lukket/Arkiveret; mindst ét tilknyttet selskab.
- **Opgaver:** "Ny opgave"; prioriteter Lav/Mellem/Høj/Kritisk; kanban-kolonner Åben/I gang/Afventer/Fuldført; filtre inkl. "Mine opgaver"; forfaldne vises rødt.
- **Roller (eksakte UI-labels):** Kæde-niveau: Kædeejer, Kædeadministrator, Juridisk ansvarlig, Økonomisk ansvarlig, Revisor / Læseadgang. Selskabs-niveau (kræver tilknytning til specifikke selskaber): Klinikchef, Klinikjurist, Klinik-læseadgang. Opret via "Opret bruger" i Indstillinger → Brugere og adgang; "Ventende invitationer"-panel.
- **Eksport:** CSV fra listesider via "ExportButton" → preview-modal (op til 20 rækker) → "Download CSV" (UTF-8 BOM, Excel-venlig).
- **GDPR:** på person-detalje (`/persons/[id]`), kun for admins (Kædeejer/Kædeadministrator): "Eksportér persondata (GDPR)" (JSON) + "Slet persondata permanent" (skriv navn for at bekræfte; art. 17; audit-log bevares).
- **Login:** e-mail+adgangskode eller "Log ind med Google"; "Glemt adgangskode?" (link udløber 1 time). Signup: trial **14 dage**; adgangskode min. 8 tegn.
- **Planer:** Prøveperiode (14 dage gratis) · Basis 3.500 kr/md · Plus 9.500 kr/md (50 AI-udlæsninger inkl., 75 kr/ekstra) · Enterprise fra 32.000 kr/md. Trial-banner sidste 7 dage.
- **Kontakt:** brug `kontakt@chainhub.dk` i docs (konsistent med legal-siderne).

**Tone:** Dansk, du-form, konkret og venlig. Korte scanbare afsnit. Eksempler bruger neutral kæde-kontekst (fx en optiker- eller fysio-kæde) — **aldrig dental/tandlæge** (bindende). Brug de eksakte UI-labels i citationstegn så brugeren kan genkende dem.

---

### Task 1: Docs-infrastruktur + forside ("Kom godt i gang")

**Files:**

- Create: `src/lib/docs-nav.ts`
- Create: `src/components/public/DocsSidebar.tsx`
- Create: `src/app/(public)/docs/layout.tsx`
- Create: `src/app/(public)/docs/page.tsx`
- Modify: `src/proxy.ts` (`PUBLIC_PATHS`)
- Modify: `src/components/public/PublicHeader.tsx` (Docs-link)

- [ ] **Step 1: Skriv `src/lib/docs-nav.ts`**

```ts
export type DocNavItem = { href: string; label: string }

export const DOCS_NAV: DocNavItem[] = [
  { href: '/docs', label: 'Kom godt i gang' },
  { href: '/docs/selskaber', label: 'Selskaber & ejerskab' },
  { href: '/docs/kontrakter', label: 'Kontrakter & AI-udlæsning' },
  { href: '/docs/sager-opgaver', label: 'Sager & opgaver' },
  { href: '/docs/brugere-roller', label: 'Brugere & roller' },
  { href: '/docs/eksport-gdpr', label: 'Eksport & GDPR' },
  { href: '/docs/faq', label: 'Ofte stillede spørgsmål' },
]
```

- [ ] **Step 2: Skriv `src/components/public/DocsSidebar.tsx`** (client — aktiv-markering)

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { DOCS_NAV } from '@/lib/docs-nav'

export function DocsSidebar() {
  const pathname = usePathname()
  return (
    <nav aria-label="Dokumentation" className="text-[13px]">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-b-3">
        Dokumentation
      </p>
      <ul className="flex flex-col gap-0.5">
        {DOCS_NAV.map((item) => {
          const active = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-[4px] px-2.5 py-1.5 no-underline',
                  active
                    ? 'bg-b-panel-h font-medium text-b-1'
                    : 'text-b-2 hover:bg-b-panel-h hover:text-b-1'
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 3: Skriv `src/app/(public)/docs/layout.tsx`**

```tsx
import { DocsSidebar } from '@/components/public/DocsSidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:flex-row">
      <aside className="shrink-0 md:w-56">
        <DocsSidebar />
      </aside>
      <article className="min-w-0 flex-1 space-y-6 text-[13px] leading-relaxed text-b-1">
        {children}
      </article>
    </div>
  )
}
```

- [ ] **Step 4: Skriv `src/app/(public)/docs/page.tsx`** (forside "Kom godt i gang")

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Kom godt i gang — Dokumentation',
  description: 'Sådan kommer du i gang med ChainHub.',
}

export default function DocsIndexPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Kom godt i gang</h1>
      <p className="text-b-2">
        ChainHub samler hele kædens selskaber, ejerskab, kontrakter, sager og opgaver ét sted —
        bygget til optiker-, fysio-, læge- og franchisekæder med delejede lokationsselskaber. Denne
        guide hjælper dig godt fra start.
      </p>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">1. Log ind</h2>
        <p className="text-b-2">
          Log ind med din e-mail og adgangskode, eller vælg &quot;Log ind med Google&quot;. Har du
          glemt din adgangskode, bruger du &quot;Glemt adgangskode?&quot; — nulstillingslinket
          udløber efter 1 time. Nye konti starter på en gratis prøveperiode på 14 dage med adgang
          til alle funktioner.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">2. Din forside</h2>
        <p className="text-b-2">
          Når du er logget ind, lander du på &quot;Forside&quot; — dit overblik over porteføljen.
          Øverst ser du nøgletal (selskaber, kontrakter der udløber inden for 30 dage, åbne sager,
          forfaldne opgaver m.m.), og nedenfor widgets med kommende deadlines, selskabernes
          sundhedstilstand og den seneste aktivitet.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">3. Find rundt</h2>
        <p className="text-b-2">Menuen til venstre er delt i tre grupper:</p>
        <ul className="ml-4 list-disc space-y-1 text-b-2">
          <li>
            <strong className="text-b-1">Overblik</strong> — Forside, Kalender og Søg.
          </li>
          <li>
            <strong className="text-b-1">Portefølje</strong> — Selskaber, Kontrakter, Sager og
            Opgaver.
          </li>
          <li>
            <strong className="text-b-1">Ressourcer</strong> — Dokumenter, Personer og
            Indstillinger.
          </li>
        </ul>
        <p className="text-b-2">
          Tryk <kbd className="rounded border border-b-border bg-b-panel-h px-1">Cmd/Ctrl + K</kbd>{' '}
          hvor som helst for at søge på tværs af alt. Sparkles-ikonet øverst åbner AI-assistenten,
          der kan finde data eller hjælpe dig med at oprette nye emner.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">4. Næste skridt</h2>
        <ul className="ml-4 list-disc space-y-1 text-b-2">
          <li>
            <Link href="/docs/selskaber" className="text-b-blue-fg underline hover:no-underline">
              Opret dit første selskab og kortlæg ejerskab
            </Link>
          </li>
          <li>
            <Link href="/docs/kontrakter" className="text-b-blue-fg underline hover:no-underline">
              Tilføj kontrakter og prøv AI-udlæsning
            </Link>
          </li>
          <li>
            <Link
              href="/docs/brugere-roller"
              className="text-b-blue-fg underline hover:no-underline"
            >
              Inviter dit team og tildel roller
            </Link>
          </li>
        </ul>
      </section>
    </>
  )
}
```

- [ ] **Step 5: Gør `/docs` offentlig** — tilføj `'/docs'` til `PUBLIC_PATHS` i `src/proxy.ts` (efter `'/legal'`):

```ts
  '/legal',
  '/docs',
```

- [ ] **Step 6: Aktivér Docs-linket i `PublicHeader.tsx`** — erstat placeholder-kommentaren `{/* Docs-link tilføjes i plan 3 når /docs findes */}` med:

```tsx
<Link href="/docs" className="text-b-2 no-underline hover:text-b-1">
  Docs
</Link>
```

- [ ] **Step 7: Verificér build + e2e**

Run: `npx next build`
Expected: GRØN; `/docs` i route-tabellen.

- [ ] **Step 8: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/lib/docs-nav.ts src/components/public/DocsSidebar.tsx "src/app/(public)/docs" src/proxy.ts src/components/public/PublicHeader.tsx
git -C C:\Users\birke\Projects\chainhub commit -m "feat(docs): docs-lag med sidebar + forside, Docs-link i nav"
```

---

### Task 2: Sider — Selskaber & ejerskab + Kontrakter & AI-udlæsning

**Files:**

- Create: `src/app/(public)/docs/selskaber/page.tsx`
- Create: `src/app/(public)/docs/kontrakter/page.tsx`

- [ ] **Step 1: Skriv `src/app/(public)/docs/selskaber/page.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Selskaber & ejerskab — Dokumentation',
  description: 'Opret selskaber, kortlæg ejerskab og følg koncernens sundhed.',
}

export default function DocsSelskaberPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Selskaber & ejerskab</h1>
      <p className="text-b-2">
        Selskaber er kernen i ChainHub. Her samler du hele koncernen — fra holdingselskab til den
        enkelte lokation — med ejerskab, økonomi, kontrakter og sager knyttet til hvert selskab.
      </p>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Opret et selskab</h2>
        <p className="text-b-2">
          Gå til &quot;Selskaber&quot; og klik &quot;+ Opret selskab&quot;. Udfyld selskabsnavn og
          eventuelt CVR-nummer — når du indtaster et gyldigt CVR, foreslår ChainHub automatisk navn
          og adresse fra CVR-registeret. Vælg selskabsform (ApS, A/S, I/S, Holding ApS eller andet)
          og udfyld adresse efter behov.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Selskabets detaljeside</h2>
        <p className="text-b-2">
          Klik på et selskab for at se alt samlet i paneler: &quot;Ejerskab&quot;,
          &quot;Personer&quot;, &quot;Kontrakter&quot;, &quot;Sager&quot;, &quot;Finans&quot;,
          &quot;Besøg&quot;, &quot;Dokumenter&quot; og &quot;Noter&quot;. Øverst ser du nøgletal som
          kædeandel, antal kontrakter, åbne sager og EBITDA. Med &quot;Rediger stamdata&quot;
          opdaterer du selskabets grunddata.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Kortlæg ejerskab</h2>
        <p className="text-b-2">
          I panelet &quot;Ejerskab&quot; klikker du &quot;+ Tilføj ejer&quot;. En ejer kan være en
          person, et holdingselskab eller et andet selskab. Angiv ejerandel i procent og dato for
          erhvervelse. ChainHub viser ejeraftalens status (Aktiv eller Udløbet), så du hurtigt kan
          se, hvor der mangler at blive fulgt op.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Sundhed og visninger</h2>
        <p className="text-b-2">
          Hvert selskab får automatisk en sundhedsstatus — &quot;Kritisk&quot;,
          &quot;Opmærksomhed&quot; eller &quot;OK&quot; — baseret på blandt andet forfaldne opgaver
          og udløbende kontrakter. På listen kan du skifte mellem &quot;Flat&quot;,
          &quot;Grupperet&quot; og &quot;Kanban&quot;-visning, så du får overblikket, der passer til
          opgaven.
        </p>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Skriv `src/app/(public)/docs/kontrakter/page.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kontrakter & AI-udlæsning — Dokumentation',
  description: 'Opret kontrakter, få advarsler før udløb, og lad AI udlæse nøgledata.',
}

export default function DocsKontrakterPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Kontrakter & AI-udlæsning</h1>
      <p className="text-b-2">
        Hold styr på lejekontrakter, ejeraftaler, leverandøraftaler og alt det øvrige — med
        automatiske påmindelser før udløb og mulighed for at lade AI udlæse nøgledata fra dine
        dokumenter.
      </p>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Opret en kontrakt</h2>
        <p className="text-b-2">
          Klik &quot;+ Opret kontrakt&quot; og vælg det tilknyttede selskab og kontrakttype (fx
          &quot;Ejeraftale&quot;, &quot;Lejekontrakt (erhverv)&quot;,
          &quot;Ansættelseskontrakt&quot; eller &quot;Databehandleraftale (DBA)&quot;). Giv
          kontrakten et genkendeligt navn, og udfyld start- og udløbsdato samt opsigelsesvarsel. Lad
          udløbsdatoen stå blank for løbende aftaler.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Følsomhed og advarsler</h2>
        <p className="text-b-2">
          Hver kontrakt får et sensitivitetsniveau (fra &quot;Offentlig&quot; til &quot;Strengt
          fortrolig&quot;) — visse kontrakttyper kræver automatisk et minimumsniveau. Under
          &quot;Advisering&quot; vælger du, hvornår du vil mindes om udløb: 90, 30 og/eller 7 dage
          før. Kontrakter bevæger sig gennem statusserne &quot;Kladde&quot;, &quot;Til review&quot;,
          &quot;Til underskrift&quot;, &quot;Aktiv&quot;, &quot;Udløbet&quot;, &quot;Opsagt&quot;,
          &quot;Fornyet&quot; og &quot;Arkiveret&quot;.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">AI-udlæsning af dokumenter</h2>
        <p className="text-b-2">
          På Plus- og Enterprise-planerne kan ChainHub udlæse nøgledata fra dine dokumenter. Upload
          et dokument under &quot;Dokumenter&quot;, hvorefter AI automatisk analyserer det og fører
          dig til en review-side. Her ser du den detekterede dokumenttype, fundne relationer
          (selskaber og personer) og alle udtrukne felter.
        </p>
        <p className="rounded-[4px] border border-b-amber-fg/30 bg-b-amber-fg/5 px-3 py-2 text-b-1">
          AI-output er altid et forslag, der kræver din godkendelse. Gennemgå de udtrukne felter,
          før du godkender — du har altid det sidste ord.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Versioner og AI-assistent</h2>
        <p className="text-b-2">
          Når en kontrakt opdateres, kan du gemme en ny version (fx redaktionel, materiel eller
          allonge), så historikken bevares. Med AI-assistenten (sparkles-ikonet i menuen) kan du
          stille spørgsmål på tværs af din portefølje, fx &quot;hvilke lejekontrakter udløber i
          Q4?&quot;.
        </p>
      </section>
    </>
  )
}
```

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: GRØN; `/docs/selskaber` + `/docs/kontrakter` i tabellen.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add "src/app/(public)/docs/selskaber" "src/app/(public)/docs/kontrakter"
git -C C:\Users\birke\Projects\chainhub commit -m "docs(content): selskaber og kontrakter-sider"
```

---

### Task 3: Sider — Sager & opgaver + Brugere & roller

**Files:**

- Create: `src/app/(public)/docs/sager-opgaver/page.tsx`
- Create: `src/app/(public)/docs/brugere-roller/page.tsx`

- [ ] **Step 1: Skriv `src/app/(public)/docs/sager-opgaver/page.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sager & opgaver — Dokumentation',
  description: 'Styr juridiske og forretningsmæssige processer med sager og opgaver.',
}

export default function DocsSagerOpgaverPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Sager & opgaver</h1>
      <p className="text-b-2">
        Sager samler større processer — opgaver er de konkrete handlinger, der driver dem fremad.
      </p>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Sager</h2>
        <p className="text-b-2">
          En sag samler en juridisk eller forretningsmæssig proces, der involverer ét eller flere
          selskaber. Klik &quot;+ Opret sag&quot;, giv den en titel, og vælg sagstype:
          &quot;Transaktion&quot;, &quot;Tvist&quot;, &quot;Compliance&quot;, &quot;Kontrakt&quot;,
          &quot;Governance&quot; eller &quot;Andet&quot; (hver med relevante undertyper). Knyt
          mindst ét selskab til sagen. Sager bevæger sig gennem statusserne &quot;Ny&quot;,
          &quot;Aktiv&quot;, &quot;Afventer ekstern&quot;, &quot;Afventer klient&quot;,
          &quot;Lukket&quot; og &quot;Arkiveret&quot;.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Opgaver</h2>
        <p className="text-b-2">
          En opgave er en konkret handling — eventuelt knyttet til en sag og/eller et selskab. Klik
          &quot;Ny opgave&quot;, sæt en deadline og en prioritet (&quot;Lav&quot;,
          &quot;Mellem&quot;, &quot;Høj&quot; eller &quot;Kritisk&quot;), og tildel en ansvarlig.
          Opgaver kan vises som liste eller i en kanban-tavle med kolonnerne &quot;Åben&quot;,
          &quot;I gang&quot;, &quot;Afventer&quot; og &quot;Fuldført&quot; — træk kort mellem
          kolonner for at opdatere status.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Hold fokus</h2>
        <p className="text-b-2">
          Brug filtrene øverst på opgavelisten — blandt andet &quot;Mine opgaver&quot;, selskab,
          type, prioritet og status — til at finde det rigtige hurtigt. Forfaldne opgaver fremhæves
          med rødt, både på listen og i menuen, så intet falder mellem to stole.
        </p>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Skriv `src/app/(public)/docs/brugere-roller/page.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brugere & roller — Dokumentation',
  description: 'Inviter dit team og styr adgang med rollebaserede tilladelser.',
}

export default function DocsBrugereRollerPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Brugere & roller</h1>
      <p className="text-b-2">
        ChainHub bruger rollebaseret adgang, så hver bruger kun ser og kan ændre det, der er
        relevant for vedkommende.
      </p>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Inviter en bruger</h2>
        <p className="text-b-2">
          Gå til &quot;Indstillinger&quot; → &quot;Brugere og adgang&quot; og klik &quot;Opret
          bruger&quot;. Angiv navn, e-mail og rolle. Ventende invitationer vises i et eget panel, og
          du kan til enhver tid redigere en brugers rolle eller deaktivere adgangen igen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Roller på kæde-niveau</h2>
        <ul className="ml-4 list-disc space-y-1 text-b-2">
          <li>
            <strong className="text-b-1">Kædeejer</strong> — fuld adgang til alle moduler og
            indstillinger.
          </li>
          <li>
            <strong className="text-b-1">Kædeadministrator</strong> — administrerer brugere og alle
            moduler.
          </li>
          <li>
            <strong className="text-b-1">Juridisk ansvarlig</strong> — kontrakter, sager og
            dokumenter.
          </li>
          <li>
            <strong className="text-b-1">Økonomisk ansvarlig</strong> — finansdata og eksport.
          </li>
          <li>
            <strong className="text-b-1">Revisor / Læseadgang</strong> — læseadgang til alle
            moduler.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Roller på selskabs-niveau</h2>
        <p className="text-b-2">
          Selskabsroller giver adgang til ét eller flere bestemte selskaber frem for hele kæden — du
          vælger de tilknyttede selskaber, når du tildeler rollen:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-b-2">
          <li>
            <strong className="text-b-1">Klinikchef</strong> — fuld adgang til det tildelte selskab.
          </li>
          <li>
            <strong className="text-b-1">Klinikjurist</strong> — kontrakter og sager for det
            tildelte selskab.
          </li>
          <li>
            <strong className="text-b-1">Klinik-læseadgang</strong> — læseadgang til det tildelte
            selskab.
          </li>
        </ul>
      </section>
    </>
  )
}
```

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: GRØN.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add "src/app/(public)/docs/sager-opgaver" "src/app/(public)/docs/brugere-roller"
git -C C:\Users\birke\Projects\chainhub commit -m "docs(content): sager-opgaver og brugere-roller-sider"
```

---

### Task 4: Sider — Eksport & GDPR + FAQ

**Files:**

- Create: `src/app/(public)/docs/eksport-gdpr/page.tsx`
- Create: `src/app/(public)/docs/faq/page.tsx`

- [ ] **Step 1: Skriv `src/app/(public)/docs/eksport-gdpr/page.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Eksport & GDPR — Dokumentation',
  description: 'Eksportér dine data og håndtér persondata efter GDPR.',
}

export default function DocsEksportGdprPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Eksport & GDPR</h1>
      <p className="text-b-2">
        Dine data er dine. ChainHub gør det nemt at trække data ud og at opfylde dine forpligtelser
        efter databeskyttelsesforordningen (GDPR).
      </p>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Eksportér til CSV</h2>
        <p className="text-b-2">
          På listesiderne (fx Selskaber, Kontrakter og Sager) kan du eksportere data til CSV. Klik
          eksport-knappen, se et preview af de første rækker, og vælg &quot;Download CSV&quot;.
          Filerne gemmes i UTF-8, så danske tegn som æ, ø og å vises korrekt, når du åbner dem i
          Excel.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Håndtér persondata (GDPR)</h2>
        <p className="text-b-2">
          På en persons detaljeside finder administratorer (Kædeejer og Kædeadministrator) et
          GDPR-panel med to handlinger:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-b-2">
          <li>
            <strong className="text-b-1">Eksportér persondata (GDPR)</strong> — downloader alle
            registrerede oplysninger om personen som en JSON-fil, klar til en indsigtsanmodning.
          </li>
          <li>
            <strong className="text-b-1">Slet persondata permanent</strong> — pseudonymiserer
            personens data og afregistrerer alle relationer (GDPR art. 17). For at undgå utilsigtet
            sletning skal du skrive personens fulde navn for at bekræfte. Audit-loggen bevares af
            juridiske hensyn.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Ved opsigelse</h2>
        <p className="text-b-2">
          Opsiger du dit abonnement, kan du eksportere dine data, inden de slettes. Læs mere om
          opbevaring og sletning i vores{' '}
          <a href="/legal/privatliv" className="text-b-blue-fg underline hover:no-underline">
            privatlivspolitik
          </a>
          .
        </p>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Skriv `src/app/(public)/docs/faq/page.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ofte stillede spørgsmål — Dokumentation',
  description: 'Svar på de mest almindelige spørgsmål om ChainHub.',
}

const FAQ = [
  {
    q: 'Hvordan starter jeg?',
    a: 'Opret en konto og navngiv din kæde. Du får en gratis prøveperiode på 14 dage med adgang til alle funktioner — ingen betalingskort kræves for at komme i gang.',
  },
  {
    q: 'Hvad sker der, når prøveperioden udløber?',
    a: 'De sidste 7 dage af prøveperioden viser vi en påmindelse med et link til at vælge en plan. Vælger du ikke en plan, sættes kontoen på pause — dine data slettes ikke automatisk.',
  },
  {
    q: 'Hvilke planer findes der?',
    a: 'Basis (3.500 kr./md) er kerne-CRM uden AI. Plus (9.500 kr./md) tilføjer AI-udlæsning og -indsigter med 50 udlæsninger inkluderet pr. måned. Enterprise (fra 32.000 kr./md) tilføjer portefølje-AI, RAG-søgning og SLA. Du skifter plan under Indstillinger → Abonnement.',
  },
  {
    q: 'Hvordan nulstiller jeg min adgangskode?',
    a: 'Vælg "Glemt adgangskode?" på login-siden og følg linket i mailen. Linket udløber efter 1 time af sikkerhedshensyn.',
  },
  {
    q: 'Bruger I AI på mine kontrakter?',
    a: 'Kun hvis du er på en plan med AI og selv uploader et dokument til udlæsning. AI-output er altid et forslag, der kræver din godkendelse — intet ændres automatisk.',
  },
  {
    q: 'Hvor opbevares mine data?',
    a: 'Din database hostes i EU. Enkelte underdatabehandlere (fx e-mail og betaling) er i USA på grundlag af EU-Kommissionens standardkontraktbestemmelser. Se den fulde liste i privatlivspolitikken.',
  },
  {
    q: 'Hvordan får jeg hjælp?',
    a: 'Skriv til os på kontakt@chainhub.dk, så vender vi tilbage hurtigst muligt.',
  },
]

export default function DocsFaqPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Ofte stillede spørgsmål</h1>
      <div className="space-y-5">
        {FAQ.map((item) => (
          <section key={item.q} className="space-y-1">
            <h2 className="text-[15px] font-semibold text-b-1">{item.q}</h2>
            <p className="text-b-2">{item.a}</p>
          </section>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: GRØN; alle 7 docs-ruter i tabellen.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add "src/app/(public)/docs/eksport-gdpr" "src/app/(public)/docs/faq"
git -C C:\Users\birke\Projects\chainhub commit -m "docs(content): eksport-gdpr og faq-sider"
```

---

### Task 5: Tests — axe + e2e for docs

**Files:**

- Modify: `tests/e2e/a11y.spec.ts`
- Modify: `tests/e2e/public.spec.ts`

- [ ] **Step 1: Tilføj docs-ruter til axe-sweepet** — udvid `PUBLIC_PAGES` i `tests/e2e/a11y.spec.ts` med de 7 docs-ruter:

```ts
  { path: '/docs', label: 'Docs forside' },
  { path: '/docs/selskaber', label: 'Docs selskaber' },
  { path: '/docs/kontrakter', label: 'Docs kontrakter' },
  { path: '/docs/sager-opgaver', label: 'Docs sager-opgaver' },
  { path: '/docs/brugere-roller', label: 'Docs brugere-roller' },
  { path: '/docs/eksport-gdpr', label: 'Docs eksport-gdpr' },
  { path: '/docs/faq', label: 'Docs faq' },
```

- [ ] **Step 2: Tilføj e2e-smoke** i `tests/e2e/public.spec.ts` (inden for den seedede describe-blok, så consent-banneret ikke forstyrrer):

```ts
test('docs-forside loader og sidebar-navigation virker', async ({ page }) => {
  await page.goto('/docs')
  await expect(page.getByRole('heading', { name: 'Kom godt i gang', level: 1 })).toBeVisible()
  // Naviger via docs-sidebar til en sektion
  await page
    .getByRole('navigation', { name: 'Dokumentation' })
    .getByRole('link', { name: 'Selskaber & ejerskab' })
    .click()
  await expect(page).toHaveURL(/\/docs\/selskaber$/)
  await expect(page.getByRole('heading', { name: 'Selskaber & ejerskab', level: 1 })).toBeVisible()
})

test('Docs-link i header fører til /docs', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Docs' }).first().click()
  await expect(page).toHaveURL(/\/docs$/)
})
```

- [ ] **Step 3: Kør de berørte suiter**

Run: `npx playwright test tests/e2e/public.spec.ts tests/e2e/a11y.spec.ts`
Expected: Alle grønne. Fejler axe på en docs-side → fix kontrast/struktur TDD-style. Bemærk: `<kbd>` på forsiden skal have tilstrækkelig kontrast (b-tokens sikrer det).

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add tests/e2e/a11y.spec.ts tests/e2e/public.spec.ts
git -C C:\Users\birke\Projects\chainhub commit -m "test(docs): axe-sweep + e2e for docs-sider og navigation"
```

---

### Task 6: Fuld kvalitetsgate

⛔ **Forbud:** ingen `git stash`/`reset`/`checkout -f`/`restore`.

- [ ] **Step 1: Format** — `npx prettier --check` på de nye/ændrede filer (docs-sider, docs-nav.ts, DocsSidebar.tsx, docs/layout.tsx, PublicHeader.tsx, proxy.ts, test-filer). `--write` + commit `style(docs): prettier` hvis nødvendigt.

- [ ] **Step 2: Lint** — `npx eslint src --ext ts,tsx`. Antal IKKE over baseline (4 præeksisterende, ingen i docs-filer). Fix kun nye.

- [ ] **Step 3: TypeScript** — `npx tsc --noEmit` → 0 fejl.

- [ ] **Step 4: Unit (fuld)** — `npm test` → faktiske tal; 0 failed.

- [ ] **Step 5: Build** — `npx next build` → grøn; alle 7 docs-ruter til stede.

- [ ] **Step 6: E2e (fuld)** — `npx playwright test` → faktiske tal, alle grønne.

- [ ] **Step 7: Fejler noget → fix** minimalt + commit `fix(docs): …`. Præeksisterende/urelaterede NOTERES, fixes ikke. **Fail loud** — faktiske tal, masker intet.

---

### Task 7: Status + handoff

**Files:**

- Modify: `docs/status/PROGRESS.md`

- [ ] **Step 1: Opdatér `docs/status/PROGRESS.md`** — match plan 1-3-stilen. Ny sektion "Launch-readiness plan 3b (2026-06-08)": `/docs`-lag med 7 onboarding-sider (dansk du-form, app-grounded), docs-sidebar m. aktiv-markering, Docs-link aktiveret i nav, `/docs` i PUBLIC_PATHS; gate-tal. Note: ingen skærmbilleder i v1 (tekst-først). Note: roller dokumenteret med de faktiske UI-labels, inkl. "Klinik…"-selskabsroller — se handoff-flag.

- [ ] **Step 2: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add docs/status/PROGRESS.md
git -C C:\Users\birke\Projects\chainhub commit -m "docs: PROGRESS opdateret efter launch-readiness plan 3b"
```

- [ ] **Step 3: Handoff** — meld tilbage til Philip: plan 3b leveret, commit-range. **Flag:** (1) appens selskabsniveau-roller hedder "Klinikchef/Klinikjurist/Klinik-læseadgang" i UI'et — dental/medicinsk-lænende terminologi der spænder med den ikke-dentale ICP (optiker/fysio/læge/franchise); overvej at omdøbe til neutrale labels (fx "Lokationschef") på app-niveau — uden for denne plans scope. (2) Ingen skærmbilleder i docs v1. **Ingen PR** (CopenAI: afventer plan 4 + Rico). Tilbyd plan 4 (deploy-forberedelse).

---

## Self-review mod spec

- **~7 onboarding-sider under /docs (spec afsnit 6):** Kom godt i gang, Selskaber & ejerskab, Kontrakter & AI-udlæsning, Sager & opgaver, Brugere & roller, Eksport & GDPR, FAQ — alle 7 ✓
- **Dansk, du-form:** alt indhold ✓
- **Docs-nav (Docs i public header):** aktiveret (Task 1) ✓
- **Skærmbilleder fra saneret seed-data (spec):** bevidst udeladt i v1 (tekst-først; fragile) — dokumenteret i handoff. Afvigelse fra spec, noteret. ⚠️
- **App-grounded korrekthed:** alle labels/flows verificeret mod appen (feature-map øverst); roller bruger eksakte UI-labels ✓
- **Dental-eksklusion:** eksempler bruger optiker/fysio-kontekst, aldrig dental. ICP-linje på forsiden = optiker/fysio/læge/franchise. "Klinik"-rollelabels er appens egne UI-labels (ikke vores opfindelse) — flagget til app-niveau-beslutning. ✓
- **a11y + e2e:** docs-ruter i axe-sweep + e2e for forside/navigation/header-link (Task 5) ✓
- **No-placeholder:** alle 7 sider + infra-kode komplet ✓
- **Type-konsistens:** `DocNavItem`/`DOCS_NAV` delt mellem `docs-nav.ts` og `DocsSidebar` ✓
- **Uden for scope (→ plan 4):** deploy-forberedelse (R2, env, bootstrap, DNS, BetterStack). ✓
