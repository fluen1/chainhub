import { Metadata } from 'next'
import { PersonForm } from '@/components/persons/PersonForm'

export const metadata: Metadata = {
  title: 'Opret person | ChainHub',
  description: 'Opret en ny person i kontaktbogen',
}

export default function NewPersonPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Opret person</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tilføj en ny person til din kontaktbog. Personen kan efterfølgende tilknyttes
          selskaber med forskellige roller.
        </p>
      </div>

      <PersonForm />
    </div>
  )
}