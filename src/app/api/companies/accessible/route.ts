import { auth } from '@/lib/auth'
import { getAccessibleCompanies } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  try {
    const companies = await getAccessibleCompanies(session.user.id)
    return NextResponse.json({
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
    })
  } catch (error) {
    console.error('GET /api/companies/accessible error:', error)
    return NextResponse.json(
      { error: 'Selskaberne kunne ikke hentes' },
      { status: 500 }
    )
  }
}