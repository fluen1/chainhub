'use client'

import { useState } from 'react'
import { CompanyPersonWithRelations } from '@/types/company'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
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

interface EmployeesSectionProps {
  companyId: string
  persons: CompanyPersonWithRelations[]
  canEdit: boolean
}

const governanceRoles = ['direktør', 'bestyrelsesformand', 'bestyrelsesmedlem', 'revisor']

const employmentTypeLabels: Record<string, string> = {
  funktionær: 'Funktionær',
  'ikke-funktionær': 'Ikke-funktionær',
  vikar: 'Vikar',
  elev: 'Elev',
}

export function EmployeesSection({
  companyId,
  persons,
  canEdit,
}: EmployeesSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<CompanyPersonWithRelations | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const employees = persons.filter(
    (p) => !governanceRoles.includes(p.role.toLowerCase())
  )

  async function handleDelete(id: string) {
    const result = await deleteCompanyPerson({ id })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Medarbejder fjernet')
    }
    setDeletingId(null)
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ansatte
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {employees.length} medarbejder{employees.length !== 1 && 'e'}
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Tilføj ansat
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Ingen ansatte registreret endnu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((cp) => (
                <div
                  key={cp.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">
                        {cp.person
                          ? `${cp.person.firstName} ${cp.person.lastName}`
                          : 'Ukendt person'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {cp.role}
                        </Badge>
                        {cp.employmentType && (
                          <span className="text-xs text-gray-500">
                            {employmentTypeLabels[cp.employmentType] ?? cp.employmentType}
                          </span>
                        )}
                      </div>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyPersonDialog
        companyId={companyId}
        companyPerson={editingPerson}
        roleType="employee"
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditingPerson(null)
        }}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern medarbejder</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil fjerne denne medarbejder fra selskabet?
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