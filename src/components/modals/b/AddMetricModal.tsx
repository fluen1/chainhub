'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BModal, BTextareaField, BSegmentedField, BFieldWrap, BFieldRow } from '@/components/ui/b'
import { upsertFinancialMetric } from '@/actions/finance'

// ────────────────────────────────────────────────────────────────────────────
// AddMetricModal — wired til upsertFinancialMetric (server bruger upsert,
// så samme metric+periode overskrives — der vises konflikt-warning på UI'et).
// ────────────────────────────────────────────────────────────────────────────

type MetricType =
  | 'OMSAETNING'
  | 'EBITDA'
  | 'RESULTAT'
  | 'LIKVIDITET'
  | 'EGENKAPITAL'
  | 'ANDET_METRIC'
type PeriodType = 'HELAAR' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'MAANED'
type Source = 'REVIDERET' | 'UREVIDERET' | 'ESTIMAT'

const METRIC_TYPES: Array<{ value: MetricType; label: string; unit: string }> = [
  { value: 'OMSAETNING', label: 'Omsætning', unit: 'kr' },
  { value: 'EBITDA', label: 'EBITDA', unit: 'kr' },
  { value: 'RESULTAT', label: 'Resultat', unit: 'kr' },
  { value: 'LIKVIDITET', label: 'Likviditet', unit: 'kr' },
  { value: 'EGENKAPITAL', label: 'Egenkapital', unit: 'kr' },
  { value: 'ANDET_METRIC', label: 'Andet', unit: '' },
]

const PERIOD_TYPES: Array<{ value: PeriodType; label: string }> = [
  { value: 'HELAAR', label: 'Helår' },
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' },
  { value: 'MAANED', label: 'Måned' },
]

const SOURCES: Array<{ value: Source; label: string }> = [
  { value: 'REVIDERET', label: 'Revideret' },
  { value: 'UREVIDERET', label: 'Urevideret' },
  { value: 'ESTIMAT', label: 'Estimat' },
]

export interface ExistingMetric {
  metricType: MetricType
  periodType: PeriodType
  periodYear: number
  value: number
}

