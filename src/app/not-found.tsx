import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Siden findes ikke' }

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-b-canvas px-4 py-16 text-center">
      <p
        className="text-[12px] font-semibold uppercase text-b-2"
        style={{ letterSpacing: '0.4px' }}
      >
        404
      </p>
      <h1 className="text-[20px] font-semibold text-b-1">Siden findes ikke</h1>
      <p className="max-w-md text-[13px] text-b-2">
        Den side, du leder efter, eksisterer ikke, er flyttet eller blev slettet. Tjek URL&apos;en,
        eller gå tilbage til dashboardet.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Link
          href="/dashboard"
          className="rounded-[4px] bg-b-blue-fg px-4 py-2 text-[13px] font-semibold text-white no-underline hover:bg-[#0860c7]"
        >
          Gå til dashboard
        </Link>
        <Link
          href="/search"
          className="rounded-[4px] border border-b-border-strong bg-white px-4 py-2 text-[13px] font-medium text-b-1 no-underline hover:bg-b-row-hover"
        >
          Søg i porteføljen
        </Link>
      </div>
    </main>
  )
}
