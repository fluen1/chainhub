// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/db'
import { extractDocumentPoc } from '@/lib/ai/jobs/extract-document-poc'

const FIXTURE_PATH = join(__dirname, '..', 'fixtures', 'test-contract.pdf')

const runIntegration =
  !!process.env.ANTHROPIC_API_KEY && (!!process.env.DIRECT_URL || !!process.env.DATABASE_URL)

describe.skipIf(!runIntegration)('extractDocumentPoc integration', () => {
  let testDocumentId: string
  let testOrganizationId: string

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: 'Test AI PoC Org', cvr: '99999999' },
    })
    testOrganizationId = org.id
    const doc = await prisma.document.create({
      data: {
        organization_id: testOrganizationId,
        title: 'Test PoC Document',
        file_url: 'test://poc',
        file_name: 'test-contract.pdf',
        file_size_bytes: 1024,
        file_type: 'application/pdf',
        uploaded_by: 'system',
      },
    })
    testDocumentId = doc.id
  }, 30_000)

  afterAll(async () => {
    await prisma.documentExtraction.deleteMany({ where: { document_id: testDocumentId } })
    await prisma.document.delete({ where: { id: testDocumentId } })
    await prisma.organization.delete({ where: { id: testOrganizationId } })
  }, 30_000)

  it('extracts summary from test PDF and stores in DB', async () => {
    const pdfBuffer = readFileSync(FIXTURE_PATH)
    const result = await extractDocumentPoc({
      document_id: testDocumentId,
      organization_id: testOrganizationId,
      file_buffer_base64: pdfBuffer.toString('base64'),
      filename: 'test-contract.pdf',
    })

    expect(result.extraction_id).toBeTruthy()
    expect(result.summary.length).toBeGreaterThan(0)
    expect(result.input_tokens).toBeGreaterThan(0)
    expect(result.output_tokens).toBeGreaterThan(0)
    expect(result.cost_usd).toBeGreaterThan(0)
    expect(result.cost_usd).toBeLessThan(0.05)

    const extraction = await prisma.documentExtraction.findUnique({
      where: { id: result.extraction_id },
    })
    expect(extraction).toBeTruthy()
    expect(extraction?.document_id).toBe(testDocumentId)
    expect(extraction?.organization_id).toBe(testOrganizationId)
    expect(extraction?.model_name).toContain('claude')
    expect(extraction?.extraction_status).toBe('completed')
  }, 60_000)
})
