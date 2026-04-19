import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { gdprExportPerson } from '@/lib/export/gdpr'
import { captureError } from '@/lib/logger'
import { NextResponse, type NextRequest } from 'next/server'

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

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) {
    return NextResponse.json({ error: 'Kun admin' }, { status: 403 })
  }

  try {
    const data = await gdprExportPerson(params.personId, session.user.organizationId)
    if (!data) {
      return NextResponse.json({ error: 'Person ikke fundet' }, { status: 404 })
    }

    const json = JSON.stringify(data, null, 2)
    const filename = `gdpr-export-${params.personId}-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    captureError(err, { namespace: 'api:gdpr-export' })
    return NextResponse.json({ error: 'GDPR-eksport fejlede' }, { status: 500 })
  }
}
