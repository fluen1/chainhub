'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { linkPersonToCompanySchema, LinkPersonToCompanyInput } from '@/lib/validations/person'
import { linkPersonToCompany } from '@/actions/persons'
import { listCompanies } from '@/actions/companies'
import { CompanyWithCounts } from '@/types/company'

interface LinkToCompanyDialogProps {
  personId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROLE_OPTIONS = [
  { value: 'direktør', label: 'Direktør' },
  { value: 'bestyrelsesmedlem', label: 'Bestyrelsesmedlem' },
  { value: 'ansat', label: 'Ansat' },
  { value: 'revisor', label: 'Revisor' },
  { value: 'advokat', label: 'Advokat' },
  { value: 'anden', label: 'Anden' },
]

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'funktionær', label: 'Funktionær' },
  { value: 'ikke-funktionær', label: 'Ikke-funktionær' },
  { value: 'vikar', label: 'Vikar' },
  { value: 'elev', label: 'Elev' },
]

export function LinkToCompanyDialog({ personId, open, onOpenChange }: LinkToCompanyDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companies, setCompanies] = useState<CompanyWithCounts[]>([])
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LinkPersonToCompanyInput>({
    resolver: zodResolver(linkPersonToCompanySchema),
    defaultValues: {
      personId,
      companyId: '',
      role: 'ansat',
    },
  })

  const selectedRole = watch('role')

  useEffect(() => {
    if (open) {
      loadCompanies()
      reset({
        personId,
        companyId: '',
        role: 'ansat',
      })
    }
  }, [open, personId, reset])

  const loadCompanies = async () => {
    setIsLoadingCompanies(true)
    try {
      const result = await listCompanies()
      if (result.data) {
        setCompanies(result.data)
      }
    } catch {
      toast.error('Kunne ikke hente selskaber')
    } finally {
      setIsLoadingCompanies(false)
    }
  }

  const onSubmit = async (data: LinkPersonToCompanyInput) => {
    setIsSubmitting(true)
    try {
      const result = await linkPersonToCompany(data)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Personen blev tilknyttet selskabet')
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
          <DialogTitle>Tilknyt til selskab</DialogTitle>
          <DialogDescription>
            Vælg et selskab og den rolle personen skal have
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyId">Selskab *</Label>
            <Select
              disabled={isLoadingCompanies}
              onValueChange={(value) => setValue('companyId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingCompanies ? 'Henter selskaber...' : 'Vælg selskab'} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.companyId && (
              <p className="text-sm text-red-600">{errors.companyId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rolle *</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vælg rolle" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>

          {selectedRole === 'ansat' && (
            <div className="space-y-2">
              <Label htmlFor="employmentType">Ansættelsestype</Label>
              <Select
                onValueChange={(value) => setValue('employmentType', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg type (valgfri)" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdato</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Slutdato</Label>
              <Input
                id="endDate"
                type="date"
                {...register('endDate')}
              />
            </div>
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
            <Button type="submit" disabled={isSubmitting || isLoadingCompanies}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tilknytter...
                </>
              ) : (
                'Tilknyt selskab'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}