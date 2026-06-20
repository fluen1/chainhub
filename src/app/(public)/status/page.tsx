import type { Metadata } from 'next'
import { getSystemStatus, type ComponentStatus } from '@/lib/status'

export const metadata: Metadata = {
  title: 'Systemstatus — ChainHub',
  description: 'Live driftsstatus for ChainHub-platformen.',
}

// Live DB-tjek — må aldrig caches.
export const dynamic = 'force-dynamic'

const STATUS_META: Record<ComponentStatus, { label: string; dot: string; text: string }> = {
  operational: { label: 'Oppe', dot: 'bg-b-green-fg', text: 'text-b-green-fg' },
  degraded: { label: 'Nedsat', dot: 'bg-b-amber-fg', text: 'text-b-amber-fg' },
  down: { label: 'Nede', dot: 'bg-b-red-fg', text: 'text-b-red-fg' },
}

const OVERALL_HEADLINE: Record<ComponentStatus, string> = {
  operational: 'Alle systemer kører',
  degraded: 'Nedsat drift',
  down: 'Driftsforstyrrelse',
}

function StatusDot({ status }: { status: ComponentStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${STATUS_META[status].dot}`} />
      <span className={`text-[13px] font-medium ${STATUS_META[status].text}`}>
        {STATUS_META[status].label}
      </span>
    </span>
  )
}

export default async function StatusPage() {
  const status = await getSystemStatus()
  const checkedAt = new Date(status.checkedAt).toLocaleString('da-DK', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Copenhagen',
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-[24px] font-semibold text-b-1">Systemstatus</h1>

      <div
        role="status"
        className="mt-6 flex items-center justify-between rounded-[8px] border border-b-border bg-white p-5"
      >
        <span className="text-[16px] font-medium text-b-1">{OVERALL_HEADLINE[status.overall]}</span>
        <StatusDot status={status.overall} />
      </div>

      <ul className="mt-6 divide-y divide-b-border rounded-[8px] border border-b-border bg-white">
        {status.components.map((c) => (
          <li key={c.name} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-[14px] text-b-1">{c.name}</span>
            <StatusDot status={c.status} />
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[12px] text-b-3">Sidst tjekket: {checkedAt}.</p>
      <p className="mt-2 text-[12px] text-b-3">
        Oplever du problemer der ikke fremgår her? Skriv til{' '}
        <a href="mailto:kontakt@chainhub.dk" className="text-b-blue-fg underline">
          kontakt@chainhub.dk
        </a>
        .
      </p>
    </div>
  )
}
