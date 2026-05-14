import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

// Inter med tabular-num + cv11 features. cv11 = Inter's alt-style for "1",
// så den er sammenlignelig med "7" i tal-kolonner. Vægte begrænset til dem
// vi faktisk bruger (400/500/600 — 700 reserveret til hero-KPI).
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

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
      <body className={`${inter.variable} font-sans text-[13px] text-b-1 antialiased`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
