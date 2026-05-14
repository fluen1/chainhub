import Link from 'next/link'

// Breadcrumb — sti-navigation, 12px grå. Sidste element er en string (current
// side), tidligere er Link-objekter.
//
// Brug:
//   <Breadcrumb
//     trail={[{ label: 'Kontrakter', href: '/contracts' }]}
//     current="Lejekontrakt erhverv · Tandlæge Østerbro ApS"
//   />

export interface BreadcrumbStep {
  label: string
  href: string
}

export function Breadcrumb({
  trail,
  current,
}: {
  trail: BreadcrumbStep[]
  current: React.ReactNode
}) {
  return (
    <nav aria-label="Brødkrummer" className="py-1 text-[12px] text-b-2">
      {trail.map((step, i) => (
        <span key={i}>
          <Link href={step.href} className="text-b-2 no-underline hover:text-b-1">
            {step.label}
          </Link>
          <span className="mx-1.5 text-b-3">›</span>
        </span>
      ))}
      <span className="text-b-2">{current}</span>
    </nav>
  )
}
