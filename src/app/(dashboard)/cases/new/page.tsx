import { CreateCaseForm } from '@/components/cases/CreateCaseForm'

export const metadata = {
  title: 'Opret sag — ChainHub',
}

export default function NewCasePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Opret ny sag</h1>
        <p className="mt-1 text-sm text-gray-500">
          Udfyld oplysningerne for den nye sag
        </p>
      </div>
      <CreateCaseForm />
    </div>
  )
}