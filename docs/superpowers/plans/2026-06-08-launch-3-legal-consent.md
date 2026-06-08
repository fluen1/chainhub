# Launch plan 3/4 — Legal-konsolidering + cookie-consent

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saml alle juridiske dokumenter under `/legal/*` med public header/footer (flyt eksisterende vilkår+privatliv, tilføj cookiepolitik + databehandleraftale), ret faktuelle fejl i databehandlerlisten, og indfør et opt-in cookie-consent-flow der gater PostHog-analytics — så launch er GDPR-konsistent.

**Architecture:** De to eksisterende legal-sider (`/terms`, `/privacy`, fuldt skrevne under `(auth)`) flyttes til `(public)/legal/vilkaar` og `(public)/legal/privatliv`, hvor de arver `PublicLayout`s header/footer. `LegalPageLayout` afklædes sin egen standalone-chrome (logo-header + "tilbage til log ind"-footer) så den kun er et titlet indholdspanel. To nye sider tilføjes: cookiepolitik og databehandleraftale (art. 28). Gamle `/terms`+`/privacy` bliver redirect-stubs. PostHog initialiseres med `opt_out_capturing_by_default` og aktiveres kun efter eksplicit samtykke via et `CookieConsent`-banner; valget gemmes i localStorage.

**Tech Stack:** Next.js 16 (App Router, `redirect()`, `proxy.ts`), posthog-js (opt-in/opt-out API), Tailwind (B-stil tokens), Vitest, Playwright (e2e + axe).

