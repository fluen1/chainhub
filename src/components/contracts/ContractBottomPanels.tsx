import Link from 'next/link'
import { AddContractPartyTrigger } from '@/components/contracts/AddContractPartyTrigger'
import {
  BAddButton,
  Panel,
  PanelHeader,
  PanelFooter,
  PanelEmpty,
  Badge,
  type BadgeTone,
} from '@/components/ui/b'
import { formatDate } from '@/lib/labels'

// ────────────────────────────────────────────────────────────────────────────
// 3-kolonne bundsektion: Parter + Tilknytninger + Aktivitet
// ────────────────────────────────────────────────────────────────────────────

interface PartyRow {
  id: string
  name: string
  role: string
  sub: string
}

interface LinkItem {
  id: string
  title: string
  sub: string
  count: number
  critical: boolean
  href: string
}

interface ActivityRow {
  key: string
  who: string
  what: string
  when: Date
}

interface PersonOption {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

interface ContractBottomPanelsProps {
  contractId: string
  contractName: string
  partyRows: PartyRow[]
  links: LinkItem[]
  activityRows: ActivityRow[]
  persons: PersonOption[]
}

export function ContractBottomPanels({
  contractId,
  contractName,
  partyRows,
  links,
  activityRows,
  persons,
}: ContractBottomPanelsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
      {/* Parter */}
      <Panel>
        <PanelHeader title="Parter" meta={`${partyRows.length} parter`} />
        {partyRows.length === 0 ? (
          <PanelEmpty
            title="Ingen parter registreret endnu"
            hint="Tilføj parter for at signere og spore ansvar"
          />
        ) : (
          partyRows.map((p, i) => (
            <div
              key={p.id}
              className={`grid grid-cols-[1fr_auto_14px] items-center gap-2 px-3 py-1.5 ${
                i < partyRows.length - 1 ? 'border-b border-b-divider' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-b-1">{p.name}</div>
                <div className="mt-px text-[11px] text-b-2">{p.sub}</div>
              </div>
              <Badge tone="gray">{p.role}</Badge>
              <span className="text-b-3">›</span>
            </div>
          ))
        )}
        <PanelFooter>
          <div className="flex items-center justify-between">
            <span />
            <AddContractPartyTrigger
              contractId={contractId}
              contractName={contractName}
              persons={persons}
            />
          </div>
        </PanelFooter>
      </Panel>

      {/* Tilknytninger */}
      <Panel>
        <PanelHeader title="Tilknytninger" meta={`${links.length} elementer`} />
        {links.map((link, i) => (
          <Link
            key={link.id}
            href={link.href}
            className={`grid cursor-pointer grid-cols-[1fr_auto_14px] items-center gap-2 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
              i < links.length - 1 ? 'border-b border-b-divider' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="truncate text-b-1">{link.title}</div>
              <div className="mt-px text-[11px] text-b-2">{link.sub}</div>
            </div>
            <span
              className={`b-tnum rounded-[10px] px-1.5 py-px text-[11px] font-semibold ${
                link.critical && link.count > 0
                  ? 'bg-b-red-bg text-b-red-fg'
                  : 'bg-b-border text-b-gray-fg'
              }`}
            >
              {link.count}
            </span>
            <span className="text-b-3">›</span>
          </Link>
        ))}
        <PanelFooter>
          <div className="flex items-center justify-between">
            <span />
            <BAddButton href={`/tasks/new?contract=${contractId}`}>+ Tilknyt element</BAddButton>
          </div>
        </PanelFooter>
      </Panel>

      {/* Aktivitet */}
      <Panel>
        <PanelHeader title="Aktivitet" meta={`Seneste ${activityRows.length}`} />
        {activityRows.length === 0 ? (
          <PanelEmpty>Ingen aktivitet</PanelEmpty>
        ) : (
          activityRows.map((a, i) => (
            <div
              key={a.key}
              className={`flex items-start justify-between gap-3 px-3 py-1.5 ${
                i < activityRows.length - 1 ? 'border-b border-b-divider' : ''
              }`}
            >
              <div className="min-w-0 text-[12px] leading-snug text-b-1">
                <span className="font-medium">{a.who}</span> {a.what}
              </div>
              <span className="b-tnum shrink-0 text-[11px] text-b-3">{formatDate(a.when)}</span>
            </div>
          ))
        )}
        <PanelFooter>
          <span>
            Viser seneste {activityRows.length} begivenheder · versionshistorik vist separat ovenfor
          </span>
        </PanelFooter>
      </Panel>
    </div>
  )
}
