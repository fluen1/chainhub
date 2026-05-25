// ESLint 9 flat config — erstatter .eslintrc.json efter Next.js 16 upgrade
// eslint-config-next v16 kræver ESLint >=9 og flat config format.
const nextConfig = require('eslint-config-next/core-web-vitals')

/** @type {import('eslint').Linter.Config[]} */
const config = [
  // Next.js 16 flat config (core-web-vitals + typescript + ignores)
  ...nextConfig,

  // Projektspecifikke rule-overrides
  {
    rules: {
      'jsx-a11y/no-autofocus': 'warn',
    },
  },
]

module.exports = config
