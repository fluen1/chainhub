'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  User,
  FileSignature,
  FileText,
  AlertCircle,
  X,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { searchMock, getSuggestedQueries } from '@/mock/search-responses'
import { cn } from '@/lib/utils'
import type { MockSearchResponse } from '@/mock/types'

type DirectMatchType = MockSearchResponse['directMatches'][number]['type']
type FilterTab = 'alle' | DirectMatchType

const typeIcons: Record<DirectMatchType, React.ElementType> = {
  company: Building2,
  person: User,
  contract: FileSignature,
  document: FileText,
  case: AlertCircle,
}

const typeTabLabels: Record<DirectMatchType, string> = {
  company: 'Selskaber',
  person: 'Personer',
  contract: 'Kontrakter',
  document: 'Dokumenter',
  case: 'Sager',
}

const urgencyColors: Record<string, string> = {
  critical: 'text-red-600 font-semibold',
  warning: 'text-amber-600 font-medium',
  normal: 'text-gray-700',
}

function SearchPageInner() {
  const { activeUser } = usePrototype()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
  const [previousQuery, setPreviousQuery] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('alle')
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSuggestionClick = (suggestion: string) => {
    if (debouncedQuery.trim() && debouncedQuery !== suggestion) {
      setPreviousQuery(debouncedQuery)
    }
    setQuery(suggestion)
  }

  const clearContext = () => {
    setPreviousQuery(null)
  }

  const isSearching = debouncedQuery.trim().length > 0
  const suggestions = getSuggestedQueries(activeUser.role, 'search')
  const results = isSearching ? searchMock(debouncedQuery, activeUser.role) : null

  // Which types are present in results
  const presentTypes: DirectMatchType[] = results
    ? ((['company', 'person', 'contract', 'document', 'case'] as DirectMatchType[]).filter(
        (t) => results.directMatches.some((m) => m.type === t)
      ))
    : []

  const filteredMatches = results
    ? activeTab === 'alle'
      ? results.directMatches
      : results.directMatches.filter((m) => m.type === activeTab)
    : []

  const hasNoResults =
    results &&
    results.directMatches.length === 0 &&
    !results.aiAnswer

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="border-b border-gray-200/60 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Søg &amp; Spørg</h1>
        <p className="mt-1 text-sm text-gray-500">Søg på selskaber, kontrakter, personer — eller stil et spørgsmål</p>
      </div>

      {/* Context chip */}
      {previousQuery && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full">
            Fortsætter fra: &lsquo;{previousQuery}&rsquo;
            <button
              onClick={clearContext}
              className="hover:text-gray-900 transition-colors"
              aria-label="Ryd kontekst"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* Search input */}
      <div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Skriv et navn, CVR, eller stil et spørgsmål..."
          className="w-full text-lg px-6 py-4 border-2 border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:border-slate-400 focus:shadow-md transition-all"
        />
      </div>

      {/* Empty state — suggestions */}
      {!isSearching && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">Forslag</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="inline-flex items-center bg-white border border-gray-200 rounded-full px-4 py-2 hover:bg-gray-50 hover:border-gray-300 cursor-pointer text-sm text-gray-700 transition-colors shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {hasNoResults && (
        <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            Ingen resultater for &lsquo;{debouncedQuery}&rsquo;. Prøv et andet søgeord eller stil et spørgsmål.
          </p>
        </div>
      )}

      {/* Results */}
      {results && !hasNoResults && (
        <div className="space-y-5">

          {/* Direkte matches */}
          {results.directMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">Direkte matches</p>

              {/* Filter tabs */}
              {presentTypes.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {(['alle', ...presentTypes] as FilterTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colors',
                        activeTab === tab
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      {tab === 'alle' ? 'Alle' : typeTabLabels[tab]}
                    </button>
                  ))}
                </div>
              )}

              {/* Match list */}
              <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
                {filteredMatches.slice(0, 5).map((match) => {
                  const Icon = typeIcons[match.type]
                  return (
                    <Link
                      key={match.id}
                      href={match.href}
                      className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/80 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{match.title}</p>
                        <p className="text-xs text-gray-500 truncate">{match.subtitle}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{match.typeLabel}</span>
                    </Link>
                  )
                })}
                {filteredMatches.length > 5 && (
                  <div className="px-5 py-2.5 bg-gray-50 border-t">
                    <button
                      onClick={() => toast.info('Vis alle ikke tilgængeligt i prototypen')}
                      className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      Vis alle {filteredMatches.length} resultater →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI-svar */}
          {results.aiAnswer && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">AI-svar</p>
              <div className="border-l-4 border-blue-400 bg-blue-50/80 rounded-r-xl p-5 space-y-4">
                <p className="text-base text-gray-800 leading-relaxed">{results.aiAnswer.text}</p>
                {results.aiAnswer.dataPoints.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {results.aiAnswer.dataPoints.map((point, idx) => (
                      <div key={idx} className="bg-white rounded-lg px-4 py-3 border border-blue-100/60 shadow-sm">
                        <p className="text-xs text-gray-400 mb-1">{point.label}</p>
                        {point.href ? (
                          <Link
                            href={point.href}
                            className={cn(
                              'text-sm font-medium hover:underline transition-colors',
                              urgencyColors[point.urgency ?? 'normal']
                            )}
                          >
                            {point.value}
                          </Link>
                        ) : (
                          <p className={cn('text-sm font-medium', urgencyColors[point.urgency ?? 'normal'])}>
                            {point.value}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Handlings-preview */}
          {results.actionPreview && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">Foreslået handling</p>
              <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-3">
                <p className="text-sm font-medium text-gray-900">{results.actionPreview.description}</p>
                <ul className="space-y-1.5">
                  {results.actionPreview.items.map((item, idx) => {
                    const key = `${debouncedQuery}-${idx}`
                    const isChecked = key in checkedItems ? checkedItems[key] : item.checked
                    return (
                      <li key={idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => setCheckedItems((prev) => ({ ...prev, [key]: !isChecked }))}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 cursor-pointer"
                        />
                        <span
                          className="text-xs text-gray-700 cursor-pointer"
                          onClick={() => setCheckedItems((prev) => ({ ...prev, [key]: !isChecked }))}
                        >
                          {item.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => toast.info('Tilpas ikke tilgængeligt i prototypen')}
                    className="bg-white border border-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded hover:bg-gray-50 transition-colors"
                  >
                    Tilpas
                  </button>
                  <button
                    onClick={() => toast.success(`${results.actionPreview!.confirmLabel} (simuleret)`)}
                    className="inline-flex items-center gap-1 bg-gray-900 text-white text-xs px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                  >
                    {results.actionPreview.confirmLabel}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Relaterede spørgsmål */}
          {results.suggestedFollowUps.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">Relaterede spørgsmål</p>
              <div className="flex flex-wrap gap-2">
                {results.suggestedFollowUps.map((followUp) => (
                  <button
                    key={followUp}
                    onClick={() => handleSuggestionClick(followUp)}
                    className="inline-flex items-center bg-white border border-gray-200 rounded-full px-4 py-2 hover:bg-gray-50 hover:border-gray-300 cursor-pointer text-sm text-gray-700 transition-colors shadow-sm"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PrototypeSearchPage() {
  return (
    <Suspense fallback={<div className="space-y-5"><h1 className="text-2xl font-bold text-gray-900">Søg &amp; Spørg</h1></div>}>
      <SearchPageInner />
    </Suspense>
  )
}
