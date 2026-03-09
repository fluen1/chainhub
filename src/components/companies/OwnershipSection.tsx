'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Users, Building2 } from 'lucide-react'
import { OwnershipDialog } from './OwnershipDialog'
import { deleteOwnership } from '@/actions/companies'
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

interface OwnerPerson {
  id: string
  firstName: string
  lastName: string
}

interface OwnerCompany {
  id: string
  name: string
}

interface OwnershipItem {
  id: string
  ownerPersonId: string | null
  ownerCompanyId: string | null
  ownershipPct: number | string
  shareClass: string | null
  effectiveDate: string | null
  contractId: string | null
  ownerPerson: OwnerPerson | null
  ownerCompany: OwnerCompany | null
}

interface OwnershipSectionProps {
  companyId: string
  ownerships: OwnershipItem[]
  canEdit: boolean
}

export function OwnershipSection({
  companyId,
  ownerships,
  canEdit,
}: OwnershipSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOwnership, setEditingOwnership] = useState<OwnershipItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalOwnership = ownerships.reduce(
    (sum, o) => sum + Number(o.ownershipPct),
    0
  )

  async function handleDelete(id: string) {
    const result = await deleteOwnership({ id })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Ejerskab slettet')
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
              Ejerskab
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Samlet ejerskab: {totalOwnership.toFixed(2)}%
              {totalOwnership !== 100 && (
                <Badge variant="outline" className="ml-2 text-yellow-600">
                  Ikke 100%
                </Badge>
              )}
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Tilføj ejer
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {ownerships.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Ingen ejere registreret endnu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ownerships.map((ownership) => {
                const ownerName = ownership.ownerPerson
                  ? `${ownership.ownerPerson.firstName} ${ownership.ownerPerson.lastName}`
                  : ownership.ownerCompany
                  ? ownership.ownerCompany.name
                  : 'Ukendt ejer'
                const Icon = ownership.ownerPersonId ? Users : Building2

                return (
                  <div
                    key={ownership.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{ownerName}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{Number(ownership.ownershipPct).toFixed(2)}%</span>
                          {ownership.shareClass && (
                            <Badge variant="outline" className="text-xs">
                              {ownership.shareClass}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingOwnership(ownership)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(ownership.id)}
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

      <OwnershipDialog
        companyId={companyId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />

      {editingOwnership && (
        <OwnershipDialog
          companyId={companyId}
          ownership={editingOwnership}
          open={!!editingOwnership}
          onOpenChange={(open) => { if (!open) setEditingOwnership(null) }}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet ejerskab</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette dette ejerskab? Dette kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && handleDelete(deletingId)}>
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}