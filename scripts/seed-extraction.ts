import type { Prisma } from '@prisma/client'
import { prisma } from '../src/lib/db'

async function main() {
  const doc = await prisma.document.findFirst({
    where: { file_name: 'ejeraftale-osterbro.pdf' },
  })
  if (!doc) {
    console.error('Document not found')
    process.exit(1)
  }
  console.log('Found document:', doc.id, doc.file_name)

  const existing = await prisma.documentExtraction.findUnique({
    where: { document_id: doc.id },
    select: { id: true },
  })
  if (existing) {
    await prisma.aIFieldCorrection.deleteMany({ where: { extraction_id: existing.id } })
    await prisma.documentExtraction.delete({ where: { id: existing.id } })
  }

  const field = (value: unknown, confidence: number, page: number, text: string) => ({
    value,
    claude_confidence: confidence,
    source_page: page,
    source_paragraph: `Side ${page}`,
    source_text: text,
  })

  const extracted_fields = {
    parties: field(
      [
        {
          name: 'TandlægeGruppen Holding ApS',
          party_type: 'KAEDE_GRUPPE',
          capital_pct: 55,
          voting_pct: 55,
          ownership_type: 'DIRECT',
        },
        {
          name: 'Dr. Anne Mortensen',
          party_type: 'LOKAL_PARTNER',
          capital_pct: 45,
          voting_pct: 45,
          ownership_type: 'DIRECT',
        },
      ],
      0.95,
      1,
      'Mellem TandlægeGruppen Holding ApS (55%) og Dr. Anne Mortensen (45%)...'
    ),
    effective_date: field('2024-01-15', 0.98, 1, 'Aftalen træder i kraft den 15. januar 2024'),
    expiry_date: field(null, 0.7, 2, 'Aftalen er tidsubegrænset'),
    governing_law: field('Dansk ret', 0.99, 8, 'Aftalen er underlagt dansk ret'),
    notice_period_months: field(6, 0.92, 5, 'Opsigelsesvarsel på 6 måneder'),
    drag_along_threshold_pct: field(75, 0.88, 4, 'Drag-along ved 75% accept'),
    tag_along_enabled: field(true, 0.85, 4, 'Tag-along ret gælder for minoritetsejere'),
    arbitration_venue: field('København', 0.6, 8, 'Tvister afgøres ved voldgift i København'),
    company_name: field('Tandlæge Østerbro ApS', 0.99, 1, 'Tandlæge Østerbro ApS, CVR 87654321'),
  }

  const extraction = await prisma.documentExtraction.create({
    data: {
      document_id: doc.id,
      organization_id: doc.organization_id,
      detected_type: 'EJERAFTALE',
      type_confidence: 0.97,
      schema_version: 'v1.0.0',
      prompt_version: 'mock-v1',
      model_name: 'gpt-5-mini',
      model_temperature: 0.0,
      extracted_fields: extracted_fields as unknown as Prisma.InputJsonValue,
      raw_response: { mocked: true, reason: 'manuelt indsat til review-UI test' },
      input_tokens: 0,
      output_tokens: 0,
      total_cost_usd: 0,
      extraction_status: 'completed',
    },
  })
  console.log('Created extraction:', extraction.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
