import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { gdprExportPerson } from '@/lib/export/gdpr'
import { captureError } from '@/lib/logger'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { recordAuditEvent } from '@/lib/audit'

/**
 * GET /api/export/gdpr/[personId]
 * Streamer GDPR Article 15 JSON-bundle for én person. Kræver admin.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { personId: string } }
): Promise<Response> {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  // Zod UUID-validering — forhindrer injection og giver klar fejlbesked
  const uuidResult = z.string().uuid().safeParse(params.personId)
  if (!uuidResult.success) {
    return NextResponse.json({ error: 'Ugyldigt person-ID format' }, { status: 400 })
  }
  const personId = uuidResult.data

  const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Kun admin' }, { status: 403 })
  }

  // Audit: log GDPR-eksport FØR data hentes — sporbart selv ved fejl
  await recordAuditEvent({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: 'GDPR_EXPORT',
    resourceType: 'PERSON',
    resourceId: personId,
    sensitivity: 'FORTROLIG',
  })

  try {
    const data = await gdprExportPerson(personId, session.user.organizationId)
    if (!data) {
      return NextResponse.json({ error: 'Person ikke fundet' }, { status: 404 })
    }

    const json = JSON.stringify(data, null, 2)
    const rawFilename = `gdpr-export-${personId}-${new Date().toISOString().slice(0, 10)}.json`
    // RFC 5987 encoding — backwards-compat filename + UTF-8 filename* header
    const encodedFilename = encodeURIComponent(rawFilename)

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${rawFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    captureError(err, { namespace: 'api:gdpr-export' })
    return NextResponse.json({ error: 'GDPR-eksport fejlede' }, { status: 500 })
  }
}
