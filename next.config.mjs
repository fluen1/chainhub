import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skjul sourcemaps fra production bundle (kun Sentry har adgang)
  productionBrowserSourceMaps: false,
}

// Sentry-konfiguration. Deaktiveret hvis ingen DSN er konfigureret.
const sentryEnabled = !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      reactComponentAnnotation: { enabled: true },
      tunnelRoute: '/monitoring',
      hideSourceMaps: true,
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : nextConfig
