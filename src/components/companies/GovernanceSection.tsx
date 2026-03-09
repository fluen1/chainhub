'use client'

import { useState } from 'react'
import { CompanyWithRelations } from '@/types/company'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Crown, User } from 'lucide-react'
import { CompanyPersonDialog } from './CompanyPersonDialog'
import { deleteCompanyPerson } from '@/actions/companies'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type CompanyPersonWithRelations = CompanyWithRelations['persons'][number]

interface GovernanceSectionProps {
  companyId: string
  persons: CompanyPersonWithRelations[]
  canEdit: boolean
}

const governanceRoles = ['direktør', 'bestyrelsesformand', 'bestyrelsesmedlem', 'revisor']

const roleIcons: Record<string, typeof Crown> = {
  direktør: Crown,
  bestyrelsesformand: Crown,
  bestyrelsesmedlem: User,
  revisor: User,
}

const roleLabels: Record<string, string> = {
  direktør: 'Direktør',
  bestyrelsesformand: 'Bestyrelsesformand',
  bestyrelsesmedlem: 'Bestyrelsesmedlem',
  revisor: 'Revisor',
}

export function GovernanceSection({
  companyId,
  persons,
  canEdit,
}: GovernanceSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<CompanyPersonWithRelations | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const governancePersons = persons.filter((p) =>
    governanceRoles.includes(p.role.toLowerCase())
  )

  async function handleDelete(id: string) {
    const result = await deleteCompanyPerson({ id })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Person fjernet fra governance')
    }
    setDeletingId(null)
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Ledelse og governance
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Tilføj
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {governancePersons.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Crown className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Ingen ledelse registreret endnu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {governancePersons.map((cp) => {
                const Icon = roleIcons[cp.role.toLowerCase()] || User
                return (
                  <div
                    key={cp.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">
                          {cp.person
                            ? `${cp.person.firstName} ${cp.person.lastName}`
                            : 'Ukendt person'}
                        </p>
                        <Badge variant="outline" className="text-xs mt-0.5">
                          {roleLabels[cp.role.toLowerCase()] ?? cp.role}
                        </Badge>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPerson(cp)
                            setIsDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(cp.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isDialogOpen && (
        <CompanyPersonDialog
          companyId={companyId}
          person={editingPerson}
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) setEditingPerson(null)
          }}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern person</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil fjerne denne person fra governance?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && handleDelete(deletingId)}>
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}