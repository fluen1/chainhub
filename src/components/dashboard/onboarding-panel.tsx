import Link from 'next/link'
import { Building2, FileText, UserPlus, CheckCircle2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OnboardingStatus } from '@/actions/onboarding'

interface Props {
  status: OnboardingStatus
}

interface Step {
  key: 'company' | 'contract' | 'user'
  title: string
  description: string
  href: string
  disabledReason?: string
  icon: typeof Building2
  done: boolean
  disabled?: boolean
}

/**
 * "Kom godt i gang"-panel på dashboard (DEC-F0-013).
 *
 * Vises øverst på dashboard for nye organisations (<14 dage gamle) indtil
 * alle 3 onboarding-steps er gennemført. Bagefter returnerer komponenten
 * null så eksisterende layout er uændret.
 */
export function OnboardingPanel({ status }: Props) {
  if (!status.shouldShow) return null

  const steps: Step[] = [
    {
      key: 'company',
      title: 'Opret dit første selskab',
      description: 'Tilføj et lokationsselskab for at komme i gang.',
      href: '/companies/new',
      icon: Building2,
      done: status.hasCompany,
    },
    {
      key: 'contract',
      title: 'Tilføj din første kontrakt',
      description: 'Upload eller opret en kontrakt knyttet til et selskab.',
      href: '/contracts/new',
      icon: FileText,
      done: status.hasContract,
      disabled: !status.hasCompany,
      disabledReason: 'Opret først et selskab',
    },
    {
      key: 'user',
      title: 'Invitér en kollega',
      description: 'Giv andre fra kædegruppen adgang til systemet.',
      // Ingen /settings/users-rute endnu — vi linker til /settings indtil
      // brugeradmin-siden eksisterer.
      href: '/settings',
      icon: UserPlus,
      done: status.hasAdditionalUser,
    },
  ]

  return (
    <section
      className="mb-5 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm"
      aria-labelledby="onboarding-heading"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="onboarding-heading" className="text-lg font-semibold text-gray-900">
            Kom godt i gang med ChainHub
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Få dit første setup på plads — tre hurtige skridt til et komplet overblik.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
          {status.completedCount} af {status.totalCount} færdige
        </span>
      </div>

      <ul className="space-y-2">
        {steps.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </ul>
    </section>
  )
}

function StepRow({ step }: { step: Step }) {
  const Icon = step.icon
  const isActionable = !step.done && !step.disabled

  const body = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
        step.done
          ? 'border-emerald-200 bg-emerald-50/50'
          : step.disabled
            ? 'border-gray-200 bg-white opacity-60'
            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
        )}
      >
        {step.done ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        ) : (
          <Icon className="h-5 w-5" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-sm font-medium',
            step.done ? 'text-gray-500 line-through' : 'text-gray-900'
          )}
        >
          {step.title}
        </div>
        <div className="mt-0.5 text-xs text-gray-500">
          {step.disabled && step.disabledReason ? step.disabledReason : step.description}
        </div>
      </div>
      {isActionable && <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />}
      {step.done && <span className="shrink-0 text-xs font-medium text-emerald-700">Færdig</span>}
    </div>
  )

  if (isActionable) {
    return (
      <li>
        <Link href={step.href} className="block no-underline">
          {body}
        </Link>
      </li>
    )
  }
  return <li>{body}</li>
}
