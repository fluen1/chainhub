'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { createPersonSchema } from '@/lib/validations/person'
import { createPerson } from '@/actions/persons'

type CreatePersonInput = z.infer<typeof createPersonSchema>

export function PersonForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePersonInput>({
    resolver: zodResolver(createPersonSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      notes: '',
    },
  })

  const onSubmit = async (data: CreatePersonInput) => {
    setIsSubmitting(true)
    try {
      const result = await createPerson(data)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Personen blev oprettet')
      router.push(`/persons/${result.data!.id}`)
    } catch {
      toast.error('Der opstod en fejl — prøv igen')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Fornavn *</Label>
              <Input
                id="firstName"
                placeholder="Indtast fornavn"
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Efternavn *</Label>
              <Input
                id="lastName"
                placeholder="Indtast efternavn"
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="navn@eksempel.dk"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+45 12 34 56 78"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Noter</Label>
            <Textarea
              id="notes"
              placeholder="Tilføj noter om personen..."
              rows={4}
              {...register('notes')}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Annuller
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opretter...
              </>
            ) : (
              'Opret person'
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}