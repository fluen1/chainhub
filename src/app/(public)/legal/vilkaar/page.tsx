// /legal/vilkaar — Servicevilkår. Statisk side, ingen auth påkrævet.

import type { Metadata } from 'next'
import {
  LegalPageLayout,
  LegalListItem,
  LegalContactBox,
  LegalMailLink,
} from '@/components/ui/b/LegalPageLayout'

export const metadata: Metadata = {
  title: 'Servicevilkår',
  description: 'Servicevilkår for brug af ChainHub (B2B, dansk ret).',
}

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Servicevilkår"
      subtitle="Vilkår og betingelser for brug af ChainHub-platformen."
      lastUpdated="25. maj 2026"
    >
      {/* § 1 Serviceaftale */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 1 — Serviceaftale</h2>
        <p className="text-b-2">
          ChainHub leverer en cloudbaseret platform til kædegrupper og porteføljeorganisationer, der
          administrerer co-ejede selskaber. Platformen omfatter funktioner til kontraktstyring,
          governance, sagshåndtering, opgavestyring, personrelationer og finansielt overblik.
        </p>
        <p className="mt-2 text-b-2">
          Disse vilkår regulerer forholdet mellem ChainHub (herefter &ldquo;vi&rdquo; eller
          &ldquo;ChainHub&rdquo;) og den organisation, der tegner abonnement (herefter
          &ldquo;kunden&rdquo;). Ved at oprette en konto og bruge platformen accepterer kunden disse
          vilkår på vegne af sin organisation.
        </p>
        <p className="mt-2 text-b-2">
          Brug af platformen forudsætter et gyldigt abonnement. ChainHub er et B2B-produkt —
          vilkårene gælder for erhvervsdrivende og ikke til forbrugerbrug.
        </p>
      </section>

      {/* § 2 Brugerforpligtelser */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 2 — Brugerforpligtelser</h2>
        <p className="text-b-2">Som kunde forpligter du og din organisation jer til at:</p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem>
            Benytte platformen lovligt og i overensstemmelse med gældende dansk og EU-ret, herunder
            GDPR.
          </LegalListItem>
          <LegalListItem>
            Sikre, at adgangsoplysninger (brugernavne og adgangskoder) opbevares fortroligt og ikke
            deles med uautoriserede personer.
          </LegalListItem>
          <LegalListItem>
            Straks orientere ChainHub ved mistanke om uautoriseret adgang til kontoen.
          </LegalListItem>
          <LegalListItem>
            Registrere nøjagtige og ajourførte oplysninger i systemet og ikke bevidst indlæse
            fejlagtige data.
          </LegalListItem>
          <LegalListItem>
            Afstå fra forsøg på reverse engineering, scraping eller anden uautoriseret udtrækning af
            data fra platformen.
          </LegalListItem>
          <LegalListItem>
            Ikke anvende platformen til at lagre eller behandle ulovligt indhold eller oplysninger,
            der krænker tredjeparters rettigheder.
          </LegalListItem>
        </ul>
      </section>

      {/* § 3 Dataejerskab */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 3 — Dataejerskab</h2>
        <p className="text-b-2">
          <span className="font-medium text-b-1">Kundens data tilhører kunden.</span> Alle
          oplysninger, du og din organisation registrerer i ChainHub — herunder kontrakter, sager,
          selskabsdata, personoplysninger og dokumenter — er og forbliver kundens ejendom.
        </p>
        <p className="mt-2 text-b-2">
          ChainHub behandler disse data udelukkende som databehandler på kundens vegne og i
          overensstemmelse med den indgåede databehandleraftale. Vi anvender ikke kundens data til
          kommercielle formål, analyse på tværs af kunder eller videregivelse til tredjeparter uden
          kundens eksplicitte samtykke.
        </p>
        <p className="mt-2 text-b-2">
          Ved opsigelse af abonnementet har kunden ret til at eksportere alle sine data i et
          maskinlæsbart format inden for 90 dage. Herefter slettes data i overensstemmelse med
          privatlivspolitikken.
        </p>
      </section>

      {/* § 4 Tilgængelighed og oppetid */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 4 — Tilgængelighed og oppetid</h2>
        <p className="text-b-2">
          ChainHub bestræber sig på en oppetid på 99,5 % pr. kalendermåned, ekskl. planlagt
          vedligeholdelse. Planlagt vedligeholdelse varsles via e-mail mindst 24 timer i forvejen og
          placeres så vidt muligt uden for dansk arbejdstid.
        </p>
        <p className="mt-2 text-b-2">
          ChainHub kan ikke garantere uafbrudt adgang og er ikke ansvarlig for nedetid forårsaget af
          force majeure, tredjepartsinfrastruktur (herunder Supabase, Vercel eller internetudbydere)
          eller planlagte opdateringer.
        </p>
        <p className="mt-2 text-b-2">
          Vi forbeholder os ret til at foretage opdateringer og ændringer af platformen for at
          forbedre sikkerhed, funktionalitet og ydeevne. Væsentlige funktionsændringer varsles i
          rimelig tid.
        </p>
      </section>

      {/* § 5 Priser og betaling */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 5 — Priser og betaling</h2>
        <p className="text-b-2">
          Priser fremgår af den til enhver tid gældende prisliste eller den individuelle aftale
          indgået med kunden. Alle priser er ekskl. moms, medmindre andet fremgår eksplicit.
        </p>
        <p className="mt-2 text-b-2">
          Fakturering sker forud for den aftalte abonnementsperiode (månedligt eller årligt). Ved
          manglende betaling sendes påmindelser, og ChainHub forbeholder sig ret til at suspendere
          adgang ved fortsat misligholdelse efter 14 dages varsel.
        </p>
        <p className="mt-2 text-b-2">
          Prisændringer varsles med mindst 30 dages skriftligt varsel pr. e-mail. Ved uenighed om
          varslet prisændring kan kunden opsige abonnementet uden gebyr inden ikrafttrædelse.
        </p>
      </section>

      {/* § 6 Ansvarsfraskrivelse */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 6 — Ansvarsfraskrivelse</h2>
        <p className="text-b-2">
          Platformen leveres &ldquo;som den er og forefindes&rdquo;. ChainHub er ikke ansvarlig for:
        </p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem>
            Direkte eller indirekte tab som følge af fejl i data registreret af kunden.
          </LegalListItem>
          <LegalListItem>
            Tab opstået som følge af nedetid, forsinkelse eller fejl i tredjepartstjenester.
          </LegalListItem>
          <LegalListItem>
            Indirekte tab, følgeskader, driftstab eller tabt fortjeneste.
          </LegalListItem>
          <LegalListItem>
            Tab som følge af kundens misligholdelse af disse vilkår eller gældende lovgivning.
          </LegalListItem>
        </ul>
        <p className="mt-3 text-b-2">
          ChainHubs samlede ansvar over for kunden er under alle omstændigheder begrænset til det
          beløb, kunden har betalt for abonnementet i de 3 måneder forud for skadens opståen.
        </p>
      </section>

      {/* § 7 Intellektuel ejendomsret */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 7 — Intellektuel ejendomsret</h2>
        <p className="text-b-2">
          ChainHub og dets licensgivere ejer alle rettigheder til platformen, herunder software,
          design, varemærker og dokumentation. Kunden opnår en ikke-eksklusiv, ikke-overdragelig
          brugsret til platformen i abonnementsperioden.
        </p>
        <p className="mt-2 text-b-2">
          Kunden giver ChainHub en begrænset ret til at behandle og lagre kundens data i det omfang,
          det er nødvendigt for at levere servicen.
        </p>
      </section>

      {/* § 8 Opsigelse */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 8 — Opsigelse</h2>
        <p className="text-b-2">
          <span className="font-medium text-b-1">Kundens opsigelse:</span> Abonnementet kan opsiges
          med 30 dages varsel til udgangen af en faktureringsperiode. Opsigelse meddeles skriftligt
          til <LegalMailLink address="kontakt@chainhub.dk" />.
        </p>
        <p className="mt-2 text-b-2">
          <span className="font-medium text-b-1">ChainHubs opsigelse:</span> ChainHub kan opsige
          aftalen med 30 dages varsel. Ved væsentlig misligholdelse (herunder manglende betaling,
          brug i strid med vilkårene eller ulovlig aktivitet) kan aftalen ophæves med øjeblikkelig
          virkning.
        </p>
        <p className="mt-2 text-b-2">
          Ved ophør af abonnementet ophører brugsretten til platformen, og data stilles til rådighed
          for eksport i 90 dage, hvorefter de slettes.
        </p>
      </section>

      {/* § 9 Ændringer af vilkår */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 9 — Ændringer af vilkår</h2>
        <p className="text-b-2">
          ChainHub forbeholder sig ret til at ændre disse vilkår. Væsentlige ændringer varsles via
          e-mail til kundens primære kontakt mindst 30 dage før ikrafttrædelse. Fortsat brug af
          platformen efter ikrafttrædelsesdatoen anses som accept af de nye vilkår.
        </p>
        <p className="mt-2 text-b-2">
          Den til enhver tid gældende version af vilkårene er tilgængelig på{' '}
          <a href="/legal/vilkaar" className="text-b-blue-fg no-underline hover:underline">
            chainhub.dk/legal/vilkaar
          </a>
          . Datoen øverst på siden angiver seneste revision.
        </p>
      </section>

      {/* § 10 Lovvalg og værneting */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 10 — Lovvalg og værneting</h2>
        <p className="text-b-2">
          Disse vilkår er underlagt dansk ret. Eventuelle tvister, der ikke kan løses i mindelighed,
          afgøres ved Byretten i København som første instans.
        </p>
        <p className="mt-2 text-b-2">
          ChainHub og kunden forpligter sig til i god tro at søge at løse eventuelle uenigheder
          gennem dialog, inden sagen indbringes for domstolene.
        </p>
      </section>

      {/* § 11 Kontakt */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 11 — Kontakt</h2>
        <p className="text-b-2">Spørgsmål til disse vilkår kan rettes til:</p>
        <LegalContactBox>
          <p className="font-semibold text-b-1">ChainHub</p>
          <p>
            E-mail: <LegalMailLink address="kontakt@chainhub.dk" />
          </p>
        </LegalContactBox>
      </section>
    </LegalPageLayout>
  )
}
