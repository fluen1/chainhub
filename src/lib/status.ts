import { prisma } from '@/lib/db'

export type ComponentStatus = 'operational' | 'degraded' | 'down'

export interface StatusComponent {
  name: string
  status: ComponentStatus
}

export interface SystemStatus {
  overall: ComponentStatus
  components: StatusComponent[]
  checkedAt: string
}

async function checkDatabase(): Promise<ComponentStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return 'operational'
  } catch {
    return 'down'
  }
}

function deriveOverall(components: StatusComponent[]): ComponentStatus {
  if (components.some((c) => c.status === 'down')) return 'down'
  if (components.some((c) => c.status === 'degraded')) return 'degraded'
  return 'operational'
}

/**
 * Live-status for de komponenter vi reelt overvåger. Applikationen er per
 * definition oppe når denne kode kører; databasen tjekkes med en let `SELECT 1`.
 * Betalinger/AI er bevidst undladt — de er staged-slukket, ikke nedbrudte, og
 * ville vildlede på en status-side.
 */
export async function getSystemStatus(now: Date = new Date()): Promise<SystemStatus> {
  const components: StatusComponent[] = [
    { name: 'Applikation', status: 'operational' },
    { name: 'Database', status: await checkDatabase() },
  ]
  return {
    overall: deriveOverall(components),
    components,
    checkedAt: now.toISOString(),
  }
}
