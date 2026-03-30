import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const font = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'ChainHub — Porteføljestyring',
  description: 'Porteføljestyring for kæder med delejede lokationsselskaber',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="da">
      <body className={`${font.variable} font-sans`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
