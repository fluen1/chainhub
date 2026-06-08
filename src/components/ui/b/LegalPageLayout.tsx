// LegalPageLayout — titlet indholdspanel til statiske juridiske sider.
// Lever under (public)/ og arver PublicHeader/PublicFooter — har derfor ingen egen chrome.

interface LegalPageLayoutProps {
  title: string
  subtitle: string
  lastUpdated: string
  children: React.ReactNode
}

export function LegalPageLayout({ title, subtitle, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-12">
      <div className="mb-3 flex justify-end">
        <span className="text-[11px] text-b-3">Senest opdateret: {lastUpdated}</span>
      </div>
      <div className="w-full rounded-[6px] border border-b-border bg-b-panel shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
        <div className="border-b border-b-border bg-b-panel-h px-8 py-6">
          <h1 className="-tracking-[0.02em] text-[22px] font-semibold text-b-1">{title}</h1>
          <p className="mt-1 text-[13px] text-b-2">{subtitle}</p>
        </div>
        <div className="space-y-8 px-8 py-8 text-[13px] leading-relaxed text-b-1">{children}</div>
      </div>
    </div>
  )
}

// ─── Delte indholdsmønstre ───────────────────────────────────────────────────

/** Standardiseret listeelement med em-dash-indikator */
export function LegalListItem({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 text-b-3">—</span>
      <span>
        {label && <span className="font-medium text-b-1">{label} </span>}
        {children}
      </span>
    </li>
  )
}

/** Kontaktboks / adresseboks med ramme */
export function LegalContactBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-[4px] border border-b-border bg-b-canvas px-4 py-3 text-[12px] text-b-2">
      {children}
    </div>
  )
}

/** E-mail-link */
export function LegalMailLink({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} className="text-b-blue-fg no-underline hover:underline">
      {address}
    </a>
  )
}

/** Eksternt link */
export function LegalExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-b-blue-fg no-underline hover:underline"
    >
      {children}
    </a>
  )
}
