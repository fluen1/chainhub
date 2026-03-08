import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id || !session?.user?.organizationId) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  try {
    const companies = await getAccessibleCompanies(session.user.id)
    return NextResponse.json(companies)
  } catch (error) {
    console.error('Fejl ved hentning af selskaber:', error)
    return NextResponse.json(
      { error: 'Selskaber kunne ikke hentes' },
      { status: 500 }
    )
  }
}