**Spec:** `docs/superpowers/specs/2026-06-08-launch-readiness-design.md` (afsnit 5 "Legal-dokumenter")
**Beslutninger truffet 2026-06-08 (af Philip):** (1) Konsolidér legal under `/legal/*` med redirects fra gamle ruter. (2) Behold PostHog men dokumentér + indfør opt-in consent (afviger bevidst fra spec'ens "ingen tracking i v1").
**Branch:** `feat/launch-readiness` (plan 1+2 landet; HEAD `5aecd2b`)
**Efterfølgende:** 3b onboarding-docs (`/docs`, 7 sider + Docs-nav-link) · 4/4 deploy-forberedelse

---

## Genbrugte byggeklodser (verificeret 2026-06-08)

| Hvad                        | Hvor                                           | Note                                                                                                                 |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `LegalPageLayout` + helpers | `@/components/ui/b/LegalPageLayout`            | `LegalListItem`, `LegalContactBox`, `LegalMailLink`, `LegalExternalLink` — uændrede; layoutet selv afklædes (Task 1) |
| `PublicLayout`              | `src/app/(public)/layout.tsx`                  | leverer `PublicHeader`+`PublicFooter` til alt under `(public)/`                                                      |
| `PublicFooter`              | `src/components/public/PublicFooter.tsx`       | har placeholder-kommentar linje 18 til legal-links                                                                   |
| `PosthogProvider`           | `src/components/providers/PosthogProvider.tsx` | initialiserer posthog i `useEffect`; wraps alt i root-layout                                                         |
| `PUBLIC_PATHS`              | `src/proxy.ts` (linje 38)                      | path-baseret; route-group er ligegyldig for middleware                                                               |
| Resend/AI-fakta             | —                                              | AI-udbyder er **OpenAI** (GPT-5-modeller via `src/lib/ai/client`), IKKE Anthropic                                    |

**Faktiske underdatabehandlere (til databehandlerliste):** Supabase (DB, EU), Vercel (hosting, EU/USA), Resend (e-mail, USA/SCCs), OpenAI (AI-udlæsning, USA/SCCs), Sentry (fejlsporing, EU), Cloudflare R2 (fillagring, EU), Stripe (betaling, USA/SCCs), Upstash (rate-limiting/Redis, EU/USA), PostHog (analytics ved samtykke, EU), Google (OAuth-login valgfrit, USA/SCCs).

**Konventioner:** B-tokens (`text-b-1/2/3`, `bg-b-panel`, `border-b-border`). Server components default; `'use client'` kun hvor interaktivitet kræves. Sidetitler via `metadata` (root-template `%s — ChainHub`).

---

### Task 1: Afklæd `LegalPageLayout` for standalone-chrome

Når legal-sider flyttes under `(public)/` får de PublicHeader/Footer. `LegalPageLayout`s egen logo-header + "tilbage til log ind"-footer ville være dobbelt-chrome. Afklæd den til et rent indholdspanel. (Eneste nuværende forbrugere er `/terms` + `/privacy`, som flyttes i Task 2-3.)

**Files:**

- Modify: `src/components/ui/b/LegalPageLayout.tsx`

- [ ] **Step 1: Erstat `LegalPageLayout`-funktionen** (linje 1-50) med denne chrome-løse version. Fjern `BrandMark`-importen (linje 4) — den bruges ikke længere. Behold ALLE helper-eksporter (`LegalListItem`, `LegalContactBox`, `LegalMailLink`, `LegalExternalLink`) uændret.

```tsx
// LegalPageLayout — titlet indholdspanel til statiske juridiske sider.
// Lever under (public)/ og arver PublicHeader/PublicFooter — har derfor ingen egen chrome.

interface LegalPageLayoutProps {
  title: string
  subtitle: string
  lastUpdated: string
  children: React.ReactNode
}

export function LegalPageLayout({ title, subtitle, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-12">
      <div className="mb-3 flex justify-end">
        <span className="text-[11px] text-b-3">Senest opdateret: {lastUpdated}</span>
      </div>
      <div className="w-full rounded-[6px] border border-b-border bg-b-panel shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
        <div className="border-b border-b-border bg-b-panel-h px-8 py-6">
          <h1 className="-tracking-[0.02em] text-[22px] font-semibold text-b-1">{title}</h1>
          <p className="mt-1 text-[13px] text-b-2">{subtitle}</p>
        </div>
        <div className="space-y-8 px-8 py-8 text-[13px] leading-relaxed text-b-1">{children}</div>
      </div>
    </div>
  )
}
```

(Bemærk: dette fjerner samtidig `new Date().getFullYear()` fra footer — én mindre ikke-deterministisk render.)

- [ ] **Step 2: Verificér typecheck**

Run: `npx tsc --noEmit`
Expected: 0 fejl. (Sider der stadig importerer `LegalPageLayout` kompilerer uændret — kun visuel chrome ændres.)

- [ ] **Step 3: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/components/ui/b/LegalPageLayout.tsx
git -C C:\Users\birke\Projects\chainhub commit -m "refactor(legal): afklaed LegalPageLayout for standalone-chrome (flyttes under public)"
```

---

### Task 2: Flyt vilkår → `/legal/vilkaar` + redirect-stub

**Files:**

- Create: `src/app/(public)/legal/vilkaar/page.tsx` (flyttet indhold)
- Modify/Replace: `src/app/(auth)/terms/page.tsx` (→ redirect-stub)
- Modify: `src/proxy.ts` (`PUBLIC_PATHS`)

- [ ] **Step 1: Flyt filen med git**

```powershell
New-Item -ItemType Directory -Force "C:\Users\birke\Projects\chainhub\src\app\(public)\legal\vilkaar" | Out-Null
git -C C:\Users\birke\Projects\chainhub mv "src/app/(auth)/terms/page.tsx" "src/app/(public)/legal/vilkaar/page.tsx"
```

- [ ] **Step 2: Tilføj metadata + ret selv-referencer** i `src/app/(public)/legal/vilkaar/page.tsx`. Læs filen. Øverst (efter importerne) tilføj:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Servicevilkår',
  description: 'Servicevilkår for brug af ChainHub (B2B, dansk ret).',
}
```

Hvis teksten et sted refererer til sin egen URL `/terms` (fx i "§ 9 Ændringer"), ret den til `/legal/vilkaar`. (Søg i filen efter `/terms`.)

- [ ] **Step 3: Erstat den gamle rute med en redirect-stub** — overskriv `src/app/(auth)/terms/page.tsx` med:

```tsx
import { redirect } from 'next/navigation'

// Gammel rute bevaret for bogmærker/eksterne links → kanonisk /legal/vilkaar.
export default function TermsRedirect() {
  redirect('/legal/vilkaar')
}
```

- [ ] **Step 4: Gør ruterne offentlige** i `src/proxy.ts` — udvid `PUBLIC_PATHS` (linje 38) med `'/legal'`, `'/terms'`, `'/privacy'`. Resultatet:

```ts
const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/kontakt',
  '/legal',
  '/terms',
  '/privacy',
  '/login',
  '/signup',
  '/invite',
  '/reset-password',
]
```

(`'/legal'` matcher via `startsWith('/legal/')` alle undersider. `/terms`+`/privacy` skal være public for at redirect-stubben kan nå at fyre for uautoriserede.)

- [ ] **Step 5: Verificér build**

Run: `npx next build`
Expected: GRØN. `/legal/vilkaar` (static) + `/terms` (dynamic redirect) i route-tabellen, ingen parallel-route-konflikt.

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add -A "src/app/(public)/legal/vilkaar" "src/app/(auth)/terms/page.tsx" src/proxy.ts
git -C C:\Users\birke\Projects\chainhub commit -m "feat(legal): flyt vilkaar til /legal/vilkaar + redirect fra /terms"
```

---

### Task 3: Flyt privatliv → `/legal/privatliv` + ret §7 cookies + §8 databehandlere

**Files:**

- Create: `src/app/(public)/legal/privatliv/page.tsx` (flyttet + opdateret indhold)
- Modify/Replace: `src/app/(auth)/privacy/page.tsx` (→ redirect-stub)

- [ ] **Step 1: Flyt filen**

```powershell
New-Item -ItemType Directory -Force "C:\Users\birke\Projects\chainhub\src\app\(public)\legal\privatliv" | Out-Null
git -C C:\Users\birke\Projects\chainhub mv "src/app/(auth)/privacy/page.tsx" "src/app/(public)/legal/privatliv/page.tsx"
```

- [ ] **Step 2: Tilføj metadata** øverst i `src/app/(public)/legal/privatliv/page.tsx` (efter importerne):

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privatlivspolitik',
  description: 'Sådan indsamler, bruger og beskytter ChainHub dine personoplysninger (GDPR).',
}
```

- [ ] **Step 3: Erstat HELE § 7 Cookies-sektionen** (den nuværende `{/* § 7 Cookies */}`-`<section>`) med denne — funktionelle cookies + samtykke-baseret analytics:

```tsx
{
  /* § 7 Cookies */
}
;<section>
  <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 7 — Cookies og analytics</h2>
  <p className="text-b-2">ChainHub anvender to typer cookies/lagring:</p>
  <ul className="mt-3 space-y-2 text-b-2">
    <LegalListItem label="Nødvendige (altid aktive):">
      Session-cookie (next-auth.session-token, op til 8 timer) og CSRF-token. Disse er tekniske
      forudsætninger for at logge ind og bruge platformen og kræver ikke samtykke.
    </LegalListItem>
    <LegalListItem label="Analytics (kun ved samtykke):">
      Vi bruger PostHog (EU-hosted) til anonymiseret produktanalyse, så vi kan forbedre platformen.
      Analytics aktiveres kun, hvis du giver samtykke i cookie-banneret, og du kan til enhver tid
      trække samtykket tilbage. Vi anvender ikke markedsføringscookies eller annoncesporing på tværs
      af sider.
    </LegalListItem>
  </ul>
  <p className="mt-3 text-b-2">
    Læs mere i vores{' '}
    <a href="/legal/cookies" className="text-b-blue-fg no-underline hover:underline">
      cookiepolitik
    </a>
    .
  </p>
</section>
```

- [ ] **Step 4: Erstat HELE databehandler-tabellen i § 8** (de 6 `<tr>`-rækker i `<tbody>`) med den korrekte og komplette liste. Find `<tbody className="divide-y divide-b-border">` og erstat dens indhold med:

```tsx
<tbody className="divide-y divide-b-border">
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">Supabase</td>
    <td className="px-4 py-2.5 text-b-2">PostgreSQL-database</td>
    <td className="px-4 py-2.5 text-b-2">EU (Frankfurt)</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">Vercel</td>
    <td className="px-4 py-2.5 text-b-2">Hosting og serverless funktioner</td>
    <td className="px-4 py-2.5 text-b-2">EU / USA (SCCs)</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">Resend</td>
    <td className="px-4 py-2.5 text-b-2">Transaktionelle e-mails og notifikationer</td>
    <td className="px-4 py-2.5 text-b-2">USA (SCCs)</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">OpenAI</td>
    <td className="px-4 py-2.5 text-b-2">
      AI-udlæsning af kontrakter (kun når AI-funktioner er aktiveret)
    </td>
    <td className="px-4 py-2.5 text-b-2">USA (SCCs)</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">Sentry</td>
    <td className="px-4 py-2.5 text-b-2">Fejlovervågning og crashrapportering</td>
    <td className="px-4 py-2.5 text-b-2">EU</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">Cloudflare</td>
    <td className="px-4 py-2.5 text-b-2">Fillagring af uploadede dokumenter (R2)</td>
    <td className="px-4 py-2.5 text-b-2">EU</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">Stripe</td>
    <td className="px-4 py-2.5 text-b-2">Betalingsbehandling og abonnementsstyring</td>
    <td className="px-4 py-2.5 text-b-2">USA (SCCs)</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">Upstash</td>
    <td className="px-4 py-2.5 text-b-2">Rate-limiting (Redis)</td>
    <td className="px-4 py-2.5 text-b-2">EU / USA (SCCs)</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">PostHog</td>
    <td className="px-4 py-2.5 text-b-2">Produktanalyse (kun ved samtykke)</td>
    <td className="px-4 py-2.5 text-b-2">EU</td>
  </tr>
  <tr>
    <td className="px-4 py-2.5 font-medium text-b-1">Google</td>
    <td className="px-4 py-2.5 text-b-2">Single sign-on / OAuth-login (valgfrit)</td>
    <td className="px-4 py-2.5 text-b-2">USA (SCCs)</td>
  </tr>
</tbody>
```

(CVR-feltet i § 1 forbliver `[indsættes ved registrering]` — Philip udfylder ved selskabsregistrering.)

- [ ] **Step 5: Erstat den gamle rute med redirect-stub** — overskriv `src/app/(auth)/privacy/page.tsx` med:

```tsx
import { redirect } from 'next/navigation'

// Gammel rute bevaret for bogmærker → kanonisk /legal/privatliv.
export default function PrivacyRedirect() {
  redirect('/legal/privatliv')
}
```

- [ ] **Step 6: Verificér build**

Run: `npx next build`
Expected: GRØN.

- [ ] **Step 7: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add -A "src/app/(public)/legal/privatliv" "src/app/(auth)/privacy/page.tsx"
git -C C:\Users\birke\Projects\chainhub commit -m "feat(legal): flyt privatliv til /legal/privatliv + ret cookies/databehandlere + redirect"
```

---

### Task 4: Ny cookiepolitik `/legal/cookies`

**Files:**

- Create: `src/app/(public)/legal/cookies/page.tsx`

- [ ] **Step 1: Skriv `src/app/(public)/legal/cookies/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { LegalPageLayout, LegalListItem, LegalMailLink } from '@/components/ui/b/LegalPageLayout'

export const metadata: Metadata = {
  title: 'Cookiepolitik',
  description: 'Hvilke cookies ChainHub bruger og hvordan du styrer dit samtykke.',
}

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout
      title="Cookiepolitik"
      subtitle="Hvilke cookies vi bruger, og hvordan du styrer dit samtykke."
      lastUpdated="8. juni 2026"
    >
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 1 — Hvad er cookies?</h2>
        <p className="text-b-2">
          Cookies og tilsvarende lagringsteknologier er små datamængder, der gemmes i din browser.
          ChainHub bruger dem dels til at få platformen til at fungere, dels — kun med dit samtykke
          — til at forstå og forbedre brugen af produktet.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 2 — Nødvendige cookies</h2>
        <p className="text-b-2">
          Disse er tekniske forudsætninger for platformen og sættes uden samtykke:
        </p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem label="next-auth.session-token:">
            Holder dig logget ind i op til 8 timer. Slettes ved log ud.
          </LegalListItem>
          <LegalListItem label="CSRF-token:">
            Beskytter mod cross-site request forgery.
          </LegalListItem>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 3 — Analytics (kun ved samtykke)
        </h2>
        <p className="text-b-2">
          Hvis du accepterer i cookie-banneret, bruger vi PostHog (EU-hosted) til anonymiseret
          produktanalyse — fx hvilke sider der besøges — så vi kan forbedre ChainHub. Analytics
          aktiveres ikke uden dit samtykke, og data behandles inden for EU.
        </p>
        <p className="mt-3 text-b-2">
          Vi anvender ikke markedsføringscookies eller annoncesporing på tværs af websteder.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 4 — Sådan styrer du dit samtykke
        </h2>
        <p className="text-b-2">
          Når du første gang besøger ChainHub, kan du vælge at acceptere eller afvise analytics i
          cookie-banneret. Du kan til enhver tid ændre dit valg ved at rydde webstedsdata i din
          browser, hvorefter banneret vises igen. Nødvendige cookies kan ikke fravælges, da
          platformen ellers ikke fungerer.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 5 — Kontakt</h2>
        <p className="text-b-2">
          Spørgsmål til vores brug af cookies kan rettes til{' '}
          <LegalMailLink address="kontakt@chainhub.dk" />.
        </p>
      </section>
    </LegalPageLayout>
  )
}
```

- [ ] **Step 2: Verificér build**

Run: `npx next build`
Expected: GRØN; `/legal/cookies` (static) i tabellen.

- [ ] **Step 3: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add "src/app/(public)/legal/cookies/page.tsx"
git -C C:\Users\birke\Projects\chainhub commit -m "feat(legal): cookiepolitik /legal/cookies"
```

