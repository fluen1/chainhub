'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { updatePersonSchema, UpdatePersonInput } from '@/lib/validations/person'
import { updatePerson } from '@/actions/persons'
import { Person } from '@prisma/client'

interface PersonEditDialogProps {
  person: Person
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PersonEditDialog({ person, open, onOpenChange }: PersonEditDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePersonInput>({
    resolver: zodResolver(updatePersonSchema),
    defaultValues: {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email || '',
      phone: person.phone || '',
      notes: person.notes || '',
    },
  })

  const onSubmit = async (data: UpdatePersonInput) => {
    setIsSubmitting(true)
    try {
      const result = await updatePerson(data)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Personen blev opdateret')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Der opstod en fejl — prøv igen')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger person</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">Fornavn *</Label>
              <Input
                id="edit-firstName"
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Efternavn *</Label>
              <Input
                id="edit-lastName"
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">E-mail</Label>
            <Input
              id="edit-email"
              type="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Telefon</Label>
            <Input
              id="edit-phone"
              type="tel"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Noter</Label>
            <Textarea
              id="edit-notes"
              rows={3}
              {...register('notes')}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuller
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gemmer...
                </>
              ) : (
                'Gem ændringer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}