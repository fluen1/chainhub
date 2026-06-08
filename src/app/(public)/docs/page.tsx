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
