import { stringify } from 'csv-stringify/sync'

export interface CsvColumn<T> {
  key: keyof T | string
  header: string
  /** Custom formatter for værdien. Default: String(value) */
  format?: (value: unknown, row: T) => string
}

export interface ToCsvOptions<T> {
  columns: CsvColumn<T>[]
}

/**
 * Serialisér rows til CSV-string (med header). Escaper automatisk kommas, quotes, newlines.
 * Returnerer tom-linje hvis rows er tom.
 */
export async function toCsvString<T extends Record<string, unknown>>(
  rows: T[],
  options: ToCsvOptions<T>
): Promise<string> {
  const { columns } = options
  const headerRow = columns.map((c) => c.header)
  const dataRows = rows.map((row) =>
    columns.map((col) => {
      const value = row[col.key as keyof T]
      if (value === null || value === undefined) return ''
      if (col.format) return col.format(value, row)
      if (value instanceof Date) return value.toISOString()
      return String(value)
    })
  )
  return stringify([headerRow, ...dataRows], {
    bom: true, // UTF-8 BOM så Excel åbner æøå korrekt
  })
}

export async function toCsvBuffer<T extends Record<string, unknown>>(
  rows: T[],
  options: ToCsvOptions<T>
): Promise<Buffer> {
  const csv = await toCsvString(rows, options)
  return Buffer.from(csv, 'utf-8')
}
