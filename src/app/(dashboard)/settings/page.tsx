import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Indstillinger</h1>
        <p className="mt-1 text-sm text-gray-500">Administrer din organisation</p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Organisation</h2>
        </div>
        <p className="text-sm text-gray-500">
          Indstillinger for din organisation kommer snart.
        </p>
      </div>
    </div>
  )
}