---

### Task 5: Ny databehandleraftale `/legal/databehandleraftale` + print/download

**Files:**

- Create: `src/components/public/PrintButton.tsx` (client — `window.print()`)
- Create: `src/app/(public)/legal/databehandleraftale/page.tsx`

- [ ] **Step 1: Skriv `src/components/public/PrintButton.tsx`**

```tsx
'use client'

import { BButton } from '@/components/ui/b'

// "Download" sker via browserens print-til-PDF — ingen server-side PDF-pipeline i v1.
export function PrintButton() {
  return (
    <BButton onClick={() => window.print()} className="text-[12px]">
      Download / udskriv (PDF)
    </BButton>
  )
}
```

- [ ] **Step 2: Skriv `src/app/(public)/legal/databehandleraftale/page.tsx`** (DBA art. 28-konform skabelon)

```tsx
import type { Metadata } from 'next'
import { LegalPageLayout, LegalListItem, LegalMailLink } from '@/components/ui/b/LegalPageLayout'
import { PrintButton } from '@/components/public/PrintButton'

export const metadata: Metadata = {
  title: 'Databehandleraftale',
  description: 'Databehandleraftale (GDPR art. 28) mellem kunden og ChainHub.',
}

export default function DPAPage() {
  return (
    <LegalPageLayout
      title="Databehandleraftale"
      subtitle="GDPR art. 28-aftale mellem kunden (dataansvarlig) og ChainHub (databehandler)."
      lastUpdated="8. juni 2026"
    >
      <section>
        <div className="flex justify-end">
          <PrintButton />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 1 — Parter og baggrund</h2>
        <p className="text-b-2">
          Denne databehandleraftale (&quot;Aftalen&quot;) indgås mellem kunden (&quot;den
          Dataansvarlige&quot;) og ChainHub (&quot;Databehandleren&quot;) og udgør en integreret del
          af kundens abonnementsaftale. Aftalen regulerer Databehandlerens behandling af
          personoplysninger på vegne af den Dataansvarlige i henhold til
          databeskyttelsesforordningen (GDPR) art. 28.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 2 — Genstand og varighed</h2>
        <p className="text-b-2">
          Behandlingen omfatter de personoplysninger, som den Dataansvarlige registrerer i ChainHub
          (kontooplysninger, person- og relationsdata, forretningsdata samt brugs- og logdata).
          Aftalen gælder, så længe Databehandleren behandler personoplysninger på vegne af den
          Dataansvarlige, og ophører ved abonnementets afslutning, jf. § 8.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 3 — Instruks</h2>
        <p className="text-b-2">
          Databehandleren behandler udelukkende personoplysninger efter dokumenteret instruks fra
          den Dataansvarlige, herunder som fastlagt i abonnementsaftalen og denne Aftale.
          Databehandleren underretter den Dataansvarlige, hvis en instruks efter Databehandlerens
          vurdering er i strid med gældende databeskyttelseslovgivning.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 4 — Fortrolighed</h2>
        <p className="text-b-2">
          Databehandleren sikrer, at de personer, der er autoriseret til at behandle
          personoplysningerne, har forpligtet sig til fortrolighed eller er underlagt en passende
          lovbestemt tavshedspligt.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 5 — Behandlingssikkerhed</h2>
        <p className="text-b-2">
          Databehandleren gennemfører passende tekniske og organisatoriske foranstaltninger, jf.
          GDPR art. 32, herunder:
        </p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem>Kryptering af data under transport (TLS) og i hvile.</LegalListItem>
          <LegalListItem>
            Rollebaseret adgangsstyring og organisationsisolation (multi-tenancy).
          </LegalListItem>
          <LegalListItem>Logning, fejlovervågning og rate-limiting mod misbrug.</LegalListItem>
          <LegalListItem>Regelmæssig backup og procedurer for gendannelse.</LegalListItem>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 6 — Underdatabehandlere</h2>
        <p className="text-b-2">
          Den Dataansvarlige giver generel tilladelse til brug af underdatabehandlere.
          Databehandleren sikrer, at hver underdatabehandler er underlagt
          databeskyttelsesforpligtelser svarende til denne Aftale, og varsler den Dataansvarlige om
          planlagte udskiftninger, så der kan gøres indsigelse. Aktuelle underdatabehandlere fremgår
          af{' '}
          <a href="/legal/privatliv" className="text-b-blue-fg no-underline hover:underline">
            privatlivspolitikkens § 8
          </a>{' '}
          (Supabase, Vercel, Resend, OpenAI, Sentry, Cloudflare, Stripe, Upstash, PostHog og
          Google).
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 7 — Bistand til den Dataansvarlige
        </h2>
        <p className="text-b-2">
          Databehandleren bistår — under hensyntagen til behandlingens karakter — den Dataansvarlige
          med at opfylde forpligtelser vedrørende registreredes rettigheder (art. 15-22),
          behandlingssikkerhed (art. 32), brud på persondatasikkerheden (art. 33-34) samt eventuelle
          konsekvensanalyser (art. 35-36). Databehandleren underretter uden unødig forsinkelse den
          Dataansvarlige ved kendskab til et brud på persondatasikkerheden.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 8 — Sletning og tilbagelevering
        </h2>
        <p className="text-b-2">
          Ved Aftalens ophør sletter eller tilbageleverer Databehandleren efter den Dataansvarliges
          valg alle personoplysninger inden for 90 dage, medmindre opbevaring kræves efter gældende
          lovgivning (fx bogføringsloven). Den Dataansvarlige kan eksportere sine data via
          platformens eksportfunktion.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 9 — Audit og tilsyn</h2>
        <p className="text-b-2">
          Databehandleren stiller de oplysninger til rådighed, der er nødvendige for at påvise
          overholdelse af art. 28, og giver mulighed for revision, herunder inspektioner, udført af
          den Dataansvarlige eller en bemyndiget revisor med rimeligt varsel.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 10 — Overførsel til tredjelande
        </h2>
        <p className="text-b-2">
          Overførsel af personoplysninger til lande uden for EU/EØS sker alene på et gyldigt
          overførselsgrundlag, typisk EU-Kommissionens standardkontraktbestemmelser (SCCs), jf.
          underdatabehandlere placeret i USA.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 11 — Kontakt</h2>
        <p className="text-b-2">
          Anmodning om en underskrevet udgave af databehandleraftalen rettes til{' '}
          <LegalMailLink address="kontakt@chainhub.dk" />.
        </p>
      </section>
    </LegalPageLayout>
  )
}
```

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: GRØN; `/legal/databehandleraftale` i tabellen.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add "src/app/(public)/legal/databehandleraftale/page.tsx" src/components/public/PrintButton.tsx
git -C C:\Users\birke\Projects\chainhub commit -m "feat(legal): databehandleraftale /legal/databehandleraftale + print-download"
```

---

### Task 6: Cookie-consent — modul + PostHog-gating + banner

PostHog skal kun tracke efter samtykke. Vi initialiserer med `opt_out_capturing_by_default: true`, gemmer brugerens valg i localStorage, og opt-in'er kun ved samtykke.

**Files:**

- Create: `src/lib/cookie-consent.ts`
- Modify: `src/components/providers/PosthogProvider.tsx`
- Create: `src/components/CookieConsent.tsx`
- Modify: `src/app/layout.tsx` (render banner)
- Create: `src/__tests__/cookie-consent.test.ts`

- [ ] **Step 1: Skriv fejlende test `src/__tests__/cookie-consent.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { COOKIE_CONSENT_KEY, isValidConsent } from '@/lib/cookie-consent'

