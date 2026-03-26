import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'

export interface ExpiringContract {
  id: string
  displayName: string
  companyName: string
  expiryDate: Date
  daysUntilExpiry: number
}

export interface OverdueTask {
  id: string
  title: string
  dueDate: Date
  daysOverdue: number
  caseTitle: string | null
}

export interface UpcomingTask {
  id: string
  title: string
  dueDate: Date
  daysUntilDue: number
  caseTitle: string | null
}

export async function getExpiringContracts(
  organizationId: string,
  userId: string,
  daysAhead: number[]
): Promise<Record<number, ExpiringContract[]>> {
  const companyIds = await getAccessibleCompanies(userId, organizationId)
  if (companyIds.length === 0) return {}

  const today = new Date()
  const maxDays = Math.max(...daysAhead)
  const limit = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000)

  const contracts = await prisma.contract.findMany({
    where: {
      organization_id: organizationId,
      company_id: { in: companyIds },
      deleted_at: null,
      status: 'AKTIV',
      expiry_date: { not: null, lte: limit, gte: today },
    },
    include: { company: { select: { name: true } } },
    orderBy: { expiry_date: 'asc' },
  })

  const result: Record<number, ExpiringContract[]> = {}
  for (const days of daysAhead) {
    const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    result[days] = contracts
      .filter((c) => c.expiry_date && c.expiry_date <= threshold)
      .map((c) => ({
        id: c.id,
        displayName: c.display_name,
        companyName: c.company.name,
        expiryDate: c.expiry_date!,
        daysUntilExpiry: Math.ceil(
          (c.expiry_date!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }))
  }
  return result
}

export async function getOverdueTasks(
  organizationId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: string
): Promise<OverdueTask[]> {
  const today = new Date()
  const tasks = await prisma.task.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: { not: 'LUKKET' },
      due_date: { lt: today },
    },
    include: { case: { select: { title: true } } },
    orderBy: { due_date: 'asc' },
    take: 20,
  })

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.due_date!,
    daysOverdue: Math.ceil(
      (today.getTime() - t.due_date!.getTime()) / (1000 * 60 * 60 * 24)
    ),
    caseTitle: t.case?.title ?? null,
  }))
}

export async function getUpcomingTasks(
  organizationId: string,
  _userId: string,
  daysAhead: number
): Promise<UpcomingTask[]> {
  const today = new Date()
  const limit = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)

  const tasks = await prisma.task.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: { not: 'LUKKET' },
      due_date: { gte: today, lte: limit },
    },
    include: { case: { select: { title: true } } },
    orderBy: { due_date: 'asc' },
    take: 20,
  })

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.due_date!,
    daysUntilDue: Math.ceil(
      (t.due_date!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    ),
    caseTitle: t.case?.title ?? null,
  }))
}
