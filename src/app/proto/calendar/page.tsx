'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/proto/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage til dashboard
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <div className="text-4xl mb-4">📅</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Fuld kalender</h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
          Her kommer den fulde kalendervisning med dag/uge/måned,
          filtrering på event-typer, og mulighed for at oprette nye events.
        </p>
        <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600">
          Kommer i næste sprint
        </div>
      </div>
    </div>
  )
}
