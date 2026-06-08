import type { Metadata } from 'next'
import { BButton } from '@/components/ui/b'
import { PRICING_TIERS, ONBOARDING_FEE } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Priser — ChainHub',
  description: 'Basis, Plus og Enterprise. Gennemsigtige priser for kæder.',
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-[28px] font-semibold text-b-1">Priser</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-[14px] text-b-2">
        Vælg den plan der passer kæden. Alle planer faktureres månedligt. Salg sker via demo — ingen
        self-service.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.id}
            className="flex flex-col rounded-[8px] border border-b-border bg-white p-6"
          >
            <h2 className="text-[18px] font-semibold text-b-1">{tier.name}</h2>
            <p className="mt-1 text-[13px] text-b-2">{tier.tagline}</p>
            <div className="mt-4">
              <span className="text-[24px] font-semibold text-b-1">{tier.price}</span>
              <span className="ml-1 text-[12px] text-b-3">{tier.priceNote}</span>
            </div>
            <ul className="mt-4 flex flex-1 flex-col gap-2 text-[13px] text-b-1">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-b-green-fg">
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <BButton primary href="/kontakt" className="w-full px-3 py-2 text-[13px]">
                {tier.cta}
              </BButton>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-[12px] text-b-3">{ONBOARDING_FEE.label}</p>
    </div>
  )
}
