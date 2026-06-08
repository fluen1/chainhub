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
