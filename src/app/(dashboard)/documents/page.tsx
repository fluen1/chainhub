import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { FolderOpen, Download } from 'lucide-react'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'
import { FileUpload } from '@/components/documents/FileUpload'

const PAGE_SIZE = 20

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPG',
  'image/gif': 'GIF',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
}

function getMimeLabel(mimeType: string): string {
  return MIME_LABELS[mimeType] ?? mimeType.split('/').pop()?.toUpperCase() ?? mimeType
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface DocumentsPageProps {
  searchParams: {
    q?: string
    company?: string
    page?: string
  }
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page, skip, take } = parsePaginationParams(searchParams.page, PAGE_SIZE)
  const q = searchParams.q?.trim() ?? ''
  const companyFilter = searchParams.company

  // Hent accessible companies til filter-dropdown
  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  const companyOptions = companyIds.length > 0
    ? (await prisma.company.findMany({
        where: {
          id: { in: companyIds },
          organization_id: session.user.organizationId,
          deleted_at: null,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })).map((c) => ({ value: c.id, label: c.name }))
    : []

  const where = {
    organization_id: session.user.organizationId,
    deleted_at: null as null,
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    ...(companyFilter ? { company_id: companyFilter } : {}),
  }

  const [documents, totalCount] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        company: { select: { name: true } },
      },
      orderBy: { uploaded_at: 'desc' },
      skip,
      take,
    }),
    prisma.document.count({ where }),
  ])

  const hasFilters = !!(q || companyFilter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dokumenter</h1>
        <p className="mt-1 text-sm text-gray-500">
          {totalCount} dokument{totalCount !== 1 ? 'er' : ''} på tværs af selskaber
        </p>
      </div>

      <FileUpload />

      <Suspense fallback={null}>
        <SearchAndFilter
          placeholder="Søg på dokumenttitel..."
          filters={[
            { key: 'company', label: 'Selskab', options: companyOptions },
          ]}
        />
      </Suspense>

      {documents.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
          {hasFilters ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen dokumenter matcher søgningen</h3>
              <p className="mt-1 text-sm text-gray-500">Prøv at ændre filtrene.</p>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen dokumenter endnu</h3>
              <p className="mt-1 text-sm text-gray-500">Upload det første dokument for et selskab.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Titel</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Selskab</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Størrelse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Uploadet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <span className="sr-only">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {doc.title}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{doc.company?.name || '—'}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {getMimeLabel(doc.file_type)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatFileSize(doc.file_size_bytes)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(doc.uploaded_at).toLocaleDateString('da-DK')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <a
                        href={doc.file_url}
                        download={doc.file_name}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Suspense fallback={null}>
            <Pagination currentPage={page} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </Suspense>
        </>
      )}
    </div>
  )
}
