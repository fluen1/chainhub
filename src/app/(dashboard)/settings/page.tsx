import { Settings, User, Building2, CreditCard, Bell, Shield } from 'lucide-react'

const settingsSections = [
  {
    title: 'Profil',
    description: 'Rediger dine personlige oplysninger',
    icon: User,
    href: '/dashboard/settings/profile',
  },
  {
    title: 'Organisation',
    description: 'Administrer din organisation og brugere',
    icon: Building2,
    href: '/dashboard/settings/organization',
  },
  {
    title: 'Abonnement',
    description: 'Se og administrer dit abonnement',
    icon: CreditCard,
    href: '/dashboard/settings/billing',
  },
  {
    title: 'Notifikationer',
    description: 'Indstil dine notifikationspræferencer',
    icon: Bell,
    href: '/dashboard/settings/notifications',
  },
  {
    title: 'Sikkerhed',
    description: 'Skift adgangskode og sikkerhedsindstillinger',
    icon: Shield,
    href: '/dashboard/settings/security',
  },
]

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Indstillinger</h1>
        <p className="mt-1 text-sm text-gray-500">
          Administrer din konto og organisation
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <a
              key={section.title}
              href={section.href}
              className="group rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-gray-100 p-2 group-hover:bg-blue-50">
                  <Icon className="h-6 w-6 text-gray-600 group-hover:text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{section.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{section.description}</p>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}