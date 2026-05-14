import type { Metadata } from 'next'
// Self-hosted Inter via @fontsource-variable/inter — undgår build-time fetch til
// Google Fonts (failer offline/bag firewall). Variable font giver alle vægte
// 100-900 i én fil.
import '@fontsource-variable/inter/index.css'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: 'ChainHub — Porteføljestyring',
    template: '%s — ChainHub',
  },
  description: 'Porteføljestyring for kæder med delejede lokationsselskaber',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body className="font-sans text-[13px] text-b-1 antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