// Parser dansk talformat: "1.840.000,50" → 1840000.50
function parseDanishNumber(s: string): number | null {
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.')
  if (!cleaned || cleaned === '-') return null
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

export function AddMetricModal({
  open,
  onClose,
  companyId,
  companyName,
  existing,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  companyName: string
  existing: ExistingMetric[]
}) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const [metricType, setMetricType] = useState<MetricType>('OMSAETNING')
  const [valueInput, setValueInput] = useState('')
  const [periodType, setPeriodType] = useState<PeriodType>('HELAAR')
  const [periodYear, setPeriodYear] = useState(currentYear)
  const [source, setSource] = useState<Source>('UREVIDERET')
  const [notes, setNotes] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [submitting, startTransition] = useTransition()

  const value = parseDanishNumber(valueInput)
  const metricMeta = METRIC_TYPES.find((m) => m.value === metricType)!

  // Konflikt: samme metric+periode+år eksisterer allerede
  const conflict = existing.find(
    (e) => e.metricType === metricType && e.periodType === periodType && e.periodYear === periodYear
  )

  // Trend-preview: tidligere 3 målinger samme metric-type
  const history = useMemo(
    () =>
      existing
        .filter((e) => e.metricType === metricType)
        .sort((a, b) => b.periodYear - a.periodYear)
        .slice(0, 3),
    [existing, metricType]
  )

  const canSubmit = value != null && value !== 0 && (!conflict || confirmReplace) && !submitting

  function handleSubmit() {
    if (!canSubmit || value == null) return
    startTransition(async () => {
      const result = await upsertFinancialMetric({
        companyId,
        metricType,
        periodType,
        periodYear,
        value,
        currency: 'DKK',
        source,
        notes: notes.trim() || undefined,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        conflict
          ? `${metricMeta.label} ${periodLabel(periodType, periodYear)} opdateret`
          : `${metricMeta.label} ${periodLabel(periodType, periodYear)} tilføjet`
      )
      setValueInput('')
      setNotes('')
      setConfirmReplace(false)
      onClose()
      router.refresh()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      title={`Tilføj finansiel metric · ${companyName}`}
      subtitle={`${periodLabel(periodType, periodYear)} · ${history.length > 0 ? `${history.length} tidligere ${history.length === 1 ? 'måling' : 'målinger'}` : 'Ingen historik endnu'}`}
      submitLabel={conflict ? 'Erstat metric' : 'Tilføj metric'}
      submitDisabled={!canSubmit}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <BSegmentedField
        label="Metric-type"
        options={METRIC_TYPES.map((m) => ({ value: m.value, label: m.label }))}
        value={metricType}
        onChange={(v) => {
          setMetricType(v)
          setConfirmReplace(false)
        }}
        required
        wrap
      />

      <BFieldRow>
        <BFieldWrap label="Beløb" required hint={`Dansk format · enhed: ${metricMeta.unit || '—'}`}>
          <input
            type="text"
            inputMode="decimal"
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            placeholder="1.840.000,00"
            className="b-tnum rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-right text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- amount er primært input
            autoFocus
          />
        </BFieldWrap>
        <BFieldWrap label="Kilde">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </BFieldWrap>
      </BFieldRow>

      <BSegmentedField
        label="Periode-type"
        options={PERIOD_TYPES}
        value={periodType}
        onChange={(v) => {
          setPeriodType(v)
          setConfirmReplace(false)
        }}
        required
        wrap
      />

      <BFieldWrap label="År" required>
        <input
          type="number"
          value={periodYear}
          onChange={(e) => {
            setPeriodYear(Number(e.target.value))
            setConfirmReplace(false)
          }}
          min={1990}
          max={2100}
          className="b-tnum w-[120px] rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
        />
      </BFieldWrap>

      {/* Konflikt-warning */}
      {conflict && (
        <div className="rounded-[4px] border-l-[3px] border-l-b-amber-fg border border-[#e6d370] bg-b-amber-bg px-3 py-2 text-[12px] text-[#6e5a10]">
          <div className="font-medium">
            ⚠ {metricMeta.label} {periodLabel(periodType, periodYear)} er allerede registreret (
            {formatNumber(conflict.value)})
          </div>
          {!confirmReplace ? (
            <button
              type="button"
              onClick={() => setConfirmReplace(true)}
              className="mt-1.5 text-b-amber-fg underline hover:no-underline"
            >
              Klik for at erstatte den eksisterende værdi
            </button>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <span>Bekræftet — den nye værdi erstatter den gamle.</span>
              <button
                type="button"
                onClick={() => setConfirmReplace(false)}
                className="text-b-amber-fg underline hover:no-underline"
              >
                Fortryd
              </button>
            </div>
          )}
        </div>
      )}

      {/* Historik */}
      {history.length > 0 && (
        <div className="rounded-[4px] border border-b-border bg-b-panel-h px-3 py-2">
          <div
            className="mb-1 text-[10px] font-semibold uppercase text-b-2"
            style={{ letterSpacing: '0.5px' }}
          >
            Tidligere {metricMeta.label.toLowerCase()}
          </div>
          <div className="flex flex-col gap-0.5 text-[12px] text-b-1">
            {history.map((h, i) => (
              <div key={i} className="flex justify-between">
                <span>{periodLabel(h.periodType, h.periodYear)}</span>
                <span className="b-tnum">{formatNumber(h.value)}</span>
              </div>
            ))}
            {value != null && value > 0 && (
              <div className="mt-1 flex justify-between border-t border-dashed border-b-divider pt-1 text-b-blue-fg">
                <span>Ny · {periodLabel(periodType, periodYear)}</span>
                <span className="b-tnum font-medium">{formatNumber(value)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <BTextareaField label="Note (valgfri)" value={notes} onChange={setNotes} />
    </BModal>
  )
}

function periodLabel(t: PeriodType, year: number): string {
  if (t === 'HELAAR') return `${year}`
  if (t === 'MAANED') return `Måned ${year}`
  return `${t} ${year}`
}

function formatNumber(n: number): string {
  return n.toLocaleString('da-DK', { maximumFractionDigits: 0 })
}
