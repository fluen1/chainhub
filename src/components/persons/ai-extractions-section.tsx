import Link from 'next/link'
import { Sparkles, FileText, ExternalLink } from 'lucide-react'
import { formatDate, getContractTypeLabel } from '@/lib/labels'
import type { PersonContractExtraction } from '@/actions/person-ai'

interface Props {
  extractions: PersonContractExtraction[]
}

/**
 * Fremhævede felter for ansættelseskontrakter (både funktionær og ikke-funktionær).
 * Rækkefølgen styrer visningen i UI.
 */
const ANSAETTELSE_FIELDS: Array<{
  key: string
  label: string
  format?: (v: unknown) => string
}> = [
  { key: 'position_title', label: 'Stilling' },
  {
    key: 'salary_monthly_dkk',
    label: 'Månedsløn',
    format: (v) => (typeof v === 'number' ? `${v.toLocaleString('da-DK')} kr.` : 'Ikke angivet'),
  },
  {
    key: 'notice_employee_months',
    label: 'Opsigelsesvarsel (medarb.)',
    format: (v) => (typeof v === 'number' ? `${v} mdr.` : 'Ikke angivet'),
  },
  {
    key: 'notice_employer_months',
    label: 'Opsigelsesvarsel (arbejdsgiver)',
    format: (v) => (typeof v === 'number' ? `${v} mdr.` : 'Ikke angivet'),
  },
  {
    key: 'pension_pct',
    label: 'Pension',
    format: (v) => (typeof v === 'number' ? `${v}%` : 'Ikke angivet'),
  },
  {
    key: 'working_hours_weekly',
    label: 'Timer/uge',
    format: (v) => (typeof v === 'number' ? `${v} t.` : 'Ikke angivet'),
  },
  {
    key: 'vacation_days',
    label: 'Feriedage',
    format: (v) => (typeof v === 'number' ? `${v} dage` : 'Ikke angivet'),
  },
  {
    key: 'start_date',
    label: 'Startdato',
    format: (v) => (typeof v === 'string' ? formatDate(v) : 'Ikke angivet'),
  },
  {
    key: 'end_date',
    label: 'Slutdato',
    format: (v) => (typeof v === 'string' ? formatDate(v) : 'Tidsubestemt'),
  },
  {
    key: 'non_compete',
    label: 'Konkurrenceklausul',
    format: (v) => (v ? 'Ja' : 'Nej / ikke angivet'),
  },
]

function formatFieldValue(key: string, value: unknown): string {
  const def = ANSAETTELSE_FIELDS.find((f) => f.key === key)
  if (def?.format) return def.format(value)
  if (value === null || value === undefined) return 'Ikke angivet'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function confidenceColor(conf: number): string {
  if (conf >= 0.9) return 'text-emerald-700'
  if (conf >= 0.7) return 'text-amber-700'
  return 'text-red-700'
}

export function PersonAIExtractionsSection({ extractions }: Props) {
  if (extractions.length === 0) return null

  return (
    <section className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-purple-600" aria-hidden />
        <h2 className="text-sm font-semibold text-gray-900">AI-udlæste kontrakt-vilkår</h2>
        <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs text-purple-700 ring-1 ring-purple-200">
          {extractions.length} kontrakt{extractions.length === 1 ? '' : 'er'}
        </span>
      </div>

      <div className="space-y-4">
        {extractions.map((ext) => (
          <div key={ext.extractionId} className="rounded-lg border border-white/60 bg-white/70 p-4">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="min-w-0">
                <Link
                  href={`/contracts/${ext.contractId}`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-700 no-underline"
                >
                  {ext.contractDisplayName}
                </Link>
                <div className="text-xs text-gray-500 mt-0.5">
                  {getContractTypeLabel(ext.contractSystemType)}
                  {ext.companyName && ` · ${ext.companyName}`}
                </div>
              </div>
              <Link
                href={`/documents/review/${ext.extractionId}`}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 no-underline shrink-0"
              >
                <FileText className="h-3 w-3" aria-hidden />
                Review
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </div>

            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
              {ANSAETTELSE_FIELDS.map((def) => {
                const field = ext.fields[def.key]
                if (!field) return null
                return (
                  <div key={def.key} className="flex items-baseline justify-between gap-3 py-1">
                    <dt className="text-xs text-gray-600 shrink-0">{def.label}</dt>
                    <dd className="text-right">
                      <span className="text-xs font-medium text-gray-900">
                        {formatFieldValue(def.key, field.value)}
                      </span>
                      <span
                        className={`ml-2 text-[10px] font-mono ${confidenceColor(field.confidence)}`}
                        title={`Konfidens: ${(field.confidence * 100).toFixed(0)}%`}
                      >
                        {(field.confidence * 100).toFixed(0)}%
                      </span>
                    </dd>
                  </div>
                )
              })}
            </dl>

            <div className="mt-2 text-[10px] text-gray-400">
              Udlæst {formatDate(ext.extractedAt)} · Source: Claude AI
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