describe('cookie-consent modul', () => {
  it('eksporterer en stabil localStorage-nøgle', () => {
    expect(COOKIE_CONSENT_KEY).toBe('chainhub-cookie-consent')
  })

  it('isValidConsent godtager kun granted/denied', () => {
    expect(isValidConsent('granted')).toBe(true)
    expect(isValidConsent('denied')).toBe(true)
    expect(isValidConsent(null)).toBe(false)
    expect(isValidConsent('maybe')).toBe(false)
  })
})
```

- [ ] **Step 2: Kør testen — verificér fejl**

Run: `npx vitest run src/__tests__/cookie-consent.test.ts`
Expected: FAIL — `Cannot find module '@/lib/cookie-consent'`.

- [ ] **Step 3: Skriv `src/lib/cookie-consent.ts`**

```ts
export const COOKIE_CONSENT_KEY = 'chainhub-cookie-consent'

export type CookieConsentChoice = 'granted' | 'denied'

export function isValidConsent(value: string | null): value is CookieConsentChoice {
  return value === 'granted' || value === 'denied'
}
```

- [ ] **Step 4: Kør testen — verificér grøn**

Run: `npx vitest run src/__tests__/cookie-consent.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 5: Opdatér `src/components/providers/PosthogProvider.tsx`** — init med opt-out-by-default + opt-in hvis tidligere samtykke:

