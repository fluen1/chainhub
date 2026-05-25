// LegalPageLayout — delt layout til statiske juridiske sider (vilkår + privatlivspolitik).
// Ingen auth påkrævet. Server component.

import { BrandMark } from './BrandMark'

interface LegalPageLayoutProps {
  title: string
  subtitle: string
  lastUpdated: string
  children: React.ReactNode
}

export function LegalPageLayout({ title, subtitle, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-b-canvas text-b-1">
      <div className="flex flex-1 flex-col items-center px-4 py-12">
        {/* Logo-header */}
        <div className="mb-8 flex w-full max-w-3xl items-center justify-between">
          <a
            href="/login"
            className="flex items-center gap-2 text-[13px] font-semibold text-b-1 no-underline"
          >
            <BrandMark withText />
          </a>
          <span className="text-[11px] text-b-3">Senest opdateret: {lastUpdated}</span>
        </div>

        {/* Indholdspanel */}
        <div className="w-full max-w-3xl rounded-[6px] border border-b-border bg-b-panel shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
          {/* Panelhoved */}
          <div className="border-b border-b-border bg-b-panel-h px-8 py-6">
            <h1 className="-tracking-[0.02em] text-[22px] font-semibold text-b-1">{title}</h1>
            <p className="mt-1 text-[13px] text-b-2">{subtitle}</p>
          </div>

          {/* Sektioner */}
          <div className="space-y-8 px-8 py-8 text-[13px] leading-relaxed text-b-1">{children}</div>

          {/* Sidefod */}
          <div className="flex items-center justify-between border-t border-b-border bg-b-panel-h px-8 py-4 text-[11px] text-b-2">
            <a href="/login" className="text-b-blue-fg no-underline hover:underline">
              ← Tilbage til log ind
            </a>
            <span>© {new Date().getFullYear()} ChainHub</span>
          </div>
        </div>
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
