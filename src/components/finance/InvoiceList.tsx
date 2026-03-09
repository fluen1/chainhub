'use client'

import { useState, useTransition } from 'react'
import type { InvoiceWithCompany, InvoiceSummary } from '@/types/finance'
import { INVOICE_STATUS_LABELS } from '@/types/finance'
import { updateInvoice, deleteInvoice } from '@/actions/finance'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InvoiceListProps {
  invoices: InvoiceWithCompany[]
  summary: InvoiceSummary
  onAddNew?: () => void
  className?: string
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

const STATUS_COLORS = {
  UDSTEDT: 'bg-blue-100 text-blue-800',
  BETALT: 'bg-green-100 text-green-800',
  FORFALDEN: 'bg-red-100 text-red-800',
  KREDITERET: 'bg-gray-100 text-gray-700',
} as const

export function InvoiceList({ invoices, summary, onAddNew, className }: InvoiceListProps) {
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<string>('alle')

  const filtered =
    statusFilter === 'alle' ? invoices : invoices.filter((inv) => inv.status === statusFilter)

  function handleMarkAsPaid(invoice: InvoiceWithCompany) {
    startTransition(async () => {
      const result = await updateInvoice({
        invoiceId: invoice.id,
        companyId: invoice.companyId,
        status: 'BETALT',
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Faktura ${invoice.invoiceNumber} markeret som betalt`)
      }
    })
  }

  function handleDelete(invoice: InvoiceWithCompany) {
    if (!confirm(`Vil du slette faktura ${invoice.invoiceNumber}? Dette kan ikke fortrydes.`)) return
    startTransition(async () => {
      const result = await deleteInvoice({
        invoiceId: invoice.id,
        companyId: invoice.companyId,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Faktura slettet')
      }
    })
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Opsummering */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Udestående</p>
          <p className="text-lg font-bold text-blue-900 mt-1">
            {formatCurrency(summary.outstandingAmount, 'DKK')}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Betalt</p>
          <p className="text-lg font-bold text-green-900 mt-1">
            {formatCurrency(summary.paidAmount, 'DKK')}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Forfalden</p>
          <p className="text-lg font-bold text-red-900 mt-1">
            {formatCurrency(summary.overdueAmount, 'DKK')}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Antal</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{summary.invoiceCount}</p>
        </div>
      </div>

      {/* Filter + tilføj */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {['alle', 'UDSTEDT', 'BETALT', 'FORFALDEN', 'KREDITERET'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {s === 'alle'
                ? 'Alle'
                : INVOICE_STATUS_LABELS[s as keyof typeof INVOICE_STATUS_LABELS]}
            </button>
          ))}
        </div>
        {onAddNew && (
          <button
            onClick={onAddNew}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            + Opret faktura
          </button>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="font-medium">Ingen fakturaer fundet</p>
          <p className="text-sm mt-1">
            {statusFilter === 'alle'
              ? 'Opret den første faktura for dette selskab'
              : `Ingen fakturaer med status "${INVOICE_STATUS_LABELS[statusFilter as keyof typeof INVOICE_STATUS_LABELS]}"`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Fakturanr.
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Selskab
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Beskrivelse
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Beløb
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Dato
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Forfald
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Handlinger
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{invoice.company.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                    {invoice.description}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium font-mono text-gray-900">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(invoice.invoiceDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invoice.dueDate ? (
                      <span
                        className={cn(
                          invoice.status === 'FORFALDEN' ? 'text-red-600 font-medium' : ''
                        )}
                      >
                        {formatDate(invoice.dueDate)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[invoice.status]
                      )}
                    >
                      {INVOICE_STATUS_LABELS[invoice.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {invoice.status === 'UDSTEDT' && (
                        <button
                          onClick={() => handleMarkAsPaid(invoice)}
                          disabled={isPending}
                          className="text-xs text-green-700 hover:text-green-900 font-medium"
                        >
                          Markér betalt
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(invoice)}
                        disabled={isPending}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Slet
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function InvoiceListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100" />
        ))}
      </div>
      <div className="h-8 w-64 bg-gray-100 rounded" />
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 h-10" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 border-t border-gray-100 bg-white" />
        ))}
      </div>
    </div>
  )
}