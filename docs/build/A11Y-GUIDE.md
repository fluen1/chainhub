# A11y Guide — ChainHub

**Standard:** WCAG 2.1 Level AA (Level A baseline + kritisk AA som kontrast + 44px tap-targets)
**Regression-beskyttelse:** axe-core i Playwright CI (`tests/e2e/a11y.spec.ts`)
**Static linting:** `eslint-plugin-jsx-a11y/recommended` i `.eslintrc.json`

## Hvad testes i CI

- **10 top-level sider**: /dashboard, /companies, /contracts, /cases, /tasks, /persons, /documents, /calendar, /search, /settings
- **5 detail-sider**: /companies/[id], /contracts/[id], /cases/[id], /tasks/[id], /persons/[id] (med seed-IDs)
- Scanner med axe-core via `@axe-core/playwright`
- Tags anvendt: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`
- **Fejler på:** `critical` eller `serious` violations
- **Tolereres (p.t.):** `moderate`, `minor` — logges men fejler ikke CI

## Tilføj ny side til scan

Åbn `tests/e2e/a11y.spec.ts`. Find `PAGES`-array og tilføj:

```ts
{ path: '/min-nye-side', label: 'Min nye side' },
```

For dynamisk side med `[id]`-param: tilføj i `DETAIL_PAGES`-array + sikr at `SEED_IDS`-struct har et korrekt seed-ID (fra `prisma/seed.ts`'s `uid(n)`-helper).

## Common violations + fixes

Hvis axe rapporterer violations — her er fix-mønstre for de mest almindelige:

### `color-contrast`

Baggrund/tekst-kontrast under WCAG AA (4.5:1 for normal text, 3:1 for large).

**Fix**: Bump gray-400 → gray-500 (eller darker). Se `docs/build/CONVENTIONS.md` § Kontrast-regler (WCAG AA).

```tsx
// Før (fail):
<p className="text-gray-400">Hjælpetekst</p>

// Efter (pass):
<p className="text-gray-500">Hjælpetekst</p>
```

### `landmark-one-main`

Side mangler én (og kun én) `<main>`.

**Fix**: Verificér at dashboard-layout wrapper children i `<main id="main-content">`. Check `src/app/(dashboard)/layout.tsx` + `src/components/layout/mobile-sidebar-wrapper.tsx`.

### `region`

Content udenfor landmark-regioner (`<main>`, `<nav>`, `<aside>`, `<header>`).

**Fix**: Wrap orphan-content i relevant landmark. Eller brug `role="region" aria-label="..."` på den sektions-container der holder indholdet.

### `html-has-lang`

Root `<html>`-tag mangler `lang`-attribut.

**Fix**: Check `src/app/layout.tsx`:

```tsx
<html lang="da">
```

### `button-name`

Button med kun ikon (ingen tekst) har ikke accessible name.

**Fix**: Tilføj `aria-label`:

```tsx
<button aria-label="Luk dialog">
  <X className="h-5 w-5" />
</button>
```

### `link-name`

Link med kun ikon har ikke accessible name. Samme fix som button-name.

### `aria-valid-attr-value`

Forkert værdi på aria-attribut (fx `aria-labelledby` peger på ikke-eksisterende id).

**Fix**: Verificér at id-referencen eksisterer i samme side. AccessibleDialog har sin egen `titleId`-prop der skal være unik.

## Lokal debugging

Playwright-tests kører mod separat DB (E2E_DATABASE_URL) på port 3010. For at køre axe-spec lokalt:

```bash
# 1. Start dev-server på E2E-port + seed-data
E2E_PORT=3010 npm run dev -- --port 3010
# I separat terminal:
npx playwright test tests/e2e/a11y.spec.ts --debug
```

Playwright UI-mode viser præcis hvor violations sker i DOM (`--debug`-flag).

## Eskalering — hvis en violation ikke kan fikses

Hvis en violation kommer fra 3rd-party (fx Leaflet-map, eller lucide-react-intern SVG), kan reglen disables MEGET SPECIFIKT:

```ts
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa'])
  .disableRules(['color-contrast']) // FIXME: Leaflet attribution-link — afventer upstream-fix
  .analyze()
```

**Regler for exempts:**

- Max 1 regel-disable pr. side
- Altid med kommentar der forklarer hvorfor + hvornår det kan re-enables
- Dokumentér i `docs/status/BLOCKERS.md` hvis det er vedvarende

Hvis flere regler skulle disables på samme side → strukturelt problem, refactor.

## Test-scope + fremtidige expansions

**V1-scope:**

- 15 sider
- Chromium desktop
- WCAG 2.1 A/AA
- Kritisk + serious fejler CI

**Potentielle expansions (ikke implementeret):**

- Mobile viewport (375px) — separat test-project
- Rolle-specifikke scans (GROUP_LEGAL, GROUP_FINANCE ser andet indhold)
- WCAG 2.2 AA delta (target-size, consistent-help, dragging-movements)
- Screenshot-regression (Percy, Chromatic)

## Tilhørende dokumenter

- `docs/superpowers/plans/2026-04-18-axe-core-ci.md` — implementation-plan
- `docs/build/CONVENTIONS.md` § Kontrast-regler (WCAG AA)
- `docs/status/PROGRESS.md` — a11y-track historik
