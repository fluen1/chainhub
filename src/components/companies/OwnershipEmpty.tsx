import { Users } from 'lucide-react'

interface OwnershipEmptyProps {
  onAdd: () => void
}

export function OwnershipEmpty({ onAdd }: OwnershipEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Users className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Ingen ejere registreret</h3>
      <p className="mb-4 text-sm text-gray-500">
        Tilføj ejere for at registrere selskabets ejerstruktur
      </p>
      <button
        onClick={onAdd}
        className="text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        Tilføj første ejer
      </button>
    </div>
  )
}