'use client'
import { Settings } from 'lucide-react'

export default function PrototypeSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Indstillinger</h1>
      <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
        <Settings className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm text-gray-500">Indstillinger er ikke en del af prototypen.</p>
      </div>
    </div>
  )
}
