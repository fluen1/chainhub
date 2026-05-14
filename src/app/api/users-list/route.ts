import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Returnerer liste af aktive brugere i org — bruges af CreateTaskForm + EditTaskDialog
export async function GET() {
  const session = await auth()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: {
      organization_id: session.user.organizationId,
      active: true,
      deleted_at: null,
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return Response.json({ users })
}