```tsx
'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { COOKIE_CONSENT_KEY } from '@/lib/cookie-consent'

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

    if (!key) return

    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      // Tracking starter først efter eksplicit samtykke (GDPR opt-in).
      opt_out_capturing_by_default: true,
    })

    if (localStorage.getItem(COOKIE_CONSENT_KEY) === 'granted') {
      posthog.opt_in_capturing()
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
```

- [ ] **Step 6: Skriv `src/components/CookieConsent.tsx`** — banner, vises til consent er valgt:

```tsx
'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import Link from 'next/link'
import { BButton } from '@/components/ui/b'
import { COOKIE_CONSENT_KEY, type CookieConsentChoice } from '@/lib/cookie-consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_CONSENT_KEY)) setVisible(true)
  }, [])

  function choose(choice: CookieConsentChoice) {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice)
    // posthog kan kaldes selvom det ikke er initialiseret (no-op uden key) — guardet defensivt.
    try {
      if (choice === 'granted') posthog.opt_in_capturing()
      else posthog.opt_out_capturing()
    } catch {
      /* posthog ikke initialiseret (ingen key) — ignorér */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie-samtykke"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-b-border bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-b-2">
          Vi bruger nødvendige cookies for at platformen virker, og — kun med dit samtykke —
          analytics til at forbedre ChainHub. Læs vores{' '}
          <Link href="/legal/cookies" className="text-b-blue-fg no-underline hover:underline">
            cookiepolitik
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <BButton onClick={() => choose('denied')} className="text-[12px]">
            Kun nødvendige
          </BButton>
          <BButton primary onClick={() => choose('granted')} className="text-[12px]">
            Acceptér alle
          </BButton>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Render banneret i `src/app/layout.tsx`** — importér og placér `<CookieConsent />` i `<body>` (efter `<Toaster …/>`):

```tsx
import { CookieConsent } from '@/components/CookieConsent'
```

og lige før `</body>`:

```tsx
<CookieConsent />
```

- [ ] **Step 8: Verificér build + typecheck**

Run: `npx tsc --noEmit; npx next build`
Expected: 0 TS-fejl; build GRØN.

- [ ] **Step 9: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/lib/cookie-consent.ts src/__tests__/cookie-consent.test.ts src/components/providers/PosthogProvider.tsx src/components/CookieConsent.tsx src/app/layout.tsx
git -C C:\Users\birke\Projects\chainhub commit -m "feat(privacy): opt-in cookie-consent gater PostHog-analytics"
```

