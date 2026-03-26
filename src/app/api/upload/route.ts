import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const companyId = formData.get('companyId') as string | null
  const caseId = formData.get('caseId') as string | null
  const title = formData.get('title') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Ingen fil valgt' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Filen er for stor (max 10 MB)' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Filtypen er ikke tilladt (PDF, DOCX, PNG, JPG)' },
      { status: 400 }
    )
  }

  // Permission check if company specified
  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Ingen adgang til dette selskab' }, { status: 403 })
    }
  }

  const documentId = randomUUID()
  const orgId = session.user.organizationId
  const uploadDir = join(process.cwd(), 'uploads', orgId, documentId)
  await mkdir(uploadDir, { recursive: true })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const filePath = join(uploadDir, file.name)
  await writeFile(filePath, buffer)

  // Save to database
  const document = await prisma.document.create({
    data: {
      id: documentId,
      organization_id: orgId,
      company_id: companyId || null,
      case_id: caseId || null,
      title: title || file.name,
      file_url: `/api/uploads/${orgId}/${documentId}/${encodeURIComponent(file.name)}`,
      file_name: file.name,
      file_size_bytes: file.size,
      file_type: file.type,
      uploaded_by: session.user.id,
    },
  })

  return NextResponse.json({ data: document })
}
