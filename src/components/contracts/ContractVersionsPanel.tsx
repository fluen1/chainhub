import Link from 'next/link'
import { UploadVersionTrigger } from '@/components/modals/b/UploadVersionTrigger'
import {
  Panel,
  PanelHeader,
  PanelFooter,
  PanelEmpty,
  Badge,
  type BadgeTone,
} from '@/components/ui/b'
import { getChangeTypeLabel, formatDate } from '@/lib/labels'

// ────────────────────────────────────────────────────────────────────────────
// Versionshistorik-panel for kontraktdetalje-siden
// ────────────────────────────────────────────────────────────────────────────

function changeTypeTone(ct: string): BadgeTone {
  switch (ct) {
    case 'NY_VERSION':
      return 'blue'
    case 'REDAKTIONEL':
      return 'gray'
    case 'MATERIEL':
      return 'amber'
    case 'ALLONGE':
      return 'gray'
    default:
      return 'gray'
  }
}

interface ContractVersion {
  id: string
  version_number: number
  uploaded_at: Date
  uploaded_by: string
  change_type: string
  file_url: string
}

interface ContractVersionsPanelProps {
  contractId: string
  contractName: string
  companyId: string
  companyName: string
  versions: ContractVersion[]
  uploaderMap: Map<string, string>
}

export function ContractVersionsPanel({
  contractId,
  contractName,
  companyId,
  companyName,
  versions,
  uploaderMap,
}: ContractVersionsPanelProps) {
  const currentVersion = versions[0]

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            Versionshistorik
            <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
              {versions.length}
            </span>
          </span>
        }
        meta={currentVersion ? `v${currentVersion.version_number} er aktuel · sortér: nyeste` : ''}
      />
      {versions.length === 0 ? (
        <PanelEmpty>Ingen versioner uploadet endnu</PanelEmpty>
      ) : (
        <>
          <div
            className="grid items-center gap-2.5 border-b border-b-border bg-b-panel-h px-3 py-1.5 text-[10px] font-semibold uppercase text-b-3"
            style={{
              gridTemplateColumns: '36px 110px 72px 1fr 60px',
              letterSpacing: '0.5px',
            }}
          >
            <span>Ver.</span>
            <span>Dato</span>
            <span>Af</span>
            <span>Type</span>
            <span>Dokument</span>
          </div>
          {versions.map((v, idx) => (
            <div
              key={v.id}
              className="grid cursor-pointer items-center gap-2.5 border-b border-b-divider px-3 py-1.5 text-[13px] last:border-b-0 hover:bg-b-row-hover"
              style={{ gridTemplateColumns: '36px 110px 72px 1fr 60px' }}
            >
              <span
                className={`b-tnum font-semibold ${idx === versions.length - 1 ? 'text-b-3' : 'text-b-1'}`}
              >
                v{v.version_number}
              </span>
              <span className="b-tnum text-b-2">{formatDate(v.uploaded_at)}</span>
              <span className="text-b-2">{uploaderMap.get(v.uploaded_by) ?? 'Ukendt'}</span>
              <span>
                <Badge tone={changeTypeTone(v.change_type)}>
                  {getChangeTypeLabel(v.change_type).toUpperCase()}
                </Badge>
              </span>
              <span>
                <Link
                  href={v.file_url}
                  className="text-[11px] text-b-blue-fg no-underline hover:underline"
                >
                  ↓ Hent
                </Link>
              </span>
            </div>
          ))}
        </>
      )}
      <PanelFooter>
        <div className="flex items-center justify-between">
          <span>
            {versions.length} version{versions.length === 1 ? '' : 'er'}
            {versions.length > 0 ? ' · v1 er original' : ''}
          </span>
          <UploadVersionTrigger
            contractId={contractId}
            contractName={contractName}
            companyId={companyId}
            companyName={companyName}
            currentVersion={currentVersion?.version_number ?? null}
            variant="add"
          />
        </div>
      </PanelFooter>
    </Panel>
  )
}