---

### Task 7: Legal-links i footer + ret inbound-links

**Files:**

- Modify: `src/components/public/PublicFooter.tsx`
- Modify: `src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `invite/page.tsx` (inbound-links)

- [ ] **Step 1: Tilføj legal-links i `PublicFooter.tsx`** — erstat placeholder-kommentaren (linje ~18 `{/* Legal-links … */}`) med fire links i `<nav>`:

```tsx
          <Link href="/legal/vilkaar" className="text-b-2 no-underline hover:text-b-1">
            Vilkår
          </Link>
          <Link href="/legal/privatliv" className="text-b-2 no-underline hover:text-b-1">
            Privatliv
          </Link>
          <Link href="/legal/cookies" className="text-b-2 no-underline hover:text-b-1">
            Cookies
          </Link>
          <Link href="/legal/databehandleraftale" className="text-b-2 no-underline hover:text-b-1">
            Databehandleraftale
          </Link>
```

- [ ] **Step 2: Ret inbound-links** i `src/app/(auth)/login/page.tsx`, `signup/page.tsx` og `invite/page.tsx` — find links til `/terms` og `/privacy` og ret dem til `/legal/vilkaar` og `/legal/privatliv` (peg direkte på kanonisk rute, undgå redirect-hop). Læs hver fil og opdatér de respektive `href`/`Link`-attributter.

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: GRØN.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add src/components/public/PublicFooter.tsx "src/app/(auth)/login/page.tsx" "src/app/(auth)/signup/page.tsx" "src/app/(auth)/invite/page.tsx"
git -C C:\Users\birke\Projects\chainhub commit -m "feat(legal): legal-links i footer + ret inbound-links til /legal/*"
```

