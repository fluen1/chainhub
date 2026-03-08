import { Metadata } from 'next'
import { OutlookImport } from '@/components/persons/OutlookImport'

export const metadata: Metadata = {
  title: 'Importér fra Outlook | ChainHub',
  description: 'Importér kontakter fra din Outlook-konto',
}

export default function ImportPersonsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Importér fra Outlook</h1>
        <p className="mt-1 text-sm text-gray-500">
          Importér kontakter direkte fra din Microsoft 365 / Outlook-konto.
        </p>
      </div>

      <OutlookImport />
    </div>
  )
}