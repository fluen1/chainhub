import { auth } from '@/lib/auth'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <div className="flex min-h-screen flex-col bg-b-canvas">
      <PublicHeader loggedIn={!!session} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}
