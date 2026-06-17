// /legal/privatliv — Privatlivspolitik. Statisk side, ingen auth påkrævet.

import type { Metadata } from 'next'
import {
  LegalPageLayout,
  LegalListItem,
  LegalContactBox,
  LegalMailLink,
  LegalExternalLink,
} from '@/components/ui/b/LegalPageLayout'
import { env } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Privatlivspolitik',
  description: 'Sådan indsamler, bruger og beskytter ChainHub dine personoplysninger (GDPR).',
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privatlivspolitik"
      subtitle="Sådan indsamler, bruger og beskytter ChainHub dine personoplysninger."
      lastUpdated="25. maj 2026"
    >
      {/* § 1 Dataansvarlig */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 1 — Dataansvarlig</h2>
        <p className="text-b-2">
          Den dataansvarlige for behandlingen af dine personoplysninger er:
        </p>
        <LegalContactBox>
          <p className="font-semibold text-b-1">ChainHub</p>
          {env.CHAINHUB_CVR && <p>CVR: {env.CHAINHUB_CVR}</p>}
          {env.CHAINHUB_ADDRESS && <p>{env.CHAINHUB_ADDRESS}</p>}
          <p>Danmark</p>
          <p className="mt-1">
            E-mail: <LegalMailLink address="kontakt@chainhub.dk" />
          </p>
        </LegalContactBox>
      </section>

      {/* § 2 Hvilke data indsamles */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 2 — Hvilke oplysninger indsamler vi?
        </h2>
        <p className="text-b-2">
          Vi indsamler følgende kategorier af personoplysninger i forbindelse med din brug af
          ChainHub:
        </p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem label="Kontooplysninger:">
            Navn, e-mailadresse, stilling og organisation.
          </LegalListItem>
          <LegalListItem label="Brugsdata:">
            Loginhistorik, IP-adresse, browsertype og sidevisninger til sikkerhed og fejlfinding.
          </LegalListItem>
          <LegalListItem label="Forretningsdata:">
            Kontrakter, sager, opgaver og finansielle nøgletal, som du og din organisation
            registrerer i systemet.
          </LegalListItem>
          <LegalListItem label="Personrelationer:">
            Navne, roller og kontaktoplysninger på partnere, bestyrelsesmedlemmer og andre
            tilknyttede personer, som du registrerer på vegne af din organisation.
          </LegalListItem>
        </ul>
        <p className="mt-3 text-b-2">
          Vi indsamler ikke særlige kategorier af personoplysninger (følsomme oplysninger) som
          f.eks. helbredsdata, politisk overbevisning eller biometriske data.
        </p>
      </section>

      {/* § 3 Formål */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 3 — Hvad bruger vi oplysningerne til?
        </h2>
        <p className="text-b-2">Vi behandler dine oplysninger til følgende formål:</p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem>
            Levering og drift af ChainHub-platformen, herunder kontraktstyring, governance og
            porteføljestyring.
          </LegalListItem>
          <LegalListItem>
            Autentificering og adgangsstyring (log ind, sessioner, rollebaserede tilladelser).
          </LegalListItem>
          <LegalListItem>
            Udsendelse af systemnotifikationer og e-mail-digests om aktivitet, der er relevant for
            din organisation.
          </LegalListItem>
          <LegalListItem>
            Fejlfinding, sikkerhedsovervågning og forbedring af systemets stabilitet.
          </LegalListItem>
          <LegalListItem>
            Opfyldelse af lovkrav og berettigede interesser i at beskytte platformen mod misbrug.
          </LegalListItem>
        </ul>
      </section>

      {/* § 4 Retsgrundlag */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 4 — Retsgrundlag</h2>
        <p className="text-b-2">
          Vi behandler dine oplysninger på følgende retsgrundlag i henhold til GDPR art. 6:
        </p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem label="Art. 6 stk. 1 litra b">
            (kontraktopfyldelse): Behandling, der er nødvendig for at levere den aftalte service til
            din organisation.
          </LegalListItem>
          <LegalListItem label="Art. 6 stk. 1 litra f">
            (legitime interesser): Sikkerhedslogning, svindelforebyggelse og driftsovervågning.
          </LegalListItem>
          <LegalListItem label="Art. 6 stk. 1 litra c">
            (retlig forpligtelse): Behandling, der kræves for at overholde gældende lovgivning.
          </LegalListItem>
        </ul>
      </section>

      {/* § 5 Opbevaring */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 5 — Opbevaringsperiode</h2>
        <p className="text-b-2">
          Vi opbevarer dine oplysninger, så længe din organisation er aktiv kunde hos ChainHub.
          Efter opsigelse af abonnementet slettes eller anonymiseres alle personoplysninger inden
          for 90 dage, medmindre vi er forpligtet til at opbevare dem længere af regnskabsmæssige
          eller retlige årsager (typisk op til 5 år efter bogføringsloven).
        </p>
        <p className="mt-2 text-b-2">
          Systemlogfiler (IP, sessiondata) opbevares i maksimalt 12 måneder.
        </p>
      </section>

      {/* § 6 Dine rettigheder */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 6 — Dine rettigheder</h2>
        <p className="text-b-2">
          Du har følgende rettigheder i henhold til GDPR, som du til enhver tid kan gøre gældende
          over for os:
        </p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem label="Indsigt (art. 15):">
            Ret til at få bekræftet, om vi behandler oplysninger om dig, og i givet fald hvilke.
          </LegalListItem>
          <LegalListItem label="Berigtigelse (art. 16):">
            Ret til at få urigtige oplysninger rettet.
          </LegalListItem>
          <LegalListItem label="Sletning (art. 17):">
            Ret til at få dine oplysninger slettet, hvor behandlingen ikke længere er nødvendig.
          </LegalListItem>
          <LegalListItem label="Begrænsning (art. 18):">
            Ret til at anmode om begrænsning af behandlingen i visse tilfælde.
          </LegalListItem>
          <LegalListItem label="Dataportabilitet (art. 20):">
            Ret til at modtage dine oplysninger i et struktureret, maskinlæsbart format.
          </LegalListItem>
          <LegalListItem label="Indsigelse (art. 21):">
            Ret til at gøre indsigelse mod behandling baseret på legitime interesser.
          </LegalListItem>
        </ul>
        <p className="mt-3 text-b-2">
          Send din anmodning til <LegalMailLink address="kontakt@chainhub.dk" />. Vi svarer inden
          for 30 dage. Du kan også klage til{' '}
          <LegalExternalLink href="https://www.datatilsynet.dk">Datatilsynet</LegalExternalLink>.
        </p>
      </section>

      {/* § 7 Cookies */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 7 — Cookies og analytics</h2>
        <p className="text-b-2">ChainHub anvender to typer cookies/lagring:</p>
        <ul className="mt-3 space-y-2 text-b-2">
          <LegalListItem label="Nødvendige (altid aktive):">
            Session-cookie (next-auth.session-token, op til 8 timer) og CSRF-token. Disse er
            tekniske forudsætninger for at logge ind og bruge platformen og kræver ikke samtykke.
          </LegalListItem>
          <LegalListItem label="Analytics (kun ved samtykke):">
            Vi bruger PostHog (EU-hosted) til anonymiseret produktanalyse, så vi kan forbedre
            platformen. Analytics aktiveres kun, hvis du giver samtykke i cookie-banneret, og du kan
            til enhver tid trække samtykket tilbage. Vi anvender ikke markedsføringscookies eller
            annoncesporing på tværs af sider.
          </LegalListItem>
        </ul>
        <p className="mt-3 text-b-2">
          Læs mere i vores{' '}
          <a href="/legal/cookies" className="text-b-blue-fg underline hover:no-underline">
            cookiepolitik
          </a>
          .
        </p>
      </section>

      {/* § 8 Databehandlere */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 8 — Databehandlere og tredjeparter
        </h2>
        <p className="text-b-2">
          Vi anvender følgende underleverandører (databehandlere) til at drive platformen. Alle
          behandler data på vores vegne og er underlagt databehandleraftaler:
        </p>
        <div className="mt-3 overflow-hidden rounded-[4px] border border-b-border">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-b-border bg-b-panel-h">
                <th className="px-4 py-2.5 text-left font-semibold text-b-1">Leverandør</th>
                <th className="px-4 py-2.5 text-left font-semibold text-b-1">Formål</th>
                <th className="px-4 py-2.5 text-left font-semibold text-b-1">Lokation</th>
              </tr>
            </thead>
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
          </table>
        </div>
        <p className="mt-3 text-b-2">
          Overførsler til USA sker på grundlag af EU-Kommissionens standardkontraktbestemmelser
          (SCCs). Vi videregiver ikke dine oplysninger til tredjeparter med henblik på
          markedsføring.
        </p>
      </section>

      {/* § 9 Ændringer */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">
          § 9 — Ændringer i privatlivspolitikken
        </h2>
        <p className="text-b-2">
          Vi opdaterer løbende denne privatlivspolitik, når vores behandlingspraksis ændrer sig
          eller ved ny lovgivning. Væsentlige ændringer varsles via e-mail til din organisations
          primære kontakt mindst 14 dage før ikrafttrædelse. Datoen øverst på siden angiver seneste
          revision.
        </p>
      </section>

      {/* § 10 Kontakt */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 10 — Kontakt</h2>
        <p className="text-b-2">
          Spørgsmål til behandlingen af dine personoplysninger kan rettes til:
        </p>
        <LegalContactBox>
          <p>
            E-mail: <LegalMailLink address="kontakt@chainhub.dk" />
          </p>
          <p className="mt-1">
            Datatilsynet:{' '}
            <LegalExternalLink href="https://www.datatilsynet.dk">
              www.datatilsynet.dk
            </LegalExternalLink>{' '}
            · +45 33 19 32 00
          </p>
        </LegalContactBox>
      </section>
    </LegalPageLayout>
  )
}
