import Link from 'next/link'
import { Mail, Phone, Building2, ChevronRight } from 'lucide-react'
import { PersonListItem } from '@/types/person'
import { Badge } from '@/components/ui/badge'

interface PersonCardProps {
  person: PersonListItem
}

export function PersonCard({ person }: PersonCardProps) {
  const initials = `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()
  
  const activeRoles = person.companyPersons.filter(
    (cp) => !cp.endDate || new Date(cp.endDate) > new Date()
  )

  return (
    <Link href={`/persons/${person.id}`}>
      <div className="group rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
              {person.firstName} {person.lastName}
            </h3>
            {person.email && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{person.email}</span>
              </div>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
        </div>

        {person.phone && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
            <Phone className="h-3.5 w-3.5" />
            <span>{person.phone}</span>
          </div>
        )}

        {activeRoles.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Building2 className="h-3.5 w-3.5" />
              <span>Tilknyttet {person._count.companyPersons} {person._count.companyPersons === 1 ? 'selskab' : 'selskaber'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeRoles.slice(0, 3).map((cp) => (
                <Badge key={cp.id} variant="secondary" className="text-xs">
                  {cp.role} @ {cp.company.name}
                </Badge>
              ))}
              {activeRoles.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{activeRoles.length - 3} mere
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}