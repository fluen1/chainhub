import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Selskaber & ejerskab — Dokumentation',
  description: 'Opret selskaber, kortlæg ejerskab og følg koncernens sundhed.',
}

export default function DocsSelskaberPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Selskaber & ejerskab</h1>
      <p className="text-b-2">
        Selskaber er kernen i ChainHub. Her samler du hele koncernen — fra holdingselskab til den
        enkelte lokation — med ejerskab, økonomi, kontrakter og sager knyttet til hvert selskab.
      </p>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Opret et selskab</h2>
        <p className="text-b-2">
          Gå til &quot;Selskaber&quot; og klik &quot;+ Opret selskab&quot;. Udfyld selskabsnavn og
          eventuelt CVR-nummer — når du indtaster et gyldigt CVR, foreslår ChainHub automatisk navn
          og adresse fra CVR-registeret. Vælg selskabsform (ApS, A/S, I/S, Holding ApS eller andet)
          og udfyld adresse efter behov.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Selskabets detaljeside</h2>
        <p className="text-b-2">
          Klik på et selskab for at se alt samlet i paneler: &quot;Ejerskab&quot;,
          &quot;Personer&quot;, &quot;Kontrakter&quot;, &quot;Sager&quot;, &quot;Finans&quot;,
          &quot;Besøg&quot;, &quot;Dokumenter&quot; og &quot;Noter&quot;. Øverst ser du nøgletal som
          kædeandel, antal kontrakter, åbne sager og EBITDA. Med &quot;Rediger stamdata&quot;
          opdaterer du selskabets grunddata.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Kortlæg ejerskab</h2>
        <p className="text-b-2">
          I panelet &quot;Ejerskab&quot; klikker du &quot;+ Tilføj ejer&quot;. En ejer kan være en
          person, et holdingselskab eller et andet selskab. Angiv ejerandel i procent og dato for
          erhvervelse. ChainHub viser ejeraftalens status (Aktiv eller Udløbet), så du hurtigt kan
          se, hvor der mangler at blive fulgt op.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Sundhed og visninger</h2>
        <p className="text-b-2">
          Hvert selskab får automatisk en sundhedsstatus — &quot;Kritisk&quot;,
          &quot;Opmærksomhed&quot; eller &quot;OK&quot; — baseret på blandt andet forfaldne opgaver
          og udløbende kontrakter. På listen kan du skifte mellem &quot;Flat&quot;,
          &quot;Grupperet&quot; og &quot;Kanban&quot;-visning, så du får overblikket, der passer til
          opgaven.
        </p>
      </section>
    </>
  )
}
