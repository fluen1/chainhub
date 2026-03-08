'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Edit,
  Trash2,
  Plus,
  Calendar,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PersonWithCompanies } from '@/types/person'
import { deletePerson } from '@/actions/persons'
import { PersonEditDialog } from './PersonEditDialog'
import { LinkToCompanyDialog } from './LinkToCompanyDialog'
import { formatDate } from '@/lib/utils'

interface PersonDetailProps {
  person: PersonWithCompanies
}

export function PersonDetail({ person }: PersonDetailProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)

  const initials = `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()

  const activeRoles = person.companyPersons.filter(
    (cp) => !cp.endDate || new Date(cp.endDate) > new Date()
  )
  const historicalRoles = person.companyPersons.filter(
    (cp) => cp.endDate && new Date(cp.endDate) <= new Date()
  )

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deletePerson(person.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Personen blev slettet')
      router.push('/persons')
    } catch {
      toast.error('Der opstod en fejl — prøv igen')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/persons">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {person.firstName} {person.lastName}
              </h1>
              {person.email && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Mail className="h-4 w-4" />
                  <a
                    href={`mailto:${person.email}`}
                    className="hover:text-blue-600"
                  >
                    {person.email}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Rediger
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-600 hover:text-red-700">
                <Trash2 className="mr-2 h-4 w-4" />
                Slet
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                <AlertDialogDescription>
                  {person.companyPersons.length > 0
                    ? `Denne person er tilknyttet ${person.companyPersons.length} selskab(er). Personen vil blive markeret som slettet, men historikken bevares.`
                    : 'Denne handling kan ikke fortrydes.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuller</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Sletter...' : 'Slet person'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kontaktinformation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kontaktinformation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {person.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">E-mail</p>
                  <a
                    href={`mailto:${person.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {person.email}
                  </a>
                </div>
              </div>
            )}
            {person.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Telefon</p>
                  <a
                    href={`tel:${person.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {person.phone}
                  </a>
                </div>
              </div>
            )}
            {!person.email && !person.phone && (
              <p className="text-sm text-gray-500">
                Ingen kontaktinformation tilføjet
              </p>
            )}
            {person.notes && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500">Noter</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{person.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aktive roller */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Selskabstilknytninger</CardTitle>
              <CardDescription>
                Aktive roller på tværs af selskaber
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowLinkDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tilknyt selskab
            </Button>
          </CardHeader>
          <CardContent>
            {activeRoles.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-8">
                <Building2 className="h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Ingen aktive selskabstilknytninger
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowLinkDialog(true)}
                >
                  Tilknyt til et selskab
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeRoles.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <Link
                          href={`/companies/${cp.company.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {cp.company.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{cp.role}</Badge>
                          {cp.employmentType && (
                            <Badge variant="outline">{cp.employmentType}</Badge>
                          )}
                        </div>
                        {cp.startDate && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            Fra {formatDate(cp.startDate)}
                          </p>
                        )}
                      </div>
                    </div>
                    {cp.contract && (
                      <Link href={`/contracts/${cp.contract.id}`}>
                        <Button variant="ghost" size="sm">
                          <FileText className="mr-2 h-4 w-4" />
                          Se kontrakt
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Historiske roller */}
            {historicalRoles.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <h4 className="mb-3 text-sm font-medium text-gray-700">
                  Tidligere tilknytninger
                </h4>
                <div className="space-y-2">
                  {historicalRoles.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{cp.company.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {cp.role}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {cp.startDate && formatDate(cp.startDate)} –{' '}
                        {cp.endDate && formatDate(cp.endDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <PersonEditDialog
        person={person}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <LinkToCompanyDialog
        personId={person.id}
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
      />
    </div>
  )
}