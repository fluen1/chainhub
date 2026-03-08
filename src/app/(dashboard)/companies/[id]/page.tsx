import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCompany } from '@/actions/companies'
import { canEdit as checkCanEdit } from '@/lib/permissions'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building2, Pencil, FileText, Calendar, MapPin } from 'lucide-react'
import { OwnershipSection, OwnershipSectionSkeleton } from '@/components/companies/OwnershipSection'
import { GovernanceSection, GovernanceSectionSkeleton } from '@/components/companies/GovernanceSection'
import { EmployeesSection, EmployeesSectionSkeleton } from '@/components/companies/EmployeesSection'
import { ActivityLog, ActivityLogSkeleton } from '@/components/companies/ActivityLog'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const result = await getCompany(params.id)
  if (result.error) {
    return { title: 'Selskab ikke fundet | ChainHub' }
  }
  return { title: `${result.data.name} | ChainHub` }
}

const statusLabels: Record<string, string> = {
  aktiv: 'Aktiv',
  inaktiv: 'Inaktiv',
  under_stiftelse: 'Under stiftelse',
  opløst: 'Opløst',
}

const statusColors: Record<string, string> = {
  aktiv: 'bg-green-100 text-green-800',
  inaktiv: 'bg-gray-100 text-gray-800',
  under_stiftelse: 'bg-yellow-100 text-yellow-800',
  opløst: 'bg-red-100 text-red-800',
}

async function CompanyContent({ id }: { id: string }) {
  const session = await auth()
  if (!session?.user?.id) {
    return notFound()
  }

  const result = await getCompany(id)
  if (result.error) {
    return notFound()
  }

  const company = result.data
  const canEditCompany = await checkCanEdit(session.user.id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
            <Building2 className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <Badge className={statusColors[company.status] || 'bg-gray-100'}>
                {statusLabels[company.status] || company.status}
              </Badge>
            </div>
            {company.cvr && (
              <p className="text-gray-500">CVR: {company.cvr}</p>
            )}
            {company.companyType && (
              <p className="text-sm text-gray-500">{company.companyType}</p>
            )}
          </div>
        </div>
        {canEditCompany && (
          <Link href={`/companies/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              Rediger
            </Button>
          </Link>
        )}
      </div>

      {/* Stamdata kort */}
      <Card>
        <CardHeader>
          <CardTitle>Stamdata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(company.address || company.city) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  {company.address && <p>{company.address}</p>}
                  {(company.postalCode || company.city) && (
                    <p className="text-gray-500">
                      {company.postalCode} {company.city}
                    </p>
                  )}
                </div>
              </div>
            )}
            {company.foundedDate && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Stiftet</p>
                  <p>
                    {new Date(company.foundedDate).toLocaleDateString('da-DK')}
                  </p>
                </div>
              </div>
            )}
            {company.contracts.length > 0 && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Kontrakter</p>
                  <p>{company.contracts.length} aktive</p>
                </div>
              </div>
            )}
          </div>
          {company.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-1">Noter</p>
              <p className="text-gray-700 whitespace-pre-wrap">{company.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="ownership" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ownership">Ejerskab</TabsTrigger>
          <TabsTrigger value="governance">Ledelse</TabsTrigger>
          <TabsTrigger value="employees">Ansatte</TabsTrigger>
          <TabsTrigger value="activity">Aktivitet</TabsTrigger>
        </TabsList>

        <TabsContent value="ownership">
          <Suspense fallback={<OwnershipSectionSkeleton />}>
            <OwnershipSection
              companyId={id}
              ownerships={company.ownerships}
              canEdit={canEditCompany}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="governance">
          <Suspense fallback={<GovernanceSectionSkeleton />}>
            <GovernanceSection
              companyId={id}
              persons={company.companyPersons}
              canEdit={canEditCompany}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="employees">
          <Suspense fallback={<EmployeesSectionSkeleton />}>
            <EmployeesSection
              companyId={id}
              persons={company.companyPersons}
              canEdit={canEditCompany}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="activity">
          <Suspense fallback={<ActivityLogSkeleton />}>
            <ActivityLog companyId={id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function CompanyPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      }
    >
      <CompanyContent id={params.id} />
    </Suspense>
  )
}