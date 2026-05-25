// /privacy — Privatlivspolitik. Statisk side, ingen auth påkrævet.

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-b-canvas text-b-1">
      <div className="flex flex-1 flex-col items-center px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex w-full max-w-3xl items-center justify-between">
          <a
            href="/login"
            className="flex items-center gap-2 text-[13px] font-semibold text-b-1 no-underline"
          >
            <svg viewBox="0 0 14 14" width={16} height={16} aria-hidden className="shrink-0">
              <rect
                x="1"
                y="1"
                width="12"
                height="12"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <rect x="4.5" y="4.5" width="5" height="5" rx="0.5" fill="currentColor" />
            </svg>
            ChainHub
          </a>
          <span className="text-[11px] text-b-3">Senest opdateret: 25. maj 2026</span>
        </div>

        {/* Content */}
        <div className="w-full max-w-3xl rounded-[6px] border border-b-border bg-b-panel shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
          <div className="border-b border-b-border bg-b-panel-h px-8 py-6">
            <h1 className="text-[22px] font-semibold text-b-1" style={{ letterSpacing: '-0.02em' }}>
              Privatlivspolitik
            </h1>
            <p className="mt-1 text-[13px] text-b-2">
              Sådan indsamler, bruger og beskytter ChainHub dine personoplysninger.
            </p>
          </div>

          <div className="space-y-8 px-8 py-8 text-[13px] leading-relaxed text-b-1">
            {/* § 1 Dataansvarlig */}
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 1 — Dataansvarlig</h2>
              <p className="text-b-2">
                Den dataansvarlige for behandlingen af dine personoplysninger er:
              </p>
              <div className="mt-3 rounded-[4px] border border-b-border bg-b-canvas px-4 py-3 text-[12px] text-b-2">
                <p className="font-semibold text-b-1">ChainHub</p>
                <p>CVR: [indsættes ved registrering]</p>
                <p>Danmark</p>
                <p className="mt-1">
                  E-mail:{' '}
                  <a
                    href="mailto:kontakt@chainhub.dk"
                    className="text-b-blue-fg no-underline hover:underline"
                  >
                    kontakt@chainhub.dk
                  </a>
                </p>
              </div>
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
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Kontooplysninger:</span> Navn,
                    e-mailadresse, stilling og organisation.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Brugsdata:</span> Loginhistorik,
                    IP-adresse, browsertype og sidevisninger til sikkerhed og fejlfinding.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Forretningsdata:</span> Kontrakter,
                    sager, opgaver og finansielle nøgletal, som du og din organisation registrerer i
                    systemet.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Personrelationer:</span> Navne, roller og
                    kontaktoplysninger på partnere, bestyrelsesmedlemmer og andre tilknyttede
                    personer, som du registrerer på vegne af din organisation.
                  </span>
                </li>
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
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    Levering og drift af ChainHub-platformen, herunder kontraktstyring, governance
                    og porteføljestyring.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    Autentificering og adgangsstyring (log ind, sessioner, rollebaserede
                    tilladelser).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    Udsendelse af systemnotifikationer og e-mail-digests om aktivitet, der er
                    relevant for din organisation.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    Fejlfinding, sikkerhedsovervågning og forbedring af systemets stabilitet.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    Opfyldelse af lovkrav og berettigede interesser i at beskytte platformen mod
                    misbrug.
                  </span>
                </li>
              </ul>
            </section>

            {/* § 4 Retsgrundlag */}
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 4 — Retsgrundlag</h2>
              <p className="text-b-2">
                Vi behandler dine oplysninger på følgende retsgrundlag i henhold til GDPR art. 6:
              </p>
              <ul className="mt-3 space-y-2 text-b-2">
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Art. 6 stk. 1 litra b</span>{' '}
                    (kontraktopfyldelse): Behandling, der er nødvendig for at levere den aftalte
                    service til din organisation.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Art. 6 stk. 1 litra f</span> (legitime
                    interesser): Sikkerhedslogning, svindelforebyggelse og driftsovervågning.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Art. 6 stk. 1 litra c</span> (retlig
                    forpligtelse): Behandling, der kræves for at overholde gældende lovgivning.
                  </span>
                </li>
              </ul>
            </section>

            {/* § 5 Opbevaring */}
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 5 — Opbevaringsperiode</h2>
              <p className="text-b-2">
                Vi opbevarer dine oplysninger, så længe din organisation er aktiv kunde hos
                ChainHub. Efter opsigelse af abonnementet slettes eller anonymiseres alle
                personoplysninger inden for 90 dage, medmindre vi er forpligtet til at opbevare dem
                længere af regnskabsmæssige eller retlige årsager (typisk op til 5 år efter
                bogføringsloven).
              </p>
              <p className="mt-2 text-b-2">
                Systemlogfiler (IP, sessiondata) opbevares i maksimalt 12 måneder.
              </p>
            </section>

            {/* § 6 Dine rettigheder */}
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 6 — Dine rettigheder</h2>
              <p className="text-b-2">
                Du har følgende rettigheder i henhold til GDPR, som du til enhver tid kan gøre
                gældende over for os:
              </p>
              <ul className="mt-3 space-y-2 text-b-2">
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Indsigt (art. 15):</span> Ret til at få
                    bekræftet, om vi behandler oplysninger om dig, og i givet fald hvilke.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Berigtigelse (art. 16):</span> Ret til at
                    få urigtige oplysninger rettet.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Sletning (art. 17):</span> Ret til at få
                    dine oplysninger slettet, hvor behandlingen ikke længere er nødvendig.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Begrænsning (art. 18):</span> Ret til at
                    anmode om begrænsning af behandlingen i visse tilfælde.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Dataportabilitet (art. 20):</span> Ret
                    til at modtage dine oplysninger i et struktureret, maskinlæsbart format.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">Indsigelse (art. 21):</span> Ret til at
                    gøre indsigelse mod behandling baseret på legitime interesser.
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-b-2">
                Send din anmodning til{' '}
                <a
                  href="mailto:kontakt@chainhub.dk"
                  className="text-b-blue-fg no-underline hover:underline"
                >
                  kontakt@chainhub.dk
                </a>
                . Vi svarer inden for 30 dage. Du kan også klage til{' '}
                <a
                  href="https://www.datatilsynet.dk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-b-blue-fg no-underline hover:underline"
                >
                  Datatilsynet
                </a>
                .
              </p>
            </section>

            {/* § 7 Cookies */}
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-b-1">
                § 7 — Cookies og sessioner
              </h2>
              <p className="text-b-2">
                ChainHub anvender udelukkende funktionelle cookies, der er nødvendige for at drive
                platformen:
              </p>
              <ul className="mt-3 space-y-2 text-b-2">
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">
                      Session-cookie (next-auth.session-token):
                    </span>{' '}
                    Opbevarer din login-session i op til 8 timer. Slettes ved log ud.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-b-3">—</span>
                  <span>
                    <span className="font-medium text-b-1">CSRF-token:</span> Sikkerhedstoken til
                    beskyttelse mod cross-site request forgery.
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-b-2">
                Vi anvender ikke markedsføringscookies, sporing på tværs af sider eller
                tredjeparts-annoncenetværk.
              </p>
            </section>

            {/* § 8 Databehandlere */}
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-b-1">
                § 8 — Databehandlere og tredjeparter
              </h2>
              <p className="text-b-2">
                Vi anvender følgende underleverandører (databehandlere) til at drive platformen.
                Alle behandler data på vores vegne og er underlagt databehandleraftaler:
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
                      <td className="px-4 py-2.5 text-b-2">PostgreSQL-database (EU-region)</td>
                      <td className="px-4 py-2.5 text-b-2">EU (Frankfurt)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-b-1">Vercel</td>
                      <td className="px-4 py-2.5 text-b-2">Hosting og serverless funktioner</td>
                      <td className="px-4 py-2.5 text-b-2">EU / USA</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-b-1">Sentry</td>
                      <td className="px-4 py-2.5 text-b-2">Fejlovervågning og crashrapportering</td>
                      <td className="px-4 py-2.5 text-b-2">EU</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-b-1">Resend</td>
                      <td className="px-4 py-2.5 text-b-2">
                        Transaktionelle e-mails og notifikationer
                      </td>
                      <td className="px-4 py-2.5 text-b-2">USA (SCCs)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-b-2">
                Overførsler til USA sker på grundlag af EU-Kommissionens
                standardkontraktbestemmelser (SCCs). Vi videregiver ikke dine oplysninger til
                tredjeparter med henblik på markedsføring.
              </p>
            </section>

            {/* § 9 Ændringer */}
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-b-1">
                § 9 — Ændringer i privatlivspolitikken
              </h2>
              <p className="text-b-2">
                Vi opdaterer løbende denne privatlivspolitik, når vores behandlingspraksis ændrer
                sig eller ved ny lovgivning. Væsentlige ændringer varsles via e-mail til din
                organisations primære kontakt mindst 14 dage før ikrafttrædelse. Datoen øverst på
                siden angiver seneste revision.
              </p>
            </section>

            {/* § 10 Kontakt */}
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-b-1">§ 10 — Kontakt</h2>
              <p className="text-b-2">
                Spørgsmål til behandlingen af dine personoplysninger kan rettes til:
              </p>
              <div className="mt-3 rounded-[4px] border border-b-border bg-b-canvas px-4 py-3 text-[12px] text-b-2">
                <p>
                  E-mail:{' '}
                  <a
                    href="mailto:kontakt@chainhub.dk"
                    className="text-b-blue-fg no-underline hover:underline"
                  >
                    kontakt@chainhub.dk
                  </a>
                </p>
                <p className="mt-1">
                  Datatilsynet:{' '}
                  <a
                    href="https://www.datatilsynet.dk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-b-blue-fg no-underline hover:underline"
                  >
                    www.datatilsynet.dk
                  </a>{' '}
                  · +45 33 19 32 00
                </p>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-b-border bg-b-panel-h px-8 py-4 text-[11px] text-b-2">
            <a href="/login" className="text-b-blue-fg no-underline hover:underline">
              ← Tilbage til log ind
            </a>
            <span>© 2026 ChainHub</span>
          </div>
        </div>
      </div>
    </div>
  )
}
