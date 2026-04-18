import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadForExtraction, ContentLoaderError } from '@/lib/ai/content-loader'

const FIXTURES = join(__dirname, '..', 'fixtures')

describe('content-loader — Word og Excel', () => {
  describe('Excel (.xlsx)', () => {
    let xlsxBuffer: Buffer

    beforeAll(() => {
      xlsxBuffer = readFileSync(join(FIXTURES, 'test-contract.xlsx'))
    })

    it('indlæser xlsx og returnerer text_markdown', async () => {
      const result = await loadForExtraction(xlsxBuffer, 'test-contract.xlsx')
      expect(result.type).toBe('text_markdown')
      if (result.type !== 'text_markdown') return
      expect(result.detectedMime).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(result.markdown).toContain('## Ejerforhold')
    })

    it('indeholder tabelrækker med data fra arket', async () => {
      const result = await loadForExtraction(xlsxBuffer, 'test-contract.xlsx')
      if (result.type !== 'text_markdown') throw new Error('Forkert type')
      expect(result.markdown).toContain('Kædegruppen A/S')
      expect(result.markdown).toContain('51%')
      expect(result.markdown).toContain('Dr. Petersen')
    })

    it('markdown indeholder pipe-tabelformat', async () => {
      const result = await loadForExtraction(xlsxBuffer, 'test-contract.xlsx')
      if (result.type !== 'text_markdown') throw new Error('Forkert type')
      // Header-linje
      expect(result.markdown).toMatch(/\| Part \| Ejerandel \| Type \|/)
      // Separator-linje
      expect(result.markdown).toMatch(/\| --- \| --- \| --- \|/)
    })
  })

  describe('Word (.docx)', () => {
    const docxPath = join(FIXTURES, 'test-contract.docx')

    it('indlæser docx og returnerer text_html', async () => {
      if (!existsSync(docxPath)) {
        console.warn('Springer docx-test over — fixture mangler')
        return
      }
      const buffer = readFileSync(docxPath)
      const result = await loadForExtraction(buffer, 'test-contract.docx')
      expect(result.type).toBe('text_html')
      if (result.type !== 'text_html') return
      expect(result.detectedMime).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      expect(result.html.length).toBeGreaterThan(0)
    })

    it('html indeholder dokumentets tekst', async () => {
      if (!existsSync(docxPath)) return
      const buffer = readFileSync(docxPath)
      const result = await loadForExtraction(buffer, 'test-contract.docx')
      if (result.type !== 'text_html') throw new Error('Forkert type')
      expect(result.html).toContain('Ejeraftale')
    })
  })

  describe('Ikke-understøttede filtyper', () => {
    it('kaster ContentLoaderError for ukendt binær buffer', async () => {
      const garbage = Buffer.from('dette er ikke en fil')
      await expect(loadForExtraction(garbage, 'note.txt')).rejects.toThrow(ContentLoaderError)
    })

    it('kaster ContentLoaderError med reason unsupported_type', async () => {
      const garbage = Buffer.from('dette er ikke en fil')
      try {
        await loadForExtraction(garbage, 'note.txt')
      } catch (err) {
        expect(err).toBeInstanceOf(ContentLoaderError)
        if (err instanceof ContentLoaderError) {
          expect(err.reason).toBe('unsupported_type')
        }
      }
    })
  })
})
