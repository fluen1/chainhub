'use client'

import type { PortfolioFilters } from '@/types/portfolio'

const STATUS_OPTIONS = [
  { value: '', label: 'Alle statusser' },
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'inaktiv', label: 'Inaktiv' },
  { value: 'under_stiftelse', label: 'Under stiftelse' },
  { value: 'opløst', label: 'Opløst' },
]

interface PortfolioFiltersBarProps {
  filters: PortfolioFilters
  onFilterChange: (key: string, value: string | undefined) => void
}

export function PortfolioFiltersBar({ filters, onFilterChange }: PortfolioFiltersBarProps) {
  const hasActiveFilters =
    filters.status ||
    filters.minEjerandel !== undefined ||
    filters.maxEjerandel !== undefined ||
    filters.harAktiveSager ||
    filters.harUdloebende

  function clearAllFilters() {
    onFilterChange('status', undefined)
    onFilterChange('minEjerandel', undefined)
    onFilterChange('maxEjerandel', undefined)
    onFilterChange('harAktiveSager', undefined)
    onFilterChange('harUdloebende', undefined)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600" htmlFor="filter-status">
          Status
        </label>
        <select
          id="filter-status"
          value={filters.status ?? ''}
          onChange={(e) => onFilterChange('status', e.target.value || undefined)}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Min ejerandel */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600" htmlFor="filter-min-ejerandel">
          Min. ejerandel %
        </label>
        <input
          id="filter-min-ejerandel"
          type="number"
          min={0}
          max={100}
          step={1}
          placeholder="0"
          value={filters.minEjerandel ?? ''}
          onChange={(e) =>
            onFilterChange('minEjerandel', e.target.value || undefined)
          }
          className="h-9 w-24 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Max ejerandel */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600" htmlFor="filter-max-ejerandel">
          Max. ejerandel %
        </label>
        <input
          id="filter-max-ejerandel"
          type="number"
          min={0}
          max={100}
          step={1}
          placeholder="100"
          value={filters.maxEjerandel ?? ''}
          onChange={(e) =>
            onFilterChange('maxEjerandel', e.target.value || undefined)
          }
          className="h-9 w-24 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Har aktive sager */}
      <div className="flex items-center gap-2 pb-0.5">
        <input
          id="filter-aktive-sager"
          type="checkbox"
          checked={filters.harAktiveSager ?? false}
          onChange={(e) =>
            onFilterChange('harAktiveSager', e.target.checked ? 'true' : undefined)
          }
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="filter-aktive-sager" className="text-sm text-gray-700 cursor-pointer">
          Har aktive sager
        </label>
      </div>

      {/* Har udløbende kontrakter */}
      <div className="flex items-center gap-2 pb-0.5">
        <input
          id="filter-udloebende"
          type="checkbox"
          checked={filters.harUdloebende ?? false}
          onChange={(e) =>
            onFilterChange('harUdloebende', e.target.checked ? 'true' : undefined)
          }
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="filter-udloebende" className="text-sm text-gray-700 cursor-pointer">
          Udløbende kontrakter
        </label>
      </div>

      {/* Nulstil */}
      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="ml-auto h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Nulstil filtre
        </button>
      )}
    </div>
  )
}