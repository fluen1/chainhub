'use client'

import React, { useId } from 'react'
import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// BField — form-field primitiver til B-stil modaler.
// Dense, ingen chrome — label 11px uppercase, input 13px, 4px radius.
// ────────────────────────────────────────────────────────────────────────────

interface FieldWrapProps {
  label: string
  required?: boolean
  hint?: React.ReactNode
  error?: string | null
  children: React.ReactNode
  /** Eksplicit id — genereres automatisk via useId hvis ikke angivet. */
  inputId?: string
}

/** FieldWrap — fælles label + hint/error-frame om hvert form-felt. */
export function BFieldWrap({
  label,
  required,
  hint,
  error,
  children,
  inputId: inputIdProp,
}: FieldWrapProps) {
  const generatedId = useId()
  const inputId = inputIdProp ?? generatedId
  const errorId = `${inputId}-error`

  // Klon child-element med id + aria-attributter
  const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>
  const clonedChild = React.isValidElement(child)
    ? React.cloneElement(child, {
        id: inputId,
        ...(required ? { 'aria-required': true } : {}),
        ...(error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}),
      } as React.HTMLAttributes<HTMLElement>)
    : children

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-[11px] font-semibold uppercase text-b-2"
        style={{ letterSpacing: '0.4px' }}
      >
        {label}
        {required && <span className="ml-0.5 text-b-red-fg">*</span>}
      </label>
      {clonedChild}
      {error ? (
        <p id={errorId} role="alert" className="m-0 text-[11px] text-b-red-fg">
          {error}
        </p>
      ) : hint ? (
        <div className="text-[11px] text-b-2">{hint}</div>
      ) : null}
    </div>
  )
}

const inputBase =
  'rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 placeholder:text-b-3 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60'

const inputError =
  'rounded-[4px] border border-b-red-fg bg-white px-2.5 py-1.5 text-[13px] text-b-1 placeholder:text-b-3 focus:outline-2 focus:outline-b-red-fg focus:outline-offset-[-1px]'

// ─── BTextField ────────────────────────────────────────────────────────────

interface TextFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  hint?: React.ReactNode
  error?: string | null
  disabled?: boolean
  type?: 'text' | 'email' | 'tel' | 'date' | 'number'
  autoFocus?: boolean
}

export function BTextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
  error,
  disabled,
  type = 'text',
  autoFocus,
}: TextFieldProps) {
  return (
    <BFieldWrap label={label} required={required} hint={hint} error={error}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- modaler skal kunne fokusere første felt
        autoFocus={autoFocus}
        className={error ? inputError : inputBase}
      />
    </BFieldWrap>
  )
}

// ─── BTextareaField ────────────────────────────────────────────────────────

interface TextareaFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  required?: boolean
  hint?: React.ReactNode
  error?: string | null
  disabled?: boolean
}

export function BTextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
  required,
  hint,
  error,
  disabled,
}: TextareaFieldProps) {
  return (
    <BFieldWrap label={label} required={required} hint={hint} error={error}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={cn(error ? inputError : inputBase, 'resize-y leading-snug')}
      />
    </BFieldWrap>
  )
}

// ─── BSegmentedField ───────────────────────────────────────────────────────
// Segmented control som form-field (med label ovenover).
// For "Annuller/Tilføj"-buttons brug SegmentedToggle fra FilterRow direkte.

interface SegmentedFieldProps<T extends string> {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  required?: boolean
  hint?: React.ReactNode
  /** Wrap til flere rækker hvis options er mange. */
  wrap?: boolean
}

export function BSegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
  required,
  hint,
  wrap,
}: SegmentedFieldProps<T>) {
  return (
    <BFieldWrap label={label} required={required} hint={hint}>
      <div
        className={cn(
          'inline-flex overflow-hidden rounded-[4px] border border-b-border-strong',
          wrap && 'flex-wrap'
        )}
      >
        {options.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'whitespace-nowrap px-3 py-1.5 text-[12px] transition-colors',
              i > 0 && 'border-l border-b-border-strong',
              value === opt.value
                ? 'bg-b-blue-fg text-white'
                : 'bg-white text-b-2 hover:bg-[#f6f8fa] hover:text-b-1'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </BFieldWrap>
  )
}

// ─── 2-col grid for korte felter (dato + dropdown side om side) ────────────

export function BFieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}
