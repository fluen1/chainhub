import type { Metadata } from 'next'
import { ContactForm } from '@/components/public/ContactForm'

export const metadata: Metadata = {
  title: 'Kontakt — ChainHub',
  description: 'Book en demo af ChainHub, eller stil os et spørgsmål.',
}

export default function KontaktPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-[24px] font-semibold text-b-1">Book en demo</h1>
      <p className="mt-2 text-[14px] text-b-2">
        Fortæl os kort om jeres kæde, så vender vi tilbage med en demo. Du kan også skrive direkte
        til{' '}
        <a href="mailto:kontakt@chainhub.dk" className="text-b-blue-fg underline">
          kontakt@chainhub.dk
        </a>
        .
      </p>
      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  )
}
