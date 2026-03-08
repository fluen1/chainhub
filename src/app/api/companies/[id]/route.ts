import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  
  if (!session?.user?.id || !session?.user?.organizationId) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })
  }

  try {
    const company = await prisma.company.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        ownerships: {
          include: {
            ownerPerson: true,
          },
        },
        companyPersons: {
          include: {
            person: true,
          },
        },
        _count: {
          select: {
            contracts: { where: { deletedAt: null } },
            caseCompanies: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Selskab ikke fundet' }, { status: 404 })
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error('Fejl ved hentning af selskab:', error)
    return NextResponse.json(
      { error: 'Selskab kunne ikke hentes' },
      { status: 500 }
    )
  }
}