import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const startTime = Date.now()

  let databaseStatus: 'connected' | 'error' = 'error'
  let databaseLatencyMs: number | null = null

  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    databaseLatencyMs = Date.now() - dbStart
    databaseStatus = 'connected'
  } catch {
    databaseStatus = 'error'
  }

  const totalLatencyMs = Date.now() - startTime
  const isHealthy = databaseStatus === 'connected'

  const body = {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: databaseStatus,
    latency: {
      database_ms: databaseLatencyMs,
      total_ms: totalLatencyMs,
    },
    version: process.env.npm_package_version ?? 'unknown',
  }

  return Response.json(body, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}