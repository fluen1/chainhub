import { describe, it, expect } from 'vitest'
import { toCsvString } from '@/lib/export/csv'

describe('toCsvString', () => {
  it('genererer CSV fra rows med header', async () => {
    const rows = [
      { id: '1', name: 'Acme', revenue: 1000 },
      { id: '2', name: 'Foo, Bar & Baz', revenue: 500 },
    ]
    const csv = await toCsvString(rows, {
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Navn' },
        { key: 'revenue', header: 'Omsætning' },
      ],
    })
    expect(csv).toContain('ID,Navn,Omsætning\n')
    expect(csv).toContain('1,Acme,1000')
    // Kommaer i data skal escape'es
    expect(csv).toContain('"Foo, Bar & Baz"')
  })

  it('bruger custom formatter pr. kolonne', async () => {
    const rows = [{ d: new Date('2026-01-15T12:00:00Z') }]
    const csv = await toCsvString(rows, {
      columns: [
        {
          key: 'd',
          header: 'Dato',
          format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)),
        },
      ],
    })
    expect(csv).toContain('Dato\n')
    expect(csv).toContain('2026-01-15')
  })

  it('håndterer null-værdier som tom streng', async () => {
    const rows = [{ name: 'Acme', notes: null }]
    const csv = await toCsvString(rows, {
      columns: [
        { key: 'name', header: 'Navn' },
        { key: 'notes', header: 'Noter' },
      ],
    })
    expect(csv).toMatch(/Acme,\s*$/m)
  })

  it('escaper newlines og quotes i data', async () => {
    const rows = [{ text: 'Line 1\nLine 2 with "quote"' }]
    const csv = await toCsvString(rows, {
      columns: [{ key: 'text', header: 'Tekst' }],
    })
    // csv-stringify kvoterer automatisk og double-escaper quotes
    expect(csv).toContain('"Line 1\nLine 2 with ""quote"""')
  })
})
