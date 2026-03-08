'use client'

import { useState } from 'react'
import { OwnershipWithRelations } from '@/types/company'
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

interface OwnershipSectionProps {
  companyId: string
  ownerships: OwnershipWithRelations[]
  canEdit: boolean
}

export function OwnershipSection({
  companyId,
  ownerships,
  canEdit,
}: OwnershipSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOwnership, setEditingOwnership] = useState<OwnershipWithRelations | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalOwnership = ownerships.reduce(
    (sum, o) => sum + Number(o.ownershipPct),
    0
  )

  async function handleDelete(id: string) {
    const result = await deleteOwnership(id)
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
              {ownerships.map((ownership) => (
                <div
                  key={ownership.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {ownership.ownerPersonId ? (
                      <Users className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Building2 className="h-5 w-5 text-purple-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {ownership.ownerPerson
                          ? `${ownership.ownerPerson.firstName} ${ownership.ownerPerson.lastName}`
                          : ownership.ownerCompanyId || 'Ukendt ejer'}
                      </p>
                      <div className="flex gap-2 text-sm text-gray-500">
                        <span>{Number(ownership.ownershipPct).toFixed(2)}%</span>
                        {ownership.shareClass && (
                          <Badge variant="outline">{ownership.shareClass}</Badge>
                        )}
                        {ownership.effectiveDate && (
                          <span>
                            fra {new Date(ownership.effectiveDate).toLocaleDateString('da-DK')}
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
                          setEditingOwnership(ownership)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingId(ownership.id)}
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

      <OwnershipDialog
        companyId={companyId}
        ownership={editingOwnership}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditingOwnership(null)
        }}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet ejerskab</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette dette ejerskab? Handlingen kan
              ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function OwnershipSectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}