import Link from 'next/link'
import { getOnboardingStatus } from '@/actions/onboarding'
import { Panel, PanelHeader } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// OnboardingPanel — vis kun til nye orgs (< 14 dage) der ikke er færdige.
//
// Henter getOnboardingStatus() server-side og returnerer null ved shouldShow=false.
// 3 checklist-steps med visuel ✓/☐ og link til relevant CTA.
// ────────────────────────────────────────────────────────────────────────────

interface OnboardingStep {
  label: string
  done: boolean
  href: string
  hrefLabel: string
}

export async function OnboardingPanel() {
  const status = await getOnboardingStatus()

  if (!status.shouldShow) return null

  const steps: OnboardingStep[] = [
    {
      label: 'Opret dit første selskab',
      done: status.hasCompany,
      href: '/companies/new',
      hrefLabel: 'Opret selskab →',
    },
    {
      label: 'Tilføj en kontrakt',
      done: status.hasContract,
      href: '/contracts/new',
      hrefLabel: 'Opret kontrakt →',
    },
    {
      label: 'Inviter en kollega',
      done: status.hasAdditionalUser,
      href: '/settings?section=brugere',
      hrefLabel: 'Inviter kollega →',
    },
  ]

  return (
    <Panel>
      <PanelHeader
        title="Kom godt i gang med ChainHub"
        meta={`${status.completedCount} / ${status.totalCount} gennemført`}
      />
      <div>
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 border-b border-b-divider px-3 py-2 last:border-b-0"
          >
            <div className="flex items-center gap-2.5">
              {step.done ? (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-b-green-bg text-[12px] font-semibold text-b-green-fg"
                  aria-label="Gennemført"
                >
                  ✓
                </span>
              ) : (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-b-border-strong text-[12px] text-b-3"
                  aria-label="Ikke gennemført"
                >
                  ☐
                </span>
              )}
              <span
                className={`text-[13px] ${step.done ? 'text-b-3 line-through' : 'font-medium text-b-1'}`}
              >
                {step.label}
              </span>
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="shrink-0 text-[12px] font-medium text-b-blue-fg no-underline hover:underline"
              >
                {step.hrefLabel}
              </Link>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}
