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
      '@typescript-eslint/no-explicit-any': 'error',

      // Exhaustive deps skal være error — manglende deps er reelle bugs
      'react-hooks/exhaustive-deps': 'error',

      // Import-sortering: eksterne pakker → interne aliaser (@/) → relative
      // eslint-plugin-import er inkluderet i node_modules via eslint-config-next
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  // Test-filer: `any` er acceptabelt i mock-kald og test-fixtures
  {
    files: ['src/__tests__/**/*.ts', 'src/__tests__/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]

module.exports = config
