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
