import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { getStorageProvider } from '@/lib/storage'

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  // Validate the path belongs to user's organization
  const [orgId] = params.path
  if (orgId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })
  }

  // Decode each segment to handle encoded filenames
  const decodedSegments = params.path.map((segment) => decodeURIComponent(segment))
  const key = decodedSegments.join('/')

  const data = await getStorageProvider().download(key)
  if (!data) {
    return NextResponse.json({ error: 'Fil ikke fundet' }, { status: 404 })
  }

  const lastSegment = decodedSegments[decodedSegments.length - 1] ?? ''
  const ext = lastSegment.split('.').pop()?.toLowerCase()
  // Cast Buffer → Uint8Array for NextResponse BodyInit compatibility
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': CONTENT_TYPES[ext ?? ''] ?? 'application/octet-stream',
    },
  })
}
