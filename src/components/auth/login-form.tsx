'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'

interface LoginFormProps {
  callbackUrl?: string
  error?: string
}

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Ugyldig email eller adgangskode',
  NoAccount:
    'Der findes ingen konto med denne Microsoft-konto. Kontakt din administrator.',
  Default: 'Der opstod en fejl. Prøv igen.',
}

export function LoginForm({ callbackUrl, error }: LoginFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(
    error ? ERROR_MESSAGES[error] || ERROR_MESSAGES.Default : null
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setFormError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl || '/dashboard',
      })

      if (result?.error) {
        setFormError(ERROR_MESSAGES.CredentialsSignin)
        setIsLoading(false)
        return
      }

      if (result?.ok) {
        router.push(callbackUrl || '/dashboard')
        router.refresh()
      }
    } catch (error) {
      setFormError(ERROR_MESSAGES.Default)
      setIsLoading(false)
    }
  }

  const handleMicrosoftSignIn = async () => {
    setIsMicrosoftLoading(true)
    setFormError(null)

    try {
      await signIn('azure-ad', {
        callbackUrl: callbackUrl || '/dashboard',
      })
    } catch (error) {
      setFormError(ERROR_MESSAGES.Default)
      setIsMicrosoftLoading(false)
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="din@email.dk"
            disabled={isLoading || isMicrosoftLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Adgangskode</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            disabled={isLoading || isMicrosoftLoading}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || isMicrosoftLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logger ind...
            </>
          ) : (
            'Log ind'
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-gray-50 px-2 text-gray-500">Eller</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleMicrosoftSignIn}
        disabled={isLoading || isMicrosoftLoading}
      >
        {isMicrosoftLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Forbinder til Microsoft...
          </>
        ) : (
          <>
            <MicrosoftIcon className="mr-2 h-4 w-4" />
            Log ind med Microsoft
          </>
        )}
      </Button>

      <p className="text-center text-sm text-gray-600">
        Har du brug for en konto?{' '}
        <a href="/register" className="font-medium text-blue-600 hover:text-blue-500">
          Kontakt din administrator
        </a>
      </p>
    </div>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}