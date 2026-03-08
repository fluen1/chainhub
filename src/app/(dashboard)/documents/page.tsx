import { FolderOpen, Upload } from 'lucide-react'

export default function DocumentsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dokumenter</h1>
          <p className="mt-1 text-sm text-gray-500">
            Alle dokumenter på tværs af dine selskaber
          </p>
        </div>
        <a
          href="/dashboard/documents/upload"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          Upload dokument
        </a>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4">
            <FolderOpen className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Ingen dokumenter endnu</h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Upload dit første dokument for at komme i gang
          </p>
          <a
            href="/dashboard/documents/upload"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            Upload dokument
          </a>
        </div>
      </div>
    </div>
  )
}