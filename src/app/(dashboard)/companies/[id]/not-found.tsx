import Link from 'next/link'

export default function CompanyNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-6xl font-bold text-gray-200">404</div>
      <h2 className="mb-2 text-xl font-semibold text-gray-900">
        Selskab ikke fundet
      </h2>
      <p className="mb-6 text-gray-500">
        Det selskab du leder efter eksisterer ikke eller er blevet slettet.
      </p>
      <Link
        href="/companies"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Gå til selskabsoversigt
      </Link>
    </div>
  )
}