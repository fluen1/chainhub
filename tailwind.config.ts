import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', ...defaultTheme.fontFamily.sans],
      },
      borderColor: {
        border: 'hsl(var(--border))',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // B-stil tokens — eksponeret som Tailwind-farver til "bg-b-panel"/"text-b-1" etc.
        // Reference: docs/design/DESIGN-BRIEF-2026-05.md
        b: {
          canvas: 'var(--b-canvas)',
          sidebar: 'var(--b-sidebar)',
          panel: 'var(--b-panel)',
          'panel-h': 'var(--b-panel-h)',
          'row-hover': 'var(--b-row-hover)',
          divider: 'var(--b-row-divider)',
          border: 'var(--b-border)',
          'border-strong': 'var(--b-border-strong)',
          1: 'var(--b-text-1)',
          2: 'var(--b-text-2)',
          3: 'var(--b-text-3)',
          'red-bg': 'var(--b-red-bg)',
          'red-fg': 'var(--b-red-fg)',
          'amber-bg': 'var(--b-amber-bg)',
          'amber-fg': 'var(--b-amber-fg)',
          'green-bg': 'var(--b-green-bg)',
          'green-fg': 'var(--b-green-fg)',
          'blue-bg': 'var(--b-blue-bg)',
          'blue-fg': 'var(--b-blue-fg)',
          'gray-bg': 'var(--b-gray-bg)',
          'gray-fg': 'var(--b-gray-fg)',
          'ai-border': 'var(--b-ai-border)',
          'ai-fg': 'var(--b-ai-fg)',
          'ai-accent': 'var(--b-ai-accent)',
          // Heatmap — GitHub-contribution palette (6 niveauer)
          'heat-l1': 'var(--b-heat-l1)',
          'heat-l2': 'var(--b-heat-l2)',
          'heat-l3': 'var(--b-heat-l3)',
          'heat-r1': 'var(--b-heat-r1)',
          'heat-r2': 'var(--b-heat-r2)',
          'heat-r3': 'var(--b-heat-r3)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
export default config
