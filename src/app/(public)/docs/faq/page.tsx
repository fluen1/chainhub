import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ofte stillede spørgsmål — Dokumentation',
  description: 'Svar på de mest almindelige spørgsmål om ChainHub.',
}

const FAQ = [
  {
    q: 'Hvordan starter jeg?',
    a: 'Opret en konto og navngiv din kæde. Du får en gratis prøveperiode på 14 dage med adgang til alle funktioner — ingen betalingskort kræves for at komme i gang.',
  },
  {
    q: 'Hvad sker der, når prøveperioden udløber?',
    a: 'De sidste 7 dage af prøveperioden viser vi en påmindelse med et link til at vælge en plan. Vælger du ikke en plan, sættes kontoen på pause — dine data slettes ikke automatisk.',
  },
  {
    q: 'Hvilke planer findes der?',
    a: 'Basis (3.500 kr./md) er kerne-CRM uden AI. Plus (9.500 kr./md) tilføjer AI-udlæsning og -indsigter med 50 udlæsninger inkluderet pr. måned. Enterprise (fra 32.000 kr./md) tilføjer portefølje-AI, RAG-søgning og SLA. Du skifter plan under Indstillinger → Abonnement.',
  },
  {
    q: 'Hvordan nulstiller jeg min adgangskode?',
    a: 'Vælg "Glemt adgangskode?" på login-siden og følg linket i mailen. Linket udløber efter 1 time af sikkerhedshensyn.',
  },
  {
    q: 'Bruger I AI på mine kontrakter?',
    a: 'Kun hvis du er på en plan med AI og selv uploader et dokument til udlæsning. AI-output er altid et forslag, der kræver din godkendelse — intet ændres automatisk.',
  },
  {
    q: 'Hvor opbevares mine data?',
    a: 'Din database hostes i EU. Enkelte underdatabehandlere (fx e-mail og betaling) er i USA på grundlag af EU-Kommissionens standardkontraktbestemmelser. Se den fulde liste i privatlivspolitikken.',
  },
  {
    q: 'Hvordan får jeg hjælp?',
    a: 'Skriv til os på kontakt@chainhub.dk, så vender vi tilbage hurtigst muligt.',
  },
]

export default function DocsFaqPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold text-b-1">Ofte stillede spørgsmål</h1>
      <div className="space-y-5">
        {FAQ.map((item) => (
          <section key={item.q} className="space-y-1">
            <h2 className="text-[15px] font-semibold text-b-1">{item.q}</h2>
            <p className="text-b-2">{item.a}</p>
          </section>
        ))}
      </div>
    </>
  )
}
