import type { Metadata } from 'next'
import { BButton } from '@/components/ui/b'
import { auth } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'ChainHub — CRM og kontraktstyring for kæder',
  description:
    'Saml hele kædens selskaber, ejerskab, kontrakter og opgaver ét sted. Bygget til optiker-, fysio-, læge- og franchisekæder.',
}

const FEATURES = [
  {
    title: 'Hele koncernen ét sted',
    body: 'Selskaber, ejerskab og koncernstruktur samlet — fra holding til den enkelte butik.',
  },
  {
    title: 'Kontrakter under kontrol',
    body: 'Lejekontrakter, leverandøraftaler og fornyelser med automatiske påmindelser før deadline.',
  },
  {
    title: 'AI der læser for dig',
    body: 'Plus og Enterprise ekstraherer nøgledata fra kontrakter automatisk — mindre manuel indtastning.',
  },
]

export default async function ForsidePage() {
  const session = await auth()
  const loggedIn = !!session

  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-[34px] font-semibold leading-tight text-b-1">
          CRM og kontraktstyring bygget til kæder
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] text-b-2">
          ChainHub samler hele kædens selskaber, ejerskab, kontrakter og opgaver ét sted — til
          optiker-, fysio-, læge- og franchisekæder.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <BButton primary href="/kontakt" className="px-4 py-2 text-[14px]">
            Book demo
          </BButton>
          <BButton href="/pricing" className="px-4 py-2 text-[14px]">
            Se priser
          </BButton>
          {loggedIn && (
            <BButton href="/dashboard" className="px-4 py-2 text-[14px]">
              Gå til dashboard
            </BButton>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 px-4 pb-20 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-[6px] border border-b-border bg-white p-5">
            <h2 className="text-[15px] font-semibold text-b-1">{f.title}</h2>
            <p className="mt-2 text-[13px] text-b-2">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
