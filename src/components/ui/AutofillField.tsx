'use client'

import { Sparkles, Check, X } from 'lucide-react'
import { useState } from 'react'
import { BTextField } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// AutofillField — BTextField med AI-forslagsindikator.
// Når suggestion er tilgængelig og feltet er tomt vises en lilla forslagsbar
// under input. Brugeren kan acceptere (udfylder feltet) eller afvise (skjuler
// baren).
// ────────────────────────────────────────────────────────────────────────────

export interface AutofillSuggestionProp {
  value: string | number
  source: 'cvr_api' | 'internal' | 'document_extraction'
  confidence: number
}

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  suggestion: AutofillSuggestionProp | null
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string | null
}

const sourceLabels: Record<AutofillSuggestionProp['source'], string> = {
  cvr_api: 'Forslag fra CVR',
  internal: 'Forslag fra intern data',
  document_extraction: 'Forslag fra dokument',
}

export function AutofillField({
  label,
  value,
  onChange,
  suggestion,
  placeholder,
  required,
  disabled,
  error,
}: Props) {
  const [dismissed, setDismissed] = useState(false)

  const showSuggestion = suggestion !== null && value === '' && !dismissed

  function handleAccept() {
    if (suggestion) {
      onChange(String(suggestion.value))
    }
    setDismissed(true)
  }

  function handleDismiss() {
    setDismissed(true)
  }

  return (
    <div>
      <BTextField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        error={error}
      />
      {showSuggestion && (
        <div className="border border-purple-200 bg-purple-50 px-2.5 py-1.5 rounded-md mt-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0" />
          <span className="text-[11px] font-medium text-purple-700">
            {sourceLabels[suggestion.source]}:
          </span>
          <span className="text-[12px] text-purple-900 font-medium flex-1 truncate">
            {String(suggestion.value)}
          </span>
          <button
            type="button"
            onClick={handleAccept}
            aria-label="Acceptér"
            className="rounded p-0.5 hover:bg-purple-100 text-purple-700"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Afvis"
            className="rounded p-0.5 hover:bg-purple-100 text-purple-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
