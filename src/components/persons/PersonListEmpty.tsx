import Link from 'next/link'
import { Users, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PersonListEmptyProps {
  hasFilters?: boolean
}

export function PersonListEmpty({ hasFilters }: PersonListEmptyProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12">
        <Search className="h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          Ingen personer fundet
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Prøv at ændre dine søgekriterier
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12">
      <Users className="h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">
        Ingen personer endnu
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Kom i gang ved at oprette din første kontakt
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/persons/import">
          <Button variant="outline">Importér fra Outlook</Button>
        </Link>
        <Link href="/persons/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Opret person
          </Button>
        </Link>
      </div>
    </div>
  )
}