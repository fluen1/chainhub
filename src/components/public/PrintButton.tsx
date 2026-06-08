'use client'

import { BButton } from '@/components/ui/b'

// "Download" sker via browserens print-til-PDF — ingen server-side PDF-pipeline i v1.
export function PrintButton() {
  return (
    <BButton onClick={() => window.print()} className="text-[12px]">
      Download / udskriv (PDF)
    </BButton>
  )
}
