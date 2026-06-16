'use client'

import { Sparkles, Building2, User, Copy, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import type { DocumentEnrichmentData, EntityMatchResult } from '@/actions/document-enrichment'
import { Panel, PanelHeader, PanelBody, PanelEmpty, Badge } from '@/components/ui/b'

// Mapning af confidence til Badge-tone
function confidenceTone(confidence: number | null): 'green' | 'amber' | 'red' {
  if (confidence == null) return 'red'
  if (confidence >= 0.8) return 'green'
  if (confidence >= 0.5) return 'amber'
  return 'red'
}

function confidenceLabel(confidence: number | null): string {
  if (confidence == null) return '—'
  return `${Math.round(confidence * 100)} %`
}

function EntityMatchRow({ match }: { match: EntityMatchResult }) {
  const href =
    match.entity_type === 'company'
      ? `/companies/${match.entity_id}`
      : `/persons/${match.entity_id}`
  const Icon = match.entity_type === 'company' ? Building2 : User

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-b-divider last:border-b-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className="h-3 w-3 shrink-0 text-b-3" />
        <Link
          href={href}
          className="text-[13px] text-b-link hover:underline truncate flex items-center gap-1"
        >
          {match.entity_name}
          <ExternalLink className="h-3 w-3 inline shrink-0 opacity-60" />
        </Link>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <span className="text-[11px] text-b-3 truncate max-w-[120px]" title={match.match_reason}>
          {match.match_reason}
        </span>
        <Badge tone={confidenceTone(match.confidence)}>{confidenceLabel(match.confidence)}</Badge>
      </div>
    </div>
  )
}

function ExtractedFieldRow({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const displayValue = formatFieldValue(value)

  function handleCopy() {
    if (displayValue == null) return
    navigator.clipboard
      .writeText(String(displayValue))
      .then(() => {
        toast.success('Kopieret')
      })
      .catch(() => {
        toast.error('Kopiering mislykkedes')
      })
  }

  const label = fieldKey
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())

  return (
    <div className="flex items-start justify-between py-1.5 border-b border-b-divider last:border-b-0 group">
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] font-semibold uppercase text-b-3 mb-0.5"
          style={{ letterSpacing: '0.4px' }}
        >
          {label}
        </div>
        <div className="text-[13px] text-b-1 break-words">
          {displayValue ?? <span className="text-b-3 italic">—</span>}
        </div>
      </div>
      {displayValue != null && (
        <button
          onClick={handleCopy}
          className="ml-2 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-b-surface-hover text-b-3 hover:text-b-1"
          title="Kopiér"
          type="button"
          aria-label={`Kopiér ${label}`}
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function formatFieldValue(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    // Extracted field objects have a `value` property
    const obj = raw as Record<string, unknown>
    if ('value' in obj) return formatFieldValue(obj.value)
    return JSON.stringify(raw)
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null
    return raw
      .map((item) => {
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          return String(o.name ?? o.title ?? o.label ?? JSON.stringify(o))
        }
        return String(item)
      })
      .join(', ')
  }
  const str = String(raw)
  return str === '' ? null : str
}

interface EnrichmentPanelProps {
  data: DocumentEnrichmentData | null
}

export function EnrichmentPanel({ data }: EnrichmentPanelProps) {
  const [showAll, setShowAll] = useState(false)

  if (!data) return null

  const fieldEntries = Object.entries(data.extractedFields)
  const visibleFields = showAll ? fieldEntries : fieldEntries.slice(0, 6)
  const hasMore = fieldEntries.length > 6

  return (
    <div className="flex flex-col gap-3">
      {/* Dokumenttype */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              AI-analyse
            </span>
          }
        />
        <PanelBody>
          {data.detectedType ? (
            <div className="flex items-center justify-between py-1">
              <span className="text-[13px] text-b-1">{data.detectedType}</span>
              <Badge tone={confidenceTone(data.typeConfidence)}>
                {confidenceLabel(data.typeConfidence)}
              </Badge>
            </div>
          ) : (
            <PanelEmpty>Ingen dokumenttype detekteret</PanelEmpty>
          )}
        </PanelBody>
      </Panel>

      {/* Entitetsmatch */}
      <Panel>
        <PanelHeader
          title="Relationer"
          meta={data.entityMatches.length > 0 ? `${data.entityMatches.length}` : undefined}
        />
        <PanelBody noPadding>
          {data.entityMatches.length > 0 ? (
            <div className="px-3">
              {data.entityMatches.map((match) => (
                <EntityMatchRow key={`${match.entity_type}-${match.entity_id}`} match={match} />
              ))}
            </div>
          ) : (
            <PanelEmpty>Ingen relationer fundet</PanelEmpty>
          )}
        </PanelBody>
      </Panel>

      {/* Udtrukne felter */}
      {fieldEntries.length > 0 && (
        <Panel>
          <PanelHeader title="Udtrukne felter" meta={`${fieldEntries.length}`} />
          <PanelBody noPadding>
            <div className="px-3">
              {visibleFields.map(([key, value]) => (
                <ExtractedFieldRow key={key} fieldKey={key} value={value} />
              ))}
            </div>
            {hasMore && (
              <div className="border-t border-b-border px-3 py-1.5">
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-[12px] text-b-link hover:underline"
                  type="button"
                >
                  {showAll ? 'Vis færre' : `Vis alle ${fieldEntries.length} felter`}
                </button>
              </div>
            )}
          </PanelBody>
        </Panel>
      )}
    </div>
  )
}
