'use client'

import { X, Download, Eye } from 'lucide-react'

interface ExportPreviewModalProps {
  open: boolean
  onClose: () => void
  entity: string
  entityLabel: string
  columns: string[]
  rows: Array<Record<string, string | number | null>>
  downloadUrl: string
}

export function ExportPreviewModal({
  open,
  onClose,
  entity: _entity,
  entityLabel,
  columns,
  rows,
  downloadUrl,
}: ExportPreviewModalProps) {
  if (!open) return null

  const previewRows = rows.slice(0, 20)
  const hasMore = rows.length > 20

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview af ${entityLabel}-export`}
        className="relative z-10 w-full max-w-4xl max-h-[80vh] rounded-lg border border-zinc-200 bg-white shadow-lg flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-zinc-400" />
            <h2 className="text-base font-semibold text-zinc-900">
              Preview — {entityLabel} ({rows.length} rækker)
            </h2>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-zinc-100" aria-label="Luk">
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-1.5 text-left text-xs font-medium text-zinc-500 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-50">
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-1.5 text-zinc-700 max-w-[200px] truncate">
                      {row[col] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <p className="mt-2 text-xs text-zinc-400">
              Viser {previewRows.length} af {rows.length} rækker
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Luk
          </button>
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </a>
        </div>
      </div>
    </div>
  )
}
