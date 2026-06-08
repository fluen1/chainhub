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
