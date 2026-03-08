'use client'

import { AlertTriangle } from 'lucide-react'

export function StorageNotConfiguredBanner() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <h3 className="font-medium text-amber-800">
            Fil-upload er ikke konfigureret (mock-tilstand)
          </h3>
          <p className="mt-1 text-sm text-amber-700">
            Cloudflare R2 storage er ikke konfigureret. Du kan se grænsefladen, men
            uploads er ikke mulige. Konfigurér følgende miljøvariabler for at aktivere
            fil-upload:
          </p>
          <ul className="mt-2 space-y-1 text-sm font-mono text-amber-800">
            <li>• R2_BUCKET_NAME</li>
            <li>• R2_ACCOUNT_ID</li>
            <li>• R2_ACCESS_KEY_ID</li>
            <li>• R2_SECRET_ACCESS_KEY</li>
          </ul>
          <p className="mt-2 text-sm text-amber-700">
            Se <span className="font-medium">.env.example</span> for detaljer om
            opsætning af Cloudflare R2.
          </p>
        </div>
      </div>
    </div>
  )
}