import { redirect } from 'next/navigation'

// Gammel rute bevaret for bogmærker/eksterne links → kanonisk /legal/vilkaar.
export default function TermsRedirect() {
  redirect('/legal/vilkaar')
}
