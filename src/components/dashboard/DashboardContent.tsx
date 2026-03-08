import { Building2, FileText, Briefcase, CheckSquare, AlertTriangle } from 'lucide-react'

// Placeholder stats - will be replaced with real data
const stats = [
  {
    title: 'Selskaber',
    value: '–',
    icon: Building2,
    href: '/dashboard/companies',
  },
  {
    title: 'Aktive kontrakter',
    value: '–',
    icon: FileText,
    href: '/dashboard/contracts',
  },
  {
    title: 'Åbne sager',
    value: '–',
    icon: Briefcase,
    href: '/dashboard/cases',
  },
  {
    title: 'Opgaver',
    value: '–',
    icon: CheckSquare,
    href: '/dashboard/tasks',
  },
]

export function DashboardContent() {
  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <a
              key={stat.title}
              href={stat.href}
              className="group rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <div className="rounded-lg bg-blue-50 p-2 group-hover:bg-blue-100">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold text-gray-900">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-500">
                Ingen data endnu
              </p>
            </a>
          )
        })}
      </div>

      {/* Empty state panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming deadlines */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-medium text-gray-900">Kommende frister</h2>
          </div>
          <div className="p-6">
            <DashboardEmptyState
              icon={AlertTriangle}
              title="Ingen kommende frister"
              description="Når du tilføjer kontrakter og opgaver med deadlines, vises de her"
            />
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-medium text-gray-900">Seneste aktivitet</h2>
          </div>
          <div className="p-6">
            <DashboardEmptyState
              icon={Briefcase}
              title="Ingen aktivitet endnu"
              description="Aktivitet i dine sager og kontrakter vises her"
            />
          </div>
        </div>
      </div>

      {/* Companies overview - empty state */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-medium text-gray-900">Dine selskaber</h2>
        </div>
        <div className="p-6">
          <DashboardEmptyState
            icon={Building2}
            title="Ingen selskaber oprettet"
            description="Opret dit første selskab for at komme i gang med porteføljestyring"
            actionLabel="Opret selskab"
            actionHref="/dashboard/companies/new"
          />
        </div>
      </div>
    </div>
  )
}

interface DashboardEmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: DashboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-full bg-gray-100 p-3">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {actionLabel}
        </a>
      )}
    </div>
  )
}