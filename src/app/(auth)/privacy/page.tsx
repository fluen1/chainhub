import { redirect } from 'next/navigation'

// Gammel rute bevaret for bogmærker → kanonisk /legal/privatliv.
export default function PrivacyRedirect() {
  redirect('/legal/privatliv')
}
