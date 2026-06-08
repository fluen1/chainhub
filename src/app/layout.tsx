import type { Metadata } from 'next'
// Self-hosted Inter via @fontsource-variable/inter — undgår build-time fetch til
// Google Fonts (failer offline/bag firewall). Variable font giver alle vægte
// 100-900 i én fil.
import '@fontsource-variable/inter/index.css'
import './globals.css'
import { Toaster } from 'sonner'
import { PosthogProvider } from '@/components/providers/PosthogProvider'
import { CookieConsent } from '@/components/CookieConsent'

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
        <PosthogProvider>{children}</PosthogProvider>
        <Toaster
          position="top-right"
          richColors
          duration={5000}
          toastOptions={{
            // Error-toasts skal stå længere — fejl er handlingsanvisende og må
            // ikke forsvinde før brugeren har nået at læse dem.
            classNames: { error: 'min-w-[320px]' },
            // ARIA: Sonner har built-in aria-live="polite" og role="status" på sin toast-container.
          }}
        />
        <CookieConsent />
      </body>
    </html>
  )
}