---

### Task 8: Tests — axe + e2e for legal, redirects og consent

Consent-banneret renderes nu på ALLE sider og kan overlejre interaktivt indhold i eksisterende e2e. Vi seeder derfor consent i localStorage før navigation (undtagen den dedikerede consent-test), så banneret ikke forstyrrer.

**Files:**

- Modify: `tests/e2e/public.spec.ts`
- Modify: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Seed consent for at undgå banner-interferens i public-smoke** — tilføj øverst i `describe`-blokken i `tests/e2e/public.spec.ts` en `beforeEach` der sætter consent FØR sidens scripts kører:

```ts
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('chainhub-cookie-consent', 'denied')
    } catch {
      /* ignore */
    }
  })
})
```

(De eksisterende plan-2-smoke-tests fortsætter uændret, nu uden banner-overlay.)

- [ ] **Step 2: Tilføj legal- + redirect-tests** i samme fil:

```ts
test('legal-sider loader uden auth', async ({ page }) => {
  for (const path of [
    '/legal/vilkaar',
    '/legal/privatliv',
    '/legal/cookies',
    '/legal/databehandleraftale',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('/terms og /privacy redirecter til /legal/*', async ({ page }) => {
  await page.goto('/terms')
  await expect(page).toHaveURL(/\/legal\/vilkaar$/)
  await page.goto('/privacy')
  await expect(page).toHaveURL(/\/legal\/privatliv$/)
})

test('databehandlerliste nævner OpenAI, ikke Anthropic', async ({ page }) => {
  await page.goto('/legal/privatliv')
  await expect(page.getByText('OpenAI')).toBeVisible()
  await expect(page.getByText('Anthropic')).toHaveCount(0)
})
```

- [ ] **Step 3: Tilføj en dedikeret consent-test** (uden seed — banneret SKAL vises her). Tilføj som separat `test.describe` i bunden af `tests/e2e/public.spec.ts`:

```ts
test.describe('cookie-consent banner', () => {
  test('vises på forsiden og forsvinder efter valg', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByRole('dialog', { name: 'Cookie-samtykke' })
    await expect(banner).toBeVisible()
    await page.getByRole('button', { name: 'Kun nødvendige' }).click()
    await expect(banner).toHaveCount(0)
    // Reload: valget huskes, banner vises ikke igen
    await page.reload()
    await expect(page.getByRole('dialog', { name: 'Cookie-samtykke' })).toHaveCount(0)
  })
})
```

- [ ] **Step 4: Udvid axe-sweepet** — tilføj legal-ruterne til `PUBLIC_PAGES` i `tests/e2e/a11y.spec.ts`:

```ts
  { path: '/legal/vilkaar', label: 'Servicevilkår' },
  { path: '/legal/privatliv', label: 'Privatlivspolitik' },
  { path: '/legal/cookies', label: 'Cookiepolitik' },
  { path: '/legal/databehandleraftale', label: 'Databehandleraftale' },
```

Bemærk: axe scanner med consent-banner synligt (realistisk). Banneret skal være a11y-rent (role="dialog", aria-label, kontrast via b-tokens — allerede sikret i Task 6). Fejler axe pga. banneret, fix banner-a11y TDD-style.

- [ ] **Step 5: Kør de berørte suiter**

