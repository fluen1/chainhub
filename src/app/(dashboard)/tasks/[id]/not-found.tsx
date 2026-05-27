import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold text-b-1">Opgaven blev ikke fundet</h1>
      <p className="text-sm text-b-2">
        Opgaven eksisterer ikke, er slettet, eller du har ikke adgang.
      </p>
      <Link
        href="/tasks"
        className="rounded-md bg-b-blue-fg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Tilbage til opgaver
      </Link>
    </main>
  )
}
