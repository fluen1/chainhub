import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { createOrganizationBackupStream } from '@/lib/export/backup'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'
import { NextResponse } from 'next/server'

/**
 * GET /api/export/backup
 * Streamer ZIP med alle org-scope tabeller som JSON-filer. Kræver admin
 * (GROUP_OWNER eller GROUP_ADMIN). Logger BACKUP-handling i AuditLog.
 */
export async function GET(): Promise<Response> {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) {
    return NextResponse.json({ error: 'Kun admin' }, { status: 403 })
  }

  try {
    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'BACKUP',
      resourceType: 'organization',
      resourceId: session.user.organizationId,
      sensitivity: 'FORTROLIG',
      changes: { reason: 'Full backup download' },
    })

    const stream = await createOrganizationBackupStream(session.user.organizationId)
    const filename = `chainhub-backup-${new Date().toISOString().slice(0, 10)}.zip`

    return new NextResponse(stream as never, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    captureError(err, { namespace: 'api:backup' })
    return NextResponse.json({ error: 'Backup fejlede' }, { status: 500 })
  }
}
