'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

export function CreateCompanyButton() {
  return (
    <Link
      href="/companies/new"
      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <Plus className="h-4 w-4" />
      Opret selskab
    </Link>
  )
}