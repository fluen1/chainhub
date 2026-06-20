'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  Breadcrumb,
  PageHeader,
  Panel,
  PanelHeader,
  Badge,
  type BadgeTone,
  BottomBar,
  KbdHint,
  FilterButton,
} from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// /search — klient-komponent.
// Input synces til ?q= med 200ms debounce, så server re-fetcher results.
// Type-pills filtrerer klient-side. Empty state viser quick-searches + tip.
// ────────────────────────────────────────────────────────────────────────────

export type ResultType = 'selskab' | 'kontrakt' | 'sag' | 'opgave' | 'person' | 'dokument' | 'notat'

export interface SearchResultRow {
  id: string
  type: ResultType
  title: string
  sub: string
  href: string
  badge: { tone: BadgeTone; label: string }
}

const TYPE_LABEL: Record<ResultType, string> = {
  selskab: 'Selskaber',
  kontrakt: 'Kontrakter',
  sag: 'Sager',
  opgave: 'Opgaver',
  person: 'Personer',
  dokument: 'Dokumenter',
  notat: 'Noter',
}

const TYPE_ICON: Record<ResultType, string> = {
  selskab: 'SEL',
  kontrakt: 'KON',
  sag: 'SAG',
  opgave: 'OPG',
  person: 'PER',
  dokument: 'DOK',
  notat: 'NOT',
}

const TYPE_ICON_BG: Record<ResultType, string> = {
  selskab: 'bg-b-blue-bg text-b-blue-fg',
  kontrakt: 'bg-b-gray-bg text-b-gray-fg',
  sag: 'bg-b-red-bg text-b-red-fg',
  opgave: 'bg-b-amber-bg text-b-amber-fg',
  person: 'bg-[#f3e8ff] text-b-ai-accent',
  dokument: 'bg-b-green-bg text-b-green-fg',
  notat: 'bg-amber-50 text-amber-700',
}

const TYPE_ORDER: ResultType[] = [
  'selskab',
  'kontrakt',
  'sag',
  'opgave',
  'person',
  'dokument',
  'notat',
]

const QUICK_SEARCHES = ['lejekontrakt', 'patientklage', 'tandlæge', 'bestyrelse', 'ejeraftale']

