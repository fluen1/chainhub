import Link from 'next/link'

export function PublicFooter() {
  return (
    <footer className="border-t border-b-border bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-[12px] text-b-3 sm:flex-row">
        <span>© ChainHub</span>
        <nav className="flex gap-4">
          <Link href="/pricing" className="text-b-2 no-underline hover:text-b-1">
            Priser
          </Link>
          <Link href="/kontakt" className="text-b-2 no-underline hover:text-b-1">
            Kontakt
          </Link>
          <Link href="/login" className="text-b-2 no-underline hover:text-b-1">
            Log ind
          </Link>
          <Link href="/legal/vilkaar" className="text-b-2 no-underline hover:text-b-1">
            Vilkår
          </Link>
          <Link href="/legal/privatliv" className="text-b-2 no-underline hover:text-b-1">
            Privatliv
          </Link>
          <Link href="/legal/cookies" className="text-b-2 no-underline hover:text-b-1">
            Cookies
          </Link>
          <Link href="/legal/databehandleraftale" className="text-b-2 no-underline hover:text-b-1">
            Databehandleraftale
          </Link>
        </nav>
      </div>
    </footer>
  )
}
