'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createCompanySchema, CreateCompanyInput } from '@/lib/validations/company'
import { createCompany, updateCompany } from '@/actions/companies'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Company } from '@prisma/client'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface CompanyFormProps {
  company?: Company
  mode: 'create' | 'edit'
}

const companyTypes = [
  { value: 'ApS', label: 'ApS' },
  { value: 'A/S', label: 'A/S' },
  { value: 'I/S', label: 'I/S' },
  { value: 'K/S', label: 'K/S' },
  { value: 'P/S', label: 'P/S' },
  { value: 'Enkeltmandsvirksomhed', label: 'Enkeltmandsvirksomhed' },
  { value: 'Holding', label: 'Holding' },
  { value: 'Andet', label: 'Andet' },
]

const statusOptions = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'inaktiv', label: 'Inaktiv' },
  { value: 'under_stiftelse', label: 'Under stiftelse' },
  { value: 'opløst', label: 'Opløst' },
]

export function CompanyForm({ company, mode }: CompanyFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: company?.name || '',
      cvr: company?.cvr || '',
      companyType: (company?.companyType as any) || undefined,
      address: company?.address || '',
      city: company?.city || '',
      postalCode: company?.postalCode || '',
      foundedDate: company?.foundedDate || undefined,
      status: (company?.status as any) || 'aktiv',
      notes: company?.notes || '',
    },
  })

  async function onSubmit(data: CreateCompanyInput) {
    setIsSubmitting(true)
    try {
      if (mode === 'create') {
        const result = await createCompany(data)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Selskab oprettet')
        router.push(`/companies/${result.data.id}`)
      } else if (company) {
        const result = await updateCompany({ id: company.id, ...data })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Selskab opdateret')
        router.push(`/companies/${company.id}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === 'create' ? 'Opret nyt selskab' : 'Rediger selskab'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Navn *</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Selskabsnavn"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvr">CVR-nummer</Label>
              <Input
                id="cvr"
                {...form.register('cvr')}
                placeholder="12345678"
                maxLength={8}
              />
              {form.formState.errors.cvr && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.cvr.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyType">Selskabsform</Label>
              <Select
                value={form.watch('companyType') || ''}
                onValueChange={(value) =>
                  form.setValue('companyType', value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg selskabsform" />
                </SelectTrigger>
                <SelectContent>
                  {companyTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value) =>
                  form.setValue('status', value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              {...form.register('address')}
              placeholder="Gadenavn og nummer"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postnummer</Label>
              <Input
                id="postalCode"
                {...form.register('postalCode')}
                placeholder="1234"
                maxLength={4}
              />
              {form.formState.errors.postalCode && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.postalCode.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">By</Label>
              <Input
                id="city"
                {...form.register('city')}
                placeholder="København"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="foundedDate">Stiftelsesdato</Label>
            <Input
              id="foundedDate"
              type="date"
              {...form.register('foundedDate')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Noter</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              placeholder="Interne noter om selskabet..."
              rows={4}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Opret selskab' : 'Gem ændringer'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Annuller
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}