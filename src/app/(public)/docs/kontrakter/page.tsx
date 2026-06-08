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