Run: `npx playwright test tests/e2e/public.spec.ts tests/e2e/a11y.spec.ts`
Expected: Alle grønne. Fejler noget pga. banner-overlay → verificér seed-init-scriptet kører; fejler axe → fix banner-a11y.

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add tests/e2e/public.spec.ts tests/e2e/a11y.spec.ts
git -C C:\Users\birke\Projects\chainhub commit -m "test(legal): e2e + axe for /legal/*, redirects og cookie-consent"
```

---

### Task 9: Fuld kvalitetsgate

- [ ] **Step 1: Format (plan-3-filer)** — `npx prettier --check` på de nye/ændrede filer (legal-sider, LegalPageLayout, PosthogProvider, CookieConsent, cookie-consent.ts, PrintButton, PublicFooter, layout.tsx, test-filer). Kør `npx prettier --write` + commit (`style(legal): prettier`) hvis nogen ikke er rene.

- [ ] **Step 2: Lint** — `npx eslint src --ext ts,tsx`. Verificér antallet IKKE er steget over baseline (4 præeksisterende fejl, ingen i plan-3-filer). Fix kun hvis plan 3 introducerede en ny.

- [ ] **Step 3: TypeScript** — `npx tsc --noEmit` → 0 fejl.

- [ ] **Step 4: Unit-tests (fuld)** — `npm test` → rapportér faktiske tal; baseline + ny cookie-consent-test (2) grønne, 0 failed.

- [ ] **Step 5: Build** — `npx next build` → grøn.

- [ ] **Step 6: E2e (fuld)** — `npx playwright test` → rapportér faktiske tal, alle grønne. Vær særligt opmærksom på at consent-banneret ikke har brudt eksisterende dashboard-/public-tests (seed-scriptet i public.spec dækker public; tjek om nogen dashboard-test klikker noget banneret overlejrer — i så fald tilføj samme seed-beforeEach i `fixtures.ts`/relevant spec og NOTÉR det).

- [ ] **Step 7: Fejler noget → fix** minimalt (failing→fix→grøn), commit `fix(legal): …`. Præeksisterende/urelaterede fejl NOTERES, fixes ikke. **Fail loud** — rapportér faktiske tal, masker intet.

⛔ **Forbud:** ingen `git stash`/`reset`/`checkout -f` (jf. plan 2-uheld).

---

### Task 10: Status + handoff

**Files:**

- Modify: `docs/status/PROGRESS.md`

- [ ] **Step 1: Opdatér `docs/status/PROGRESS.md`** — match plan 1+2-sektionsstilen. Ny sektion "Launch-readiness plan 3 (2026-06-08)": legal konsolideret under `/legal/*` (vilkår/privatliv flyttet, cookies+DBA nye, redirects fra /terms+/privacy); databehandlerliste rettet (OpenAI ikke Anthropic; +Stripe/Upstash/PostHog/Google); opt-in cookie-consent gater PostHog; LegalPageLayout afklædt chrome; legal-links i footer; gate-tal.

- [ ] **Step 2: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add docs/status/PROGRESS.md
git -C C:\Users\birke\Projects\chainhub commit -m "docs: PROGRESS opdateret efter launch-readiness plan 3"
```

- [ ] **Step 3: Handoff** — meld tilbage til Philip: plan 3 leveret, commit-range, og **eksplicit liste over hvad han som jurist skal review'e**: vilkår, privatliv (inkl. ny §7 + databehandlertabel), cookiepolitik, databehandleraftale. Plus åbne punkter: CVR-felt afventer selskabsregistrering; PostHog-samtykke-flow lever. **Ingen PR** (CopenAI: afventer plan 3b+4 + Rico). Tilbyd plan 3b (onboarding-docs).

---

## Self-review mod spec + beslutninger

- **Konsolidér legal under `/legal/*` (beslutning 1):** vilkår+privatliv flyttet (Task 2-3), cookies+DBA nye (Task 4-5), redirects + PUBLIC_PATHS (Task 2-3) ✓
- **4 legal-docs (spec afsnit 5):** Servicevilkår, Privatlivspolitik, Cookiepolitik, DBA art. 28 — alle til stede; DBA har underdatabehandler-liste, instruks, sikkerhed, audit, sletning + download (print) ✓
- **PostHog + dokumentér + consent (beslutning 2):** opt-in-banner gater PostHog (Task 6), cookiepolitik + privatlivs-§7 dokumenterer det (Task 3-4) ✓
- **Faktuel korrekthed:** databehandlertabel rettet (OpenAI ikke Anthropic; +Stripe/Upstash/PostHog/Google) — e2e-test håndhæver "OpenAI, ikke Anthropic" (Task 3, 8) ✓
- **Philip reviewer alle fire (spec):** handoff lister dem eksplicit (Task 10) ✓
- **Cookiepolitik "kun funktionelle" justeret:** nu funktionelle + samtykke-baseret analytics — konsistent med faktisk PostHog-brug ✓
- **Integration:** consent-banner-blast-radius på eksisterende tests håndteret via seed-init-script (Task 8) + gate-tjek (Task 9) ✓
- **No-placeholder:** alle legal-tekster + kode komplette. CVR-felt er bevidst markeret `[indsættes ved registrering]` (selskab ikke registreret endnu) — eneste tilsigtede placeholder, dokumenteret i handoff. ✓
- **Type-konsistens:** `CookieConsentChoice` delt mellem `cookie-consent.ts`, `PosthogProvider`, `CookieConsent`; `COOKIE_CONSENT_KEY` ét sted ✓
- **Uden for scope (→ plan 3b):** onboarding-docs `/docs` + Docs-nav-link. Docs-link tilføjes IKKE til nav her (undgår 404). ✓
