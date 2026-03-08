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
import { createOwnershipSchema, updateOwnershipSchema, CreateOwnershipInput } from '@/lib/validations/company'
import { createOwnership, updateOwnership } from '@/actions/companies'
import { OwnershipWithRelations } from '@/types/company'
import { Loader2 } from 'lucide-react'

interface OwnershipDialogProps {
  companyId: string
  ownership?: OwnershipWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OwnershipDialog({
  companyId,
  ownership,
  open,
  onOpenChange,
}: OwnershipDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!ownership

  const form = useForm<CreateOwnershipInput>({
    resolver: zodResolver(isEditing ? updateOwnershipSchema : createOwnershipSchema),
    defaultValues: {
      companyId,
      ownerType: 'person',
      ownerPersonId: '',
      ownerCompanyId: '',
      ownershipPct: 0,
      shareClass: '',
      effectiveDate: undefined,
      contractId: '',
    },
  })

  useEffect(() => {
    if (ownership) {
      form.reset({
        companyId,
        ownerType: ownership.ownerPersonId ? 'person' : 'company',
        ownerPersonId: ownership.ownerPersonId || '',
        ownerCompanyId: ownership.ownerCompanyId || '',
        ownershipPct: Number(ownership.ownershipPct),
        shareClass: ownership.shareClass || '',
        effectiveDate: ownership.effectiveDate || undefined,
        contractId: ownership.contractId || '',
      })
    } else {
      form.reset({
        companyId,
        ownerType: 'person',
        ownerPersonId: '',
        ownerCompanyId: '',
        ownershipPct: 0,
        shareClass: '',
        effectiveDate: undefined,
        contractId: '',
      })
    }
  }, [ownership, companyId, form])

  async function onSubmit(data: CreateOwnershipInput) {
    setIsSubmitting(true)
    try {
      if (isEditing && ownership) {
        const result = await updateOwnership({
          id: ownership.id,
          ownershipPct: data.ownershipPct,
          shareClass: data.shareClass,
          effectiveDate: data.effectiveDate,
          contractId: data.contractId,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Ejerskab opdateret')
      } else {
        const result = await createOwnership(data)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Ejerskab tilføjet')
      }
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const ownerType = form.watch('ownerType')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Rediger ejerskab' : 'Tilføj ejer'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!isEditing && (
            <>
              <div className="space-y-2">
                <Label>Ejertype</Label>
                <Select
                  value={ownerType}
                  onValueChange={(value) =>
                    form.setValue('ownerType', value as 'person' | 'company')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="company">Selskab</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ownerType === 'person' && (
                <div className="space-y-2">
                  <Label htmlFor="ownerPersonId">Person-ID</Label>
                  <Input
                    id="ownerPersonId"
                    {...form.register('ownerPersonId')}
                    placeholder="Person-ID (UUID)"
                  />
                  <p className="text-xs text-gray-500">
                    Vælg en person fra personregistret
                  </p>
                </div>
              )}

              {ownerType === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="ownerCompanyId">Ejerselskab-ID</Label>
                  <Input
                    id="ownerCompanyId"
                    {...form.register('ownerCompanyId')}
                    placeholder="Selskabs-ID (UUID)"
                  />
                  <p className="text-xs text-gray-500">
                    Vælg et ejerselskab fra selskabslisten
                  </p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="ownershipPct">Ejerandel (%)</Label>
            <Input
              id="ownershipPct"
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              {...form.register('ownershipPct', { valueAsNumber: true })}
            />
            {form.formState.errors.ownershipPct && (
              <p className="text-sm text-red-600">
                {form.formState.errors.ownershipPct.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="shareClass">Anpartsklasse</Label>
            <Input
              id="shareClass"
              {...form.register('shareClass')}
              placeholder="f.eks. A-anparter"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveDate">Ikrafttrædelsesdato</Label>
            <Input
              id="effectiveDate"
              type="date"
              {...form.register('effectiveDate')}
            />
          </div>

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