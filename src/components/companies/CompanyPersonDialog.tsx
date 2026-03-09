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
import { createCompanyPersonSchema, type CreateCompanyPersonInput } from '@/lib/validations/company'
import { createCompanyPerson, updateCompanyPerson } from '@/actions/companies'
import { Loader2 } from 'lucide-react'

type CompanyPersonData = {
  id: string
  companyId: string
  personId: string
  role: string
  employmentType?: string | null
  startDate?: string | null
  endDate?: string | null
  anciennityStart?: string | null
  contractId?: string | null
}

interface CompanyPersonDialogProps {
  companyId: string
  companyPerson?: CompanyPersonData | null
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

const employeeRoles = [
  { value: 'ansat', label: 'Ansat' },
  { value: 'advokat', label: 'Advokat' },
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
    resolver: zodResolver(createCompanyPersonSchema),
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
        employmentType: (companyPerson.employmentType as any) ?? undefined,
        startDate: companyPerson.startDate ?? undefined,
        endDate: companyPerson.endDate ?? undefined,
        anciennityStart: companyPerson.anciennityStart ?? undefined,
        contractId: companyPerson.contractId ?? '',
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

  const availableRoles = roleType === 'governance' ? governanceRoles : employeeRoles
  const showEmploymentType = roleType === 'employee'

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
        toast.success('Person tilknyttet')
      }
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Rediger person' : roleType === 'governance' ? 'Tilføj til governance' : 'Tilføj ansat'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!isEditing && (
            <div className="space-y-1">
              <Label htmlFor="personId">Person-ID</Label>
              <Input
                id="personId"
                {...form.register('personId')}
                placeholder="Person-ID"
              />
              {form.formState.errors.personId && (
                <p className="text-xs text-red-600">{form.formState.errors.personId.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="role">Rolle</Label>
            <Select
              value={form.watch('role')}
              onValueChange={(v) => form.setValue('role', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vælg rolle" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.role && (
              <p className="text-xs text-red-600">{form.formState.errors.role.message}</p>
            )}
          </div>

          {showEmploymentType && (
            <div className="space-y-1">
              <Label htmlFor="employmentType">Ansættelsestype</Label>
              <Select
                value={form.watch('employmentType') ?? ''}
                onValueChange={(v) => form.setValue('employmentType', v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg type" />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">Startdato</Label>
              <Input
                id="startDate"
                type="date"
                {...form.register('startDate')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">Slutdato</Label>
              <Input
                id="endDate"
                type="date"
                {...form.register('endDate')}
              />
            </div>
          </div>

          {showEmploymentType && (
            <div className="space-y-1">
              <Label htmlFor="anciennityStart">Anciennitetsdato</Label>
              <Input
                id="anciennityStart"
                type="date"
                {...form.register('anciennityStart')}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Gem ændringer' : 'Tilføj'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}