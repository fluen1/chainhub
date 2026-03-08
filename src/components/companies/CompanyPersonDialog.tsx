'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createCompanyPersonSchema, updateCompanyPersonSchema, CreateCompanyPersonInput } from '@/lib/validations/company'
import { createCompanyPerson, updateCompanyPerson } from '@/actions/companies'
import { CompanyPersonWithRelations } from '@/types/company'
import { Loader2 } from 'lucide-react'

interface CompanyPersonDialogProps {
  companyId: string
  companyPerson?: CompanyPersonWithRelations | null
  roleType: 'governance' | 'employee'
  open: boolean
  onOpenChange: (open: boolean) => void
}

const governanceRoles = [
  { value: 'direktør', label: 'Direktør' },
  { value: 'bestyrelsesformand', label: 'Bestyrelsesformand' },
  { value: 'bestyrelsesmedlem', label: 'Bestyrelsesmedlem' },
  { value: 'revisor', label: 'Revisor' },
]

const employmentTypes = [
  { value: 'funktionær', label: 'Funktionær' },
  { value: 'ikke-funktionær', label: 'Ikke-funktionær' },
  { value: 'vikar', label: 'Vikar' },
  { value: 'elev', label: 'Elev' },
]

export function CompanyPersonDialog({
  companyId,
  companyPerson,
  roleType,
  open,
  onOpenChange,
}: CompanyPersonDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!companyPerson

  const form = useForm<CreateCompanyPersonInput>({
    resolver: zodResolver(isEditing ? updateCompanyPersonSchema : createCompanyPersonSchema),
    defaultValues: {
      companyId,
      personId: '',
      role: '',
      employmentType: undefined,
      startDate: undefined,
      endDate: undefined,
      anciennityStart: undefined,
      contractId: '',
    },
  })

  useEffect(() => {
    if (companyPerson) {
      form.reset({
        companyId,
        personId: companyPerson.personId,
        role: companyPerson.role,
        employmentType: companyPerson.employmentType as any,
        startDate: companyPerson.startDate || undefined,
        endDate: companyPerson.endDate || undefined,
        anciennityStart: companyPerson.anciennityStart || undefined,
        contractId: companyPerson.contractId || '',
      })
    } else {
      form.reset({
        companyId,
        personId: '',
        role: '',
        employmentType: undefined,
        startDate: undefined,
        endDate: undefined,
        anciennityStart: undefined,
        contractId: '',
      })
    }
  }, [companyPerson, companyId, form])

  async function onSubmit(data: CreateCompanyPersonInput) {
    setIsSubmitting(true)
    try {
      if (isEditing && companyPerson) {
        const result = await updateCompanyPerson({
          id: companyPerson.id,
          role: data.role,
          employmentType: data.employmentType,
          startDate: data.startDate,
          endDate: data.endDate,
          anciennityStart: data.anciennityStart,
          contractId: data.contractId,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Person opdateret')
      } else {
        const result = await createCompanyPerson(data)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Person tilføjet')
      }
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? 'Rediger person'
              : roleType === 'governance'
              ? 'Tilføj til ledelse'
              : 'Tilføj ansat'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="personId">Person-ID</Label>
              <Input
                id="personId"
                {...form.register('personId')}
                placeholder="Person-ID (UUID)"
              />
              <p className="text-xs text-gray-500">
                Vælg en person fra personregistret
              </p>
            </div>
          )}

          {roleType === 'governance' ? (
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select
                value={form.watch('role')}
                onValueChange={(value) => form.setValue('role', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg rolle" />
                </SelectTrigger>
                <SelectContent>
                  {governanceRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="role">Stilling</Label>
                <Input
                  id="role"
                  {...form.register('role')}
                  placeholder="f.eks. Tandlæge, Klinikassistent"
                />
              </div>

              <div className="space-y-2">
                <Label>Ansættelsestype</Label>
                <Select
                  value={form.watch('employmentType') || ''}
                  onValueChange={(value) =>
                    form.setValue('employmentType', value as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg type" />
                  </SelectTrigger>
                  <SelectContent>
                    {employmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdato</Label>
              <Input
                id="startDate"
                type="date"
                {...form.register('startDate')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Slutdato</Label>
              <Input
                id="endDate"
                type="date"
                {...form.register('endDate')}
              />
            </div>
          </div>

          {roleType === 'employee' && (
            <div className="space-y-2">
              <Label htmlFor="anciennityStart">Anciennitetsdato</Label>
              <Input
                id="anciennityStart"
                type="date"
                {...form.register('anciennityStart')}
              />
              <p className="text-xs text-gray-500">
                Kan afvige fra startdato ved overflytning
              </p>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Gem ændringer' : 'Tilføj'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuller
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}