// Highlight matchende tekst (case-insensitive) i en streng. Returnerer React-nodes.
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${safe})`, 'gi'))
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-[#fff8c5] text-b-1">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  )
}

export function SearchPageB({
  query,
  results,
}: {
  query: string
  results: SearchResultRow[] | null
  totalCount: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [input, setInput] = useState(query)
  const [activeType, setActiveType] = useState<ResultType | 'alle'>('alle')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Sync ?q= → input når server giver ny query (fx fra recent-search-klik)
  const [prevQuery, setPrevQuery] = useState(query)
  if (prevQuery !== query) {
    setPrevQuery(query)
    setInput(query)
  }

  // Debounce: opdatér ?q= 200ms efter sidste tasten
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (input === query) return
      const sp = new URLSearchParams(params.toString())
      if (input.trim()) sp.set('q', input)
      else sp.delete('q')
      startTransition(() => {
        router.replace(`/search?${sp.toString()}`)
      })
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query er kun for ekstern sync, debounce skal kun trigge på input
  }, [input])

  // Keyboard: ⌘K focuserer + Esc rydder
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setInput('')
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const grouped = useMemo(() => {
    if (!results) return null
    const visible = activeType === 'alle' ? results : results.filter((r) => r.type === activeType)
    const map = new Map<ResultType, SearchResultRow[]>()
    for (const r of visible) {
      const arr = map.get(r.type) ?? []
      arr.push(r)
      map.set(r.type, arr)
    }
    return TYPE_ORDER.filter((t) => map.has(t)).map((t) => [t, map.get(t)!] as const)
  }, [results, activeType])

  const countByType = useMemo(() => {
    const m = new Map<ResultType, number>()
    if (!results) return m
    for (const r of results) m.set(r.type, (m.get(r.type) ?? 0) + 1)
    return m
  }, [results])

  const visibleCount =
    grouped == null ? 0 : grouped.reduce((acc, [, items]) => acc + items.length, 0)
  const hasQuery = input.trim().length > 0
  const hasResults = results != null && results.length > 0

  return (
    <>
      <Breadcrumb trail={[]} current="Søg" />

      <PageHeader
        title="Søg i porteføljen"
        meta={
          hasQuery
            ? `Søger på tværs af selskaber, kontrakter, sager, personer og dokumenter`
            : 'Indtast mindst 2 tegn — eller brug ⌘K fra enhver side'
        }
      />

      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-b-2"
        >
          ⌕
        </span>
        <input
          ref={inputRef}
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Søg i hele porteføljen — selskaber, kontrakter, sager, personer, dokumenter..."
          autoComplete="off"
          spellCheck={false}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- /search-side bør have fokus automatisk så ⌘K virker fra første tast
          autoFocus
          className="w-full rounded-[4px] border border-b-border-strong bg-white py-2 pl-8 pr-9 text-[14px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-2 focus:ring-b-blue-bg"
        />
        {input && (
          <button
            type="button"
            onClick={() => {
              setInput('')
              inputRef.current?.focus()
            }}
            aria-label="Ryd søgning"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-[14px] text-b-2 hover:bg-b-row-hover hover:text-b-1"
          >
            ×
          </button>
        )}
      </div>

      {hasQuery && results && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-b-2">Vis:</span>
          <FilterButton active={activeType === 'alle'} onClick={() => setActiveType('alle')}>
            Alle <span className="ml-1 opacity-70">{results.length}</span>
          </FilterButton>
          {TYPE_ORDER.map((t) => {
            const n = countByType.get(t) ?? 0
            if (n === 0) return null
            return (
              <FilterButton key={t} active={activeType === t} onClick={() => setActiveType(t)}>
                {TYPE_LABEL[t]} <span className="ml-1 opacity-70">{n}</span>
              </FilterButton>
            )
          })}
        </div>
      )}

      {hasQuery && results && (
        <div className="b-tnum text-[11px] text-b-2">
          {visibleCount} {visibleCount === 1 ? 'resultat' : 'resultater'} for &ldquo;{query}&rdquo;
        </div>
      )}

      {/* RESULTS */}
      {hasQuery && hasResults && grouped && (
        <div className="flex flex-col gap-3">
          {grouped.map(([type, items]) => (
            <Panel key={type}>
              <PanelHeader
                title={TYPE_LABEL[type]}
                meta={`${items.length} ${items.length === 1 ? 'resultat' : 'resultater'}`}
              />
              {items.map((r, i) => (
                <Link
                  key={r.id}
                  href={r.href}
                  className={`grid grid-cols-[32px_1fr_auto_14px] items-center gap-3 px-3 py-1.5 no-underline hover:bg-b-row-hover ${
                    i < items.length - 1 ? 'border-b border-b-divider' : ''
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-[4px] text-[10px] font-bold ${TYPE_ICON_BG[r.type]}`}
                    style={{ letterSpacing: '0.3px' }}
                  >
                    {TYPE_ICON[r.type]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-b-1">
                      {highlight(r.title, query)}
                    </div>
                    <div className="truncate text-[11px] text-b-2">{r.sub}</div>
                  </div>
                  <Badge tone={r.badge.tone}>{r.badge.label}</Badge>
                  <span className="text-b-3">›</span>
                </Link>
              ))}
            </Panel>
          ))}
        </div>
      )}

      {/* NO RESULTS */}
      {hasQuery && results != null && !hasResults && (
        <Panel>
          <div className="px-3 py-8 text-center">
            <div className="text-[13px] font-medium text-b-2">
              Ingen resultater for &ldquo;{query}&rdquo;
            </div>
            <div className="mt-1 text-[12px] text-b-3">
              Prøv et kortere søgeord eller søg på CVR-nummer, sagsnummer eller filnavn.
            </div>
          </div>
        </Panel>
      )}

      {/* EMPTY STATE — quick searches + tip */}
      {!hasQuery && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Hurtig adgang" />
            <div className="flex flex-wrap gap-1.5 p-3">
              {QUICK_SEARCHES.map((qs) => (
                <button
                  key={qs}
                  type="button"
                  onClick={() => setInput(qs)}
                  className="rounded-[3px] border border-b-border-strong bg-white px-2.5 py-1 text-[12px] font-medium text-b-1 hover:border-b-blue-fg hover:bg-b-blue-bg hover:text-b-blue-fg"
                >
                  {qs}
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Tip" />
            <div className="px-3 py-3 text-[12px] leading-relaxed text-b-2">
              Søg på CVR-nummer, sagsnummer (fx <code className="b-kbd">#2841</code>), filnavn eller
              personnavn. Brug <KbdHint k="⌘K" /> fra enhver side for at åbne denne søgning, og{' '}
              <KbdHint k="Esc" /> for at rydde feltet.
            </div>
          </Panel>
        </div>
      )}

      <BottomBar
        left={
          hasQuery && results
            ? `${visibleCount} resultater · søgte i hele porteføljen`
            : 'Indtast et søgeord for at finde selskaber, kontrakter, sager, opgaver, personer og dokumenter'
        }
        right={
          <>
            <KbdHint k="⌘K" label="åbn søgning" />
            <span>·</span>
            <KbdHint k="Esc" label="ryd" />
          </>
        }
      />
    </>
  )
}
