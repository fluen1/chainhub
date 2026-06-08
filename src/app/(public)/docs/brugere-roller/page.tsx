import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brugere & roller — Dokumentation',
  description: 'Inviter dit team og styr adgang med rollebaserede tilladelser.',
}

export default function DocsBrugereRollerPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Brugere & roller</h1>
      <p className="text-b-2">
        ChainHub bruger rollebaseret adgang, så hver bruger kun ser og kan ændre det, der er
        relevant for vedkommende.
      </p>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Inviter en bruger</h2>
        <p className="text-b-2">
          Gå til &quot;Indstillinger&quot; → &quot;Brugere og adgang&quot; og klik &quot;Opret
          bruger&quot;. Angiv navn, e-mail og rolle. Ventende invitationer vises i et eget panel, og
          du kan til enhver tid redigere en brugers rolle eller deaktivere adgangen igen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Roller på kæde-niveau</h2>
        <ul className="ml-4 list-disc space-y-1 text-b-2">
          <li>
            <strong className="text-b-1">Kædeejer</strong> — fuld adgang til alle moduler og
            indstillinger.
          </li>
          <li>
            <strong className="text-b-1">Kædeadministrator</strong> — administrerer brugere og alle
            moduler.
          </li>
          <li>
            <strong className="text-b-1">Juridisk ansvarlig</strong> — kontrakter, sager og
            dokumenter.
          </li>
          <li>
            <strong className="text-b-1">Økonomisk ansvarlig</strong> — finansdata og eksport.
          </li>
          <li>
            <strong className="text-b-1">Revisor / Læseadgang</strong> — læseadgang til alle
            moduler.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-b-1">Roller på selskabs-niveau</h2>
        <p className="text-b-2">
          Selskabsroller giver adgang til ét eller flere bestemte selskaber frem for hele kæden — du
          vælger de tilknyttede selskaber, når du tildeler rollen:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-b-2">
          <li>
            <strong className="text-b-1">Klinikchef</strong> — fuld adgang til det tildelte selskab.
          </li>
          <li>
            <strong className="text-b-1">Klinikjurist</strong> — kontrakter og sager for det
            tildelte selskab.
          </li>
          <li>
            <strong className="text-b-1">Klinik-læseadgang</strong> — læseadgang til det tildelte
            selskab.
          </li>
        </ul>
      </section>
    </>
  )
}
