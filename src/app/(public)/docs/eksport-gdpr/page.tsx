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
