import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCompanyDetailData } from '@/actions/company-detail'
import { CompanyHeader } from '@/components/company-detail/company-header'
import { AlertBanner } from '@/components/company-detail/alert-banner'
import { OwnershipSection } from '@/components/company-detail/ownership-section'
import { ContractsSection } from '@/components/company-detail/contracts-section'
import { FinanceSection } from '@/components/company-detail/finance-section'
import { CasesSection } from '@/components/company-detail/cases-section'
import { PersonsSection } from '@/components/company-detail/persons-section'
import { VisitsSection } from '@/components/company-detail/visits-section'
import { DocumentsSection } from '@/components/company-detail/documents-section'
import { AiInsightCard } from '@/components/company-detail/ai-insight-card'
import { EditStamdataDialog } from '@/components/company-detail/edit-stamdata-dialog'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const data = await getCompanyDetailData(params.id, session.user.id, session.user.organizationId)
  if (!data) notFound()

  const readOnly = data.role === 'GROUP_READONLY' || data.role === 'COMPANY_READONLY'

  return (
    <div className="mx-auto max-w-[1100px]">
      <nav className="mb-4 text-xs text-gray-500">
        <Link href="/companies" className="text-slate-500 no-underline hover:text-blue-600">
          Selskaber
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{data.company.name}</span>
      </nav>

      <CompanyHeader
        name={data.company.name}
        cvr={data.company.cvr}
        city={data.company.city}
        status={data.company.status}
        foundedYear={data.company.founded_date?.getFullYear() ?? null}
        statusBadge={data.statusBadge}
        healthDimensions={data.healthDimensions}
        showHealthDims={data.role !== 'COMPANY_MANAGER' && data.role !== 'COMPANY_READONLY'}
        editStamdataButton={
          <EditStamdataDialog
            companyId={data.company.id}
            initial={{
              name: data.company.name,
              cvr: data.company.cvr,
              address: data.company.address,
              city: data.company.city,
              postal_code: data.company.postal_code,
              founded_date: data.company.founded_date,
            }}
            disabled={readOnly}
          />
        }
        createTaskHref={`/tasks/new?company=${data.company.id}`}
        readOnly={readOnly}
      />

      {data.alerts.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {data.alerts.slice(0, 3).map((alert, i) => (
            <AlertBanner
              key={i}
              severity={alert.severity}
              title={alert.title}
              sub={alert.sub}
              actionLabel={alert.action_label}
              actionHref={alert.action_href}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {data.visibleSections.has('ownership') && <OwnershipSection data={data.ownership} />}
        {data.visibleSections.has('contracts') && (
          <ContractsSection
            contracts={data.contracts.top}
            totalCount={data.contracts.totalCount}
            companyId={data.company.id}
          />
        )}
        {data.visibleSections.has('finance') && <FinanceSection data={data.finance} />}
        {data.visibleSections.has('cases') && (
          <CasesSection cases={data.cases.top} totalCount={data.cases.totalCount} />
        )}
        {data.visibleSections.has('persons') && (
          <PersonsSection
            persons={data.persons.top}
            totalCount={data.persons.totalCount}
            companyId={data.company.id}
          />
        )}
        {data.visibleSections.has('visits') && <VisitsSection visits={data.visits} />}
        {data.visibleSections.has('documents') && (
          <DocumentsSection
            documents={data.documents.rows}
            awaitingReviewCount={data.documents.awaitingReviewCount}
          />
        )}
        {data.visibleSections.has('insight') && data.aiInsight && (
          <div className="col-span-2">
            <AiInsightCard
              headlineMd={data.aiInsight.headline_md}
              bodyMd={data.aiInsight.body_md}
            />
          </div>
        )}
      </div>
    </div>
  )
}
