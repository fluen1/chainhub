import type { ReactNode } from 'react'

// Auth-siderne (login, signup, invite, reset m.fl.) var statisk prerenderede ved
// build. Statiske sider kan IKKE få den per-request CSP-nonce injiceret i deres
// <script>-tags (middleware kører ikke ved build) → 'strict-dynamic' blokerede
// alle scripts og gjorde siderne tomme. Nonce-baseret CSP kræver dynamisk
// rendering (jf. Next.js' CSP-guide), så vi tvinger det for hele auth-gruppen.
export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
