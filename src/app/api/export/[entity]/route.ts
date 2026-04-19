import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { fetchEntityForExport, type ExportableEntity } from '@/lib/export/entities'
import { toCsvBuffer } from '@/lib/export/csv'
import { captureError } from '@/lib/logger'

const VALID_ENTITIES: ExportableEntity[] = [
  'companies',
  'contracts',
  'cases',
  'tasks',
  'persons',
  'visits',
]

function isValidEntity(value: string): value is ExportableEntity {
  return (VALID_ENTITIES as string[]).includes(value)
}

export async function GET(
  _req: Request,
  { params }: { params: { entity: string } }
): Promise<Response> {
  const session = await auth()
  if (!session) {
    return Response.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  const canExport = await canAccessModule(session.user.id, 'settings')
  if (!canExport) {
    return Response.json({ error: 'Kun admin kan eksportere data' }, { status: 403 })
  }

  const { entity } = params
  if (!isValidEntity(entity)) {
    return Response.json({ error: 'Ugyldig entity' }, { status: 400 })
  }

  try {
    const { filename, rows, columns } = await fetchEntityForExport(entity, {
      organizationId: session.user.organizationId,
    })
    const buffer = await toCsvBuffer(rows, { columns })
    // Konvertér Node Buffer → Uint8Array for web-standard Response-body.
    const body = new Uint8Array(buffer)

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    captureError(err, {
      namespace: 'api:export',
      extra: { entity },
    })
    return Response.json({ error: 'Eksport fejlede' }, { status: 500 })
  }
}
