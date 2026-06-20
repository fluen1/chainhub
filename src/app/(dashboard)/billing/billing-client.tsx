'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createCheckoutSession, createPortalSession } from '@/actions/billing'
import { Panel, PanelHeader, PanelFooter, Badge, PageHeader } from '@/components/ui/b'
import { planLabel } from '@/lib/labels'

// ────────────────────────────────────────────────────────────────────────────
// BillingClient — klient-komponent til abonnementsstyring
// ────────────────────────────────────────────────────────────────────────────

interface BillingClientProps {
  plan: string
  trialDaysLeft: number | null
  hasSubscription: boolean
  planExpiresAt: string | null
  basisPriceId: string
  plusPriceId: string
  checkoutSuccess?: boolean
  checkoutCanceled?: boolean
}

export function BillingClient({
  plan,
  trialDaysLeft,
  hasSubscription,
  planExpiresAt,
  basisPriceId,
  plusPriceId,
  checkoutSuccess,
  checkoutCanceled,
}: BillingClientProps) {
  const [loadingPrice, setLoadingPrice] = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)

  async function handleChoosePlan(priceId: string) {
    setLoadingPrice(priceId)
    try {
      const result = await createCheckoutSession(priceId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data?.url) window.location.href = result.data.url
    } finally {
      setLoadingPrice(null)
    }
  }

  async function handleManageSubscription() {
    setLoadingPortal(true)
    try {
      const result = await createPortalSession()
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data?.url) window.location.href = result.data.url
    } finally {
      setLoadingPortal(false)
    }
  }

  const planLabelText = planLabel(plan)

  return (
    <div className="flex flex-col gap-3">
      {checkoutSuccess && (
        <div className="rounded-[4px] border border-b-green-border bg-b-green-bg px-3 py-2.5 text-[13px] text-b-green-fg">
          <strong>Betaling gennemført!</strong> Dit abonnement er nu aktivt. Det kan tage et øjeblik
          at opdatere.
        </div>
      )}
      {checkoutCanceled && (
        <div className="rounded-[4px] border border-b-amber-border bg-b-amber-bg px-3 py-2.5 text-[13px] text-b-amber-fg">
          Betalingen blev annulleret. Du kan prøve igen når du er klar.
        </div>
      )}

      <PageHeader
        title="Abonnement"
        meta={
          trialDaysLeft !== null ? `${trialDaysLeft} dage tilbage af prøveperioden` : planLabelText
        }
      />

      {/* Nuværende plan */}
      <Panel>
        <PanelHeader title="Nuværende plan" />
        <div className="grid grid-cols-[140px_1fr] items-center gap-3 px-3 py-2 border-b border-b-divider">
          <span className="text-[11px] uppercase text-b-2 tracking-[0.3px]">Plan</span>
          <span className="text-[13px] text-b-1">
            <Badge tone={plan === 'trial' ? 'amber' : 'blue'}>{planLabelText}</Badge>
          </span>
        </div>
        {trialDaysLeft !== null && (
          <div className="grid grid-cols-[140px_1fr] items-center gap-3 px-3 py-2 border-b border-b-divider">
            <span className="text-[11px] uppercase text-b-2 tracking-[0.3px]">Prøveperiode</span>
            <span className="text-[13px] text-b-1">
              {trialDaysLeft === 0 ? (
                <span className="text-b-red-fg">Udløbet</span>
              ) : (
                <span>
                  {trialDaysLeft} {trialDaysLeft === 1 ? 'dag' : 'dage'} tilbage
                </span>
              )}
            </span>
          </div>
        )}
        {planExpiresAt && (
          <div className="grid grid-cols-[140px_1fr] items-center gap-3 px-3 py-2">
            <span className="text-[11px] uppercase text-b-2 tracking-[0.3px]">Fornyelse</span>
            <span className="text-[13px] text-b-2">{planExpiresAt} · automatisk</span>
          </div>
        )}
        {hasSubscription && (
          <PanelFooter>
            <button
              onClick={handleManageSubscription}
              disabled={loadingPortal}
              className="text-[12px] text-b-blue-fg hover:underline disabled:opacity-50"
            >
              {loadingPortal ? 'Åbner portal…' : 'Administrér abonnement →'}
            </button>
          </PanelFooter>
        )}
      </Panel>

      {/* Plan-kort */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Basis */}
        <Panel>
          <PanelHeader title="Basis" meta="3.500 kr/md" />
          <div className="px-3 py-3">
            <ul className="space-y-1.5 text-[12px] text-b-2">
              <li>· 5–15 lokationer</li>
              <li>· Kontrakt-, sags- og opgavestyring</li>
              <li>· Governance og personrelationer</li>
              <li>· Dokumenthåndtering og eksport</li>
              <li>· E-mail-notifikationer</li>
            </ul>
          </div>
          <PanelFooter>
            {plan === 'basis' ? (
              <span className="text-[12px] text-b-green-fg font-medium">Nuværende plan</span>
            ) : (
              <button
                onClick={() => handleChoosePlan(basisPriceId)}
                disabled={!!loadingPrice || !basisPriceId}
                className="inline-flex items-center rounded-[4px] bg-b-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-b-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingPrice === basisPriceId ? 'Åbner betaling…' : 'Vælg Basis'}
              </button>
            )}
          </PanelFooter>
        </Panel>

        {/* Plus */}
        <Panel>
          <PanelHeader title="Plus" meta="9.500 kr/md" />
          <div className="px-3 py-3">
            <ul className="space-y-1.5 text-[12px] text-b-2">
              <li>· 15–50 lokationer</li>
              <li>· Alt i Basis</li>
              <li>· AI-kontraktudlæsning (50 inkl./md)</li>
              <li>· AI-indsigter og portefølje-analyse</li>
              <li>· 75 kr./ekstra udlæsning derover</li>
            </ul>
          </div>
          <PanelFooter>
            {plan === 'plus' ? (
              <span className="text-[12px] text-b-green-fg font-medium">Nuværende plan</span>
            ) : (
              <button
                onClick={() => handleChoosePlan(plusPriceId)}
                disabled={!!loadingPrice || !plusPriceId}
                className="inline-flex items-center rounded-[4px] bg-b-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-b-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingPrice === plusPriceId ? 'Åbner betaling…' : 'Vælg Plus'}
              </button>
            )}
          </PanelFooter>
        </Panel>
      </div>

      {/* Enterprise */}
      <Panel>
        <PanelHeader title="Enterprise" meta="Fra 32.000 kr/md" />
        <div className="px-3 py-3">
          <p className="text-[13px] text-b-2">
            Til kæder med 50+ lokationer, særlige compliance-krav eller behov for on-premise drift.
            Vi tilpasser ChainHub til jeres infrastruktur og organisation.
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-b-3">
            <li>· Portefølje-AI og Søg &amp; Spørg (RAG)</li>
            <li>· Fair-use 500 udlæsninger/md</li>
            <li>· SLA-garanti og prioriteret support</li>
            <li>· SSO / SAML 2.0 og on-premise-mulighed</li>
          </ul>
        </div>
        <PanelFooter>
          <a
            href="mailto:sales@chainhub.dk?subject=Enterprise-forespørgsel"
            className="inline-flex items-center rounded-[4px] bg-b-panel border border-b-border px-3 py-1.5 text-[12px] font-medium text-b-1 hover:bg-b-border/50 transition-colors no-underline"
          >
            Kontakt os
          </a>
        </PanelFooter>
      </Panel>

      {/* Onboarding-fee — gælder alle betalte tiers */}
      <p className="px-1 text-[11px] text-b-3">
        Ved opstart faktureres et engangs-onboarding-gebyr for data-migrationssetup: 1 kr. pr.
        importeret dokument, maks. 2.500 kr. Alle priser er ekskl. moms.
      </p>
    </div>
  )
}
