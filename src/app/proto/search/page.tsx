'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Building2,
  User,
  FileSignature,
  FileText,
  AlertCircle,
  X,
  ArrowRight,
  Sparkles,
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

const urgencyStyle: Record<string, string> = {
  critical: 'text-rose-700 font-semibold',
  warning:  'text-amber-700 font-medium',
  normal:   'text-slate-900 font-medium',
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSuggestionClick = (suggestion: string) => {
    if (debouncedQuery.trim() && debouncedQuery !== suggestion) {
      setPreviousQuery(debouncedQuery)
    }
    setQuery(suggestion)
    inputRef.current?.focus()
  }

  const clearContext = () => setPreviousQuery(null)

  const isSearching = debouncedQuery.trim().length > 0
  const isDebouncing = query.trim() !== debouncedQuery.trim() && query.trim().length > 0
  const suggestions = getSuggestedQueries(activeUser.role, 'search')
  const results = isSearching ? searchMock(debouncedQuery, activeUser.role) : null

  const presentTypes: DirectMatchType[] = results
    ? (['company', 'person', 'contract', 'document', 'case'] as DirectMatchType[]).filter(
        (t) => results.directMatches.some((m) => m.type === t),
      )
    : []

  const filteredMatches = results
    ? activeTab === 'alle'
      ? results.directMatches
      : results.directMatches.filter((m) => m.type === activeTab)
    : []

  const hasNoResults = results && results.directMatches.length === 0 && !results.aiAnswer

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[960px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Søg &amp; Spørg</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Søg på selskaber, kontrakter, personer — eller stil et spørgsmål
          </p>
        </div>

        {/* Context chip (tidligere søgning) */}
        {previousQuery && (
          <div className="mb-3 flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-white ring-1 ring-slate-900/[0.06] text-slate-600 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <span className="text-slate-400">Fortsætter fra:</span>
              <span>&lsquo;{previousQuery}&rsquo;</span>
              <button
                type="button"
                onClick={clearContext}
                className="text-slate-400 hover:text-slate-900 transition-colors ml-0.5"
                aria-label="Ryd kontekst"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Search input */}
        <div className="mb-6">
          <div className="bg-white ring-1 ring-slate-900/[0.06] rounded-xl px-5 py-4 flex items-center gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:ring-slate-900/20 transition-all">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Skriv et navn, CVR, eller stil et spørgsmål..."
              className="flex-1 text-[15px] text-slate-800 placeholder:text-slate-400 bg-transparent outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-900 transition-colors"
                aria-label="Ryd søgning"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Empty state — suggestions */}
        {!isSearching && (
          <div className="space-y-3">
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">
              Forslag
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="inline-flex items-center bg-white ring-1 ring-slate-900/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-slate-700 hover:ring-slate-900/20 hover:text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {hasNoResults && (
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-12 text-center">
            <p className="text-[13px] text-slate-500 font-medium">Ingen resultater for &lsquo;{debouncedQuery}&rsquo;</p>
            <p className="text-[11px] text-slate-400 mt-1">Prøv et andet søgeord eller stil et spørgsmål</p>
          </div>
        )}

        {/* Loading skeleton (under debounce) */}
        {isDebouncing && !results && (
          <SearchSkeleton />
        )}

        {/* Results */}
        {results && !hasNoResults && (() => {
          const aiSection = results.aiAnswer && (
            <div key="ai" className="bg-gradient-to-br from-violet-50 to-indigo-50 ring-1 ring-violet-200/60 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-white ring-1 ring-violet-200 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="text-[10px] font-medium text-violet-700 uppercase tracking-[0.08em]">AI-svar</div>
              </div>

              <p className="text-[14px] text-slate-800 leading-relaxed mb-4">{results.aiAnswer.text}</p>

              {results.aiAnswer.dataPoints.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {results.aiAnswer.dataPoints.map((point, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg px-3 py-2.5 ring-1 ring-violet-200/40 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    >
                      <div className="text-[10px] text-slate-400 font-medium mb-0.5">{point.label}</div>
                      {point.href ? (
                        <Link
                          href={point.href}
                          className={cn(
                            'text-[13px] tabular-nums hover:underline transition-colors no-underline',
                            urgencyStyle[point.urgency ?? 'normal'],
                          )}
                        >
                          {point.value}
                        </Link>
                      ) : (
                        <span className={cn('text-[13px] tabular-nums', urgencyStyle[point.urgency ?? 'normal'])}>
                          {point.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )

          const matchesSection = results.directMatches.length > 0 && (
            <div key="matches" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">
                  Direkte matches ({results.directMatches.length})
                </div>
                {presentTypes.length > 1 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <TypePill label="Alle" active={activeTab === 'alle'} onClick={() => setActiveTab('alle')} />
                    {presentTypes.map((type) => (
                      <TypePill
                        key={type}
                        label={typeTabLabels[type]}
                        active={activeTab === type}
                        onClick={() => setActiveTab(type)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] [overflow:clip]">
                {filteredMatches.slice(0, 5).map((match) => {
                  const Icon = typeIcons[match.type]
                  return (
                    <Link
                      key={match.id}
                      href={match.href}
                      className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors no-underline"
                    >
                      <div className="w-8 h-8 rounded-md bg-slate-50 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-slate-900 truncate">{match.title}</div>
                        <div className="text-[11px] text-slate-400 truncate">{match.subtitle}</div>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0">{match.typeLabel}</span>
                    </Link>
                  )
                })}
                {filteredMatches.length > 5 && (
                  <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/40">
                    <button
                      type="button"
                      onClick={() => toast.info('Vis alle kommer senere')}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      Vis alle {filteredMatches.length} resultater →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )

          const actionSection = results.actionPreview && (
            <div key="action" className="space-y-3">
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">
                Foreslået handling
              </div>
              <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
                <p className="text-[13px] font-medium text-slate-900 mb-3">{results.actionPreview.description}</p>
                <ul className="space-y-1.5 mb-4">
                  {results.actionPreview.items.map((item, idx) => {
                    const key = `${debouncedQuery}-${idx}`
                    const isChecked = key in checkedItems ? checkedItems[key] : item.checked
                    return (
                      <li key={idx} className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setCheckedItems((prev) => ({ ...prev, [key]: !isChecked }))}
                          className={cn(
                            'w-4 h-4 rounded flex items-center justify-center transition-all shrink-0',
                            isChecked
                              ? 'bg-slate-900 ring-1 ring-slate-900'
                              : 'bg-white ring-1 ring-slate-300 hover:ring-slate-500',
                          )}
                        >
                          {isChecked && (
                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                            </svg>
                          )}
                        </button>
                        <span
                          className={cn(
                            'text-[12px] cursor-pointer',
                            isChecked ? 'text-slate-900' : 'text-slate-600',
                          )}
                          onClick={() => setCheckedItems((prev) => ({ ...prev, [key]: !isChecked }))}
                        >
                          {item.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toast.success(`${results.actionPreview!.confirmLabel} (simuleret)`)}
                    className="flex items-center gap-1.5 bg-slate-900 text-white text-[12px] font-medium px-3.5 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)]"
                  >
                    {results.actionPreview.confirmLabel}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.info('Tilpas kommer senere')}
                    className="bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[12px] font-medium px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Tilpas
                  </button>
                </div>
              </div>
            </div>
          )

          const followUpsSection = results.suggestedFollowUps.length > 0 && (
            <div key="followups" className="space-y-3">
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">
                Relaterede spørgsmål
              </div>
              <div className="flex flex-wrap gap-2">
                {results.suggestedFollowUps.map((followUp) => (
                  <button
                    key={followUp}
                    type="button"
                    onClick={() => handleSuggestionClick(followUp)}
                    className="inline-flex items-center bg-white ring-1 ring-slate-900/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-slate-700 hover:ring-slate-900/20 hover:text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            </div>
          )

          // Render-rækkefølge baseret på queryType
          // search → matches first, AI secondary
          // question → AI first, matches secondary
          // action → action first, AI + matches secondary
          let orderedSections: (React.ReactNode | false | null | undefined)[]
          if (results.queryType === 'search') {
            orderedSections = [matchesSection, aiSection, actionSection, followUpsSection]
          } else if (results.queryType === 'action') {
            orderedSections = [actionSection, aiSection, matchesSection, followUpsSection]
          } else {
            // 'question' (default)
            orderedSections = [aiSection, matchesSection, actionSection, followUpsSection]
          }

          return <div className="space-y-6">{orderedSections.filter(Boolean)}</div>
        })()}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------
function SearchSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="h-12 border-b border-slate-100 flex items-center px-5 gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-100 rounded w-1/2" />
            <div className="h-2.5 bg-slate-100 rounded w-1/3" />
          </div>
        </div>
        <div className="h-12 border-b border-slate-100 flex items-center px-5 gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-100 rounded w-2/3" />
            <div className="h-2.5 bg-slate-100 rounded w-1/4" />
          </div>
        </div>
        <div className="h-12 flex items-center px-5 gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-100 rounded w-1/3" />
            <div className="h-2.5 bg-slate-100 rounded w-1/4" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Type filter pill
// ---------------------------------------------------------------
function TypePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors',
        active ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-900/[0.06] text-slate-600 hover:text-slate-900',
      )}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------
// Wrapper med Suspense for useSearchParams
// ---------------------------------------------------------------
export default function PrototypeSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-slate-50/60 p-8">
          <div className="max-w-[960px] mx-auto">
            <h1 className="text-[20px] font-semibold text-slate-900">Søg &amp; Spørg</h1>
          </div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  )
}
