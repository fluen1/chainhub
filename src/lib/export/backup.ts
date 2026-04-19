import archiver from 'archiver'
import { Readable } from 'stream'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('backup')

/**
 * Samler alle org-scope tabeller + returnerer zip-stream.
 *
 * Streamer sekventielt for at undgå memory-spike. For store orgs (>100MB):
 * kør async via pg-boss — ikke implementeret i v1.
 *
 * Format: JSON-fil per tabel + manifest.json. Alle tabeller er scoped på
 * organization_id (undtagen `organizations` der filtreres på id). Relationer
 * bevares via foreign key IDs.
 */
export async function createOrganizationBackupStream(organizationId: string): Promise<Readable> {
  log.info({ organizationId }, 'Starting backup')

  const archive = archiver('zip', { zlib: { level: 9 } })

  // 19 kritiske org-scope tabeller
  const tables: Array<{ name: string; fetch: () => Promise<unknown[]> }> = [
    {
      name: 'organizations',
      fetch: () => prisma.organization.findMany({ where: { id: organizationId } }),
    },
    {
      name: 'companies',
      fetch: () => prisma.company.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'persons',
      fetch: () => prisma.person.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'contracts',
      fetch: () => prisma.contract.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'contract_parties',
      fetch: () => prisma.contractParty.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'contract_versions',
      fetch: () => prisma.contractVersion.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'company_persons',
      fetch: () => prisma.companyPerson.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'ownerships',
      fetch: () => prisma.ownership.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'cases',
      fetch: () => prisma.case.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'case_companies',
      fetch: () => prisma.caseCompany.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'case_persons',
      fetch: () => prisma.casePerson.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'tasks',
      fetch: () => prisma.task.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'task_history',
      fetch: () => prisma.taskHistory.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'comments',
      fetch: () => prisma.comment.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'visits',
      fetch: () => prisma.visit.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'documents',
      fetch: () => prisma.document.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'financial_metrics',
      fetch: () => prisma.financialMetric.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'deadlines',
      fetch: () => prisma.deadline.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'audit_log',
      fetch: () => prisma.auditLog.findMany({ where: { organization_id: organizationId } }),
    },
  ]

  // Asynkront: fetch + append sekventielt for at undgå memory-spike
  void (async () => {
    try {
      for (const t of tables) {
        const rows = await t.fetch()
        const json = JSON.stringify(rows, null, 2)
        archive.append(json, { name: `${t.name}.json` })
        log.debug({ table: t.name, count: rows.length }, 'Added to backup')
      }
      archive.append(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            organizationId,
            format: 'chainhub-backup-v1',
            tableCount: tables.length,
            note: 'Full organization backup. Alle tabeller scoped på organization_id. JSON-format bevarer relationer via foreign key IDs.',
          },
          null,
          2
        ),
        { name: 'manifest.json' }
      )
      await archive.finalize()
    } catch (err) {
      log.error({ err }, 'Backup failed')
      archive.abort()
    }
  })()

  return archive as unknown as Readable
}
