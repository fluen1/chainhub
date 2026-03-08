'use client'

import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PersonListHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Persondatabase</h1>
        <p className="mt-1 text-sm text-gray-500">
          Global kontaktbog med personer og deres roller på tværs af selskaber
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/persons/import">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Importér fra Outlook
          </Button>
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