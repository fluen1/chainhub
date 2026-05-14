// PageTopbar — sidens topbar med titel og højre-justeret meta.
// Renderes ØVERST på siden (under sidebar), ikke som global header.
//
// Brug:
//   <PageTopbar title="Min portefølje · Onsdag 14. maj 2026" meta="Sidst opdateret 14:32" />

export function PageTopbar({ title, meta }: { title: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="-mx-6 flex items-center justify-between border-b border-b-border-strong bg-b-canvas px-6 pb-3 pt-1">
      <h1 className="text-[14px] font-semibold text-b-1">{title}</h1>
      {meta && <span className="b-tnum text-[12px] text-b-2">{meta}</span>}
    </div>
  )
}
