'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createCheckoutSession, createPortalSession } from '@/actions/billing'
import { Panel, PanelHeader, PanelFooter, Badge, PageHeader } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// BillingClient — klient-komponent til abonnementsstyring
// ────────────────────────────────────────────────────────────────────────────

interface BillingClientProps {
  plan: string
  trialDaysLeft: number | null
  hasSubscription: boolean
  planExpiresAt: string | null
  starterPriceId: string
  professionalPriceId: string
}

export function BillingClient({
  plan,
  trialDaysLeft,
  hasSubscription,
  planExpiresAt,
  starterPriceId,
  professionalPriceId,
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

  const planLabel =
    plan === 'trial'
      ? 'Prøveperiode'
      : plan === 'starter'
        ? 'Starter'
        : plan === 'professional'
          ? 'Professional'
          : plan

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Abonnement"
        meta={trialDaysLeft !== null ? `${trialDaysLeft} dage tilbage af prøveperioden` : planLabel}
      />

      {/* Nuværende plan */}
      <Panel>
        <PanelHeader title="Nuværende plan" />
        <div className="grid grid-cols-[140px_1fr] items-center gap-3 px-3 py-2 border-b border-b-divider">
          <span className="text-[11px] uppercase text-b-2 tracking-[0.3px]">Plan</span>
          <span className="text-[13px] text-b-1">
            <Badge tone={plan === 'trial' ? 'amber' : 'blue'}>{planLabel}</Badge>
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
        {/* Starter */}
        <Panel>
          <PanelHeader title="Starter" meta="799 kr/md" />
          <div className="px-3 py-3">
            <ul className="space-y-1.5 text-[12px] text-b-2">
              <li>· Op til 10 lokationer</li>
              <li>· Kontrakter og sagsstyring</li>
              <li>· Dokumenthåndtering</li>
              <li>· E-mail-notifikationer</li>
              <li>· 3 brugere inkluderet</li>
            </ul>
          </div>
          <PanelFooter>
            {plan === 'starter' ? (
              <span className="text-[12px] text-b-green-fg font-medium">Nuværende plan</span>
            ) : (
              <button
                onClick={() => handleChoosePlan(starterPriceId)}
                disabled={!!loadingPrice || !starterPriceId}
                className="inline-flex items-center rounded-[4px] bg-b-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-b-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingPrice === starterPriceId ? 'Åbner betaling…' : 'Vælg Starter'}
              </button>
            )}
          </PanelFooter>
        </Panel>

        {/* Professional */}
        <Panel>
          <PanelHeader title="Professional" meta="1.999 kr/md" />
          <div className="px-3 py-3">
            <ul className="space-y-1.5 text-[12px] text-b-2">
              <li>· Ubegrænsede lokationer</li>
              <li>· Alt i Starter</li>
              <li>· AI-analyse og indsigter</li>
              <li>· Avancerede rapporter</li>
              <li>· Prioriteret support</li>
            </ul>
          </div>
          <PanelFooter>
            {plan === 'professional' ? (
              <span className="text-[12px] text-b-green-fg font-medium">Nuværende plan</span>
            ) : (
              <button
                onClick={() => handleChoosePlan(professionalPriceId)}
                disabled={!!loadingPrice || !professionalPriceId}
                className="inline-flex items-center rounded-[4px] bg-b-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-b-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingPrice === professionalPriceId ? 'Åbner betaling…' : 'Vælg Professional'}
              </button>
            )}
          </PanelFooter>
        </Panel>
      </div>

      {/* Enterprise */}
      <Panel>
        <PanelHeader title="Enterprise" meta="Tilpasset pris" />
        <div className="px-3 py-3">
          <p className="text-[13px] text-b-2">
            Til kæder med 50+ lokationer, særlige compliance-krav eller behov for on-premise drift.
            Vi tilpasser ChainHub til jeres infrastruktur og organisation.
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-b-3">
            <li>· SSO / SAML 2.0 integration</li>
            <li>· Dedikeret Customer Success Manager</li>
            <li>· SLA-garanti og prioriteret support</li>
            <li>· On-premise eller privat cloud</li>
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
    </div>
  )
}
