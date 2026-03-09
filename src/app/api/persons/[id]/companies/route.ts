import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  try {
    // Bekræft at person tilhører organisationen
    const person = await prisma.person.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!person) {
      return NextResponse.json(
        { error: 'Personen blev ikke fundet' },
        { status: 404 }
      )
    }

    // Hent alle selskaber personen er tilknyttet
    const companyPersons = await prisma.companyPerson.findMany({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            cvr: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filtrer baseret på adgang — kaldt for hvert selskab
    const accessChecks = await Promise.all(
      companyPersons.map(async (cp) => {
        const hasAccess = await canAccessCompany(session.user.id, cp.companyId)
        return { cp, hasAccess }
      })
    )

    const accessible = accessChecks
      .filter(({ hasAccess }) => hasAccess)
      .map(({ cp }) => ({
        companyid: cp.id,
        companyId: cp.companyId,
        companyName: cp.company.name,
        companyCvr: cp.company.cvr,
        companyStatus: cp.company.status,
        role: cp.role,
        employmentType: cp.employmentType,
        startDate: cp.startDate,
        endDate: cp.endDate,
      }))

    return NextResponse.json({ companies: accessible })
  } catch (error) {
    console.error('GET /api/persons/[id]/companies error:', error)
    return NextResponse.json(
      { error: 'Selskaberne kunne ikke hentes' },
      { status: 500 }
    )
  }
}
