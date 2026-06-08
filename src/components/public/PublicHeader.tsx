import Link from 'next/link'
import { BButton, BrandMark } from '@/components/ui/b'

export function PublicHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="border-b border-b-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-b-1 no-underline">
          <BrandMark />
          <span className="text-[15px] font-semibold">ChainHub</span>
        </Link>
        <nav className="flex items-center gap-4 text-[13px]">
          <Link href="/pricing" className="text-b-2 no-underline hover:text-b-1">
            Priser
          </Link>
          <Link href="/kontakt" className="text-b-2 no-underline hover:text-b-1">
            Kontakt
          </Link>
          <Link href="/docs" className="text-b-2 no-underline hover:text-b-1">
            Docs
          </Link>
          {loggedIn ? (
            <BButton primary href="/dashboard">
              Gå til dashboard
            </BButton>
          ) : (
            <BButton primary href="/login">
              Log ind
            </BButton>
          )}
        </nav>
      </div>
    </header>
  )
}
