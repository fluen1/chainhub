// PageHeader — titel + meta + action-knapper, separator-linje under.
// Bruges på detail-sider (kontrakt, sag, person, opgave).
//
// Brug:
//   <PageHeader
//     title="Lejekontrakt erhverv"
//     statusBadge={<Badge tone="gray">Aktiv</Badge>}
//     meta={<>Tandlæge Østerbro · LEJEKONTRAKT · STANDARD</>}
//     actions={<><BButton>Rediger</BButton><BButton primary>Upload ▾</BButton></>}
//   />

export function PageHeader({
  title,
  statusBadge,
  meta,
  actions,
}: {
  title: React.ReactNode
  statusBadge?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-b-border pb-2.5">
      <div className="min-w-0">
        <h1
          className="flex items-center gap-2 text-[18px] font-semibold text-b-1"
          style={{ letterSpacing: '-0.01em' }}
        >
          <span>{title}</span>
          {statusBadge}
        </h1>
        {meta && <div className="b-tnum mt-1 text-[12px] text-b-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 gap-1.5">{actions}</div>}
    </header>
  )
}

// MetaSep — vertical-mid separator til at adskille meta-items.
// Renderes som "·" i border-strong farve med margin.
export function MetaSep() {
  return <span className="mx-2 text-b-border-strong">·</span>
}
