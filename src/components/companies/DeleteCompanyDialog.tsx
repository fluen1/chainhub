'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import { deleteCompany } from '@/actions/companies'
import type { CompanyWithRelations } from '@/types/company'

interface DeleteCompanyDialogProps {
  company: CompanyWithRelations
  onClose: () => void
}

export function DeleteCompanyDialog({ company, onClose }: DeleteCompanyDialogProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmName, setConfirmName] = useState('')

  const isConfirmed = confirmName.trim().toLowerCase() === company.name.toLowerCase()

  const handleDelete = async () => {
    if (!isConfirmed) return

    setIsDeleting(true)
    const result = await deleteCompany({ companyId: company.id })
    setIsDeleting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Selskab slettet')
    router.push('/companies')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Slet selskab</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="mb-4 text-sm text-gray-600">
            Du er ved at slette <span className="font-semibold">{company.name}</span>. Denne handling
            kan ikke fortrydes. Alle tilknyttede data bevares men selskabet vil ikke længere være
            synligt.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Bekræft ved at skrive selskabets navn:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={company.name}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuller
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            {isDeleting ? 'Sletter...' : 'Slet selskab'}
          </button>
        </div>
      </div>
    </div>
  )
}