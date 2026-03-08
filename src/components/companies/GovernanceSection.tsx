'use client'

import { useState } from 'react'
import { CompanyPersonWithRelations } from '@/types/company'
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
    const result = await deleteCompanyPerson(id)
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
                      <Icon className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium">
                          {cp.person.firstName} {cp.person.lastName}
                        </p>
                        <div className="flex gap-2 text-sm text-gray-500">
                          <Badge variant="secondary">
                            {roleLabels[cp.role.toLowerCase()] || cp.role}
                          </Badge>
                          {cp.startDate && (
                            <span>
                              fra {new Date(cp.startDate).toLocaleDateString('da-DK')}
                            </span>
                          )}
                          {cp.endDate && (
                            <span>
                              til {new Date(cp.endDate).toLocaleDateString('da-DK')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingPerson(cp)
                            setIsDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
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

      <CompanyPersonDialog
        companyId={companyId}
        companyPerson={editingPerson}
        roleType="governance"
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditingPerson(null)
        }}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern person</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil fjerne denne person fra ledelsen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function GovernanceSectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}