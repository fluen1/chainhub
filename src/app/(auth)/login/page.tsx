import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Log ind | ChainHub',
  description: 'Log ind på ChainHub',
}

interface LoginPageProps {
  searchParams: {
    callbackUrl?: string
    error?: string
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth()

  // Redirect til dashboard hvis allerede logget ind
  if (session?.user) {
    redirect(searchParams.callbackUrl || '/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">ChainHub</h1>
          <h2 className="mt-6 text-2xl font-semibold text-gray-900">
            Log ind på din konto
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Administrer din portefølje af selskaber
          </p>
        </div>

        <LoginForm
          callbackUrl={searchParams.callbackUrl}
          error={searchParams.error}
        />
      </div>
    </div>
  )
}