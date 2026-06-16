import { PublicFooter } from '@/components/public/PublicFooter'
import { PublicHeader } from '@/components/public/PublicHeader'
import { auth } from '@/lib/auth'

